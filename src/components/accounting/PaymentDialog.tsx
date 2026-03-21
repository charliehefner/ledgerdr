import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    contact_name: string;
    document_number: string | null;
    currency: string;
    total_amount: number;
    amount_paid: number;
    balance_remaining: number;
    direction: string;
    account_id: string | null;
  } | null;
}

export function PaymentDialog({ open, onOpenChange, document }: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");

  // Fetch bank accounts for payment method selection
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, chart_account_id, currency")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!document) return;
      const amount = parseFloat(paymentAmount);
      if (!amount || amount <= 0) throw new Error("Monto inválido");
      if (amount > document.balance_remaining + 0.005) throw new Error("El pago excede el saldo pendiente");

      const selectedBank = bankAccounts.find(b => b.id === bankAccountId);
      if (!selectedBank?.chart_account_id) throw new Error("Seleccione una cuenta bancaria con cuenta contable asignada");

      const newPaid = document.amount_paid + amount;
      const newBalance = document.total_amount - newPaid;
      const newStatus = newBalance <= 0.005 ? "paid" : "partial";

      // Determine AP/AR GL account and journal type based on direction
      const isPayable = document.direction === "payable";
      const journalType = isPayable ? "CDJ" : "CRJ";

      // Use the document's linked account, or fall back to default
      let apArAccountId = document.account_id;
      if (!apArAccountId) {
        const fallbackCode = isPayable ? "2100" : "1200";
        const { data: fallbackAcct } = await supabase
          .from("chart_of_accounts")
          .select("id")
          .eq("account_code", fallbackCode)
          .eq("allow_posting", true)
          .is("deleted_at", null)
          .maybeSingle();
        if (!fallbackAcct) throw new Error(`Cuenta contable ${fallbackCode} no encontrada`);
        apArAccountId = fallbackAcct.id;
      }

      // 1. Create payment journal entry
      const { data: journalId, error: jErr } = await supabase.rpc(
        "create_journal_from_transaction" as any,
        {
          p_transaction_id: null,
          p_date: paymentDate,
          p_description: `Pago ${isPayable ? "a" : "de"} ${document.contact_name} — ${document.document_number || "S/N"}`,
          p_created_by: user?.id || null,
          p_journal_type: journalType,
        }
      );
      if (jErr) throw jErr;

      // Journal lines: for payable, debit AP credit bank; for receivable, debit bank credit AR
      const lines = isPayable
        ? [
            { journal_id: journalId, account_id: apArAccountId, debit: amount, credit: 0, description: `Pago a ${document.contact_name}` },
            { journal_id: journalId, account_id: selectedBank.chart_account_id, debit: 0, credit: amount, description: `Pago ${selectedBank.account_name}` },
          ]
        : [
            { journal_id: journalId, account_id: selectedBank.chart_account_id, debit: amount, credit: 0, description: `Cobro de ${document.contact_name}` },
            { journal_id: journalId, account_id: apArAccountId, debit: 0, credit: amount, description: `Cobro a ${document.contact_name}` },
          ];

      const { error: lErr } = await supabase.from("journal_lines").insert(lines);
      if (lErr) {
        // Clean up orphaned journal
        await supabase.from("journals").delete().eq("id", journalId);
        throw lErr;
      }

      // Finding 7: Set currency and exchange_rate on the payment journal
      if (document.currency !== "DOP") {
        // Fetch latest exchange rate
        const { data: rateData } = await supabase
          .from("exchange_rates")
          .select("sell_rate")
          .eq("currency_pair", "USD_DOP")
          .order("rate_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        const rate = rateData?.sell_rate || 1;
        await supabase.from("journals").update({
          currency: document.currency,
          exchange_rate: rate,
        }).eq("id", journalId);
      }

      // 2. Create a transaction record for full traceability
      let transactionLegacyId: number | null = null;
      try {
        // Look up AP/AR account code for master_acct_code
        const { data: apArAcct } = await supabase
          .from("chart_of_accounts")
          .select("account_code")
          .eq("id", apArAccountId)
          .maybeSingle();

        const txDescription = `Pago ${isPayable ? "a" : "de"} ${document.contact_name} — ${document.document_number || "S/N"}`;

        const { data: newTx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            transaction_date: paymentDate,
            description: txDescription,
            amount: amount,
            currency: document.currency,
            pay_method: bankAccountId,
            name: document.contact_name,
            master_acct_code: apArAcct?.account_code || (isPayable ? "2100" : "1200"),
            transaction_direction: isPayable ? "purchase" : "sale",
            is_internal: false,
            cost_center: "general",
            exchange_rate: document.currency !== "DOP" ? undefined : 1,
          })
          .select("id, legacy_id")
          .single();

        if (txErr) {
          console.error("Transaction insert error (non-fatal):", txErr);
        } else if (newTx) {
          transactionLegacyId = newTx.legacy_id;
          // Link journal to this transaction
          await supabase
            .from("journals")
            .update({ transaction_source_id: newTx.id })
            .eq("id", journalId);
        }
      } catch (txError) {
        console.error("Transaction creation failed (non-fatal):", txError);
      }

      // 3. Record payment in ap_ar_payments audit trail
      const { error: pErr } = await supabase.from("ap_ar_payments" as any).insert({
        document_id: document.id,
        payment_date: paymentDate,
        amount: amount,
        payment_method: selectedBank.account_name,
        bank_account_id: bankAccountId,
        journal_id: journalId,
        created_by: user?.id || null,
        notes: transactionLegacyId ? `TX-${transactionLegacyId}` : null,
      });
      if (pErr) console.error("Payment audit insert error:", pErr);

      // 4. Update ap_ar_documents summary
      const { error } = await supabase
        .from("ap_ar_documents")
        .update({
          amount_paid: Math.round(newPaid * 100) / 100,
          balance_remaining: Math.max(0, Math.round(newBalance * 100) / 100),
          status: newStatus,
        })
        .eq("id", document.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pago registrado con asiento contable y transacción");
      onOpenChange(false);
      setPaymentAmount("");
      setBankAccountId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) { setPaymentAmount(""); setBankAccountId(""); }
    onOpenChange(isOpen);
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            {document.contact_name} — {document.document_number || "Sin número"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Total:</span>
              <span className="ml-2 font-mono font-medium">{formatCurrency(document.total_amount, document.currency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pagado:</span>
              <span className="ml-2 font-mono font-medium">{formatCurrency(document.amount_paid, document.currency)}</span>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30 text-center">
            <div className="text-xs text-muted-foreground">Saldo Pendiente</div>
            <div className="text-lg font-bold font-mono text-destructive">
              {formatCurrency(document.balance_remaining, document.currency)}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Fecha del Pago</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cuenta Bancaria *</Label>
            <Select value={bankAccountId || undefined} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
              <SelectContent className="bg-popover">
                {bankAccounts.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.account_name} — {b.bank_name} ({b.currency || "DOP"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto del Pago *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={document.balance_remaining}
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono text-lg"
              autoFocus
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => setPaymentAmount(document.balance_remaining.toFixed(2))}
            >
              Pagar total: {formatCurrency(document.balance_remaining, document.currency)}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || !bankAccountId || mutation.isPending}
          >
            {mutation.isPending ? "Guardando..." : "Registrar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
