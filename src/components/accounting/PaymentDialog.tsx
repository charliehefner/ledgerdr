import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t } = useLanguage();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");
  const submitLockRef = useRef(false);

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
      if (!amount || amount <= 0) throw new Error(t("payment.invalidAmount"));
      if (amount > document.balance_remaining + 0.005) throw new Error(t("payment.exceedsBalance"));

      const selectedBank = bankAccounts.find(b => b.id === bankAccountId);
      if (!selectedBank?.chart_account_id) throw new Error(t("payment.selectLinkedAccount"));

      const now = Date.now();
      const duplicateWindowMs = 5 * 60 * 1000;
      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from("ap_ar_payments")
        .select("id, notes, journal_id, created_at")
        .eq("document_id", document.id)
        .eq("payment_date", paymentDate)
        .eq("amount", amount)
        .eq("bank_account_id", bankAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPaymentError) throw existingPaymentError;

      if (
        existingPayment?.journal_id &&
        existingPayment.notes?.startsWith("TX-") &&
        now - new Date(existingPayment.created_at).getTime() <= duplicateWindowMs
      ) {
        return { reusedExistingPayment: true };
      }

      const newPaid = document.amount_paid + amount;
      const newBalance = document.total_amount - newPaid;
      const newStatus = newBalance <= 0.005 ? "paid" : "partial";

      const isPayable = document.direction === "payable";
      const journalType = isPayable ? "CDJ" : "CRJ";

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
        if (!fallbackAcct) throw new Error(t("payment.glAccountNotFound").replace("{code}", fallbackCode));
        apArAccountId = fallbackAcct.id;
      }

      let journalId: string | null = null;
      let transactionId: string | null = null;
      let transactionLegacyId: number | null = null;
      try {
        const { data: createdJournalId, error: jErr } = await supabase.rpc(
          "create_journal_from_transaction" as any,
          {
            p_transaction_id: null,
            p_date: paymentDate,
            p_description: `${isPayable ? t("payment.paymentTo") : t("payment.paymentFrom")} ${document.contact_name} — ${document.document_number || t("payment.noNumber")}`,
            p_created_by: user?.id || null,
            p_journal_type: journalType,
          }
        );
        if (jErr) throw jErr;
        journalId = createdJournalId;

        const lines = isPayable
          ? [
              { journal_id: journalId, account_id: apArAccountId, debit: amount, credit: 0, description: `${t("payment.paymentTo")} ${document.contact_name}` },
              { journal_id: journalId, account_id: selectedBank.chart_account_id, debit: 0, credit: amount, description: `${t("payment.paymentTo")} ${selectedBank.account_name}` },
            ]
          : [
              { journal_id: journalId, account_id: selectedBank.chart_account_id, debit: amount, credit: 0, description: `${t("payment.collectionFrom")} ${document.contact_name}` },
              { journal_id: journalId, account_id: apArAccountId, debit: 0, credit: amount, description: `${t("payment.collectionTo")} ${document.contact_name}` },
            ];

        const { error: lErr } = await supabase.from("journal_lines").insert(lines);
        if (lErr) throw lErr;

        if (document.currency !== "DOP") {
          const { data: rateData } = await supabase
            .from("exchange_rates")
            .select("sell_rate")
            .eq("currency_pair", "USD_DOP")
            .order("rate_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          const rate = rateData?.sell_rate || 1;
          const { error: journalUpdateError } = await supabase
            .from("journals")
            .update({
              currency: document.currency,
              exchange_rate: rate,
            })
            .eq("id", journalId);
          if (journalUpdateError) throw journalUpdateError;
        }

        const { data: apArAcct, error: apArAcctError } = await supabase
          .from("chart_of_accounts")
          .select("account_code")
          .eq("id", apArAccountId)
          .maybeSingle();
        if (apArAcctError) throw apArAcctError;

        const txDescription = `${isPayable ? t("payment.paymentTo") : t("payment.paymentFrom")} ${document.contact_name} — ${document.document_number || t("payment.noNumber")}`;

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

        if (txErr) throw txErr;
        transactionId = newTx.id;
        transactionLegacyId = newTx.legacy_id;

        const { error: linkJournalError } = await supabase
          .from("journals")
          .update({ transaction_source_id: newTx.id })
          .eq("id", journalId);
        if (linkJournalError) throw linkJournalError;

        const { error: pErr } = await supabase
          .from("ap_ar_payments" as any)
          .insert({
            document_id: document.id,
            payment_date: paymentDate,
            amount: amount,
            payment_method: selectedBank.account_name,
            bank_account_id: bankAccountId,
            journal_id: journalId,
            created_by: user?.id || null,
            notes: transactionLegacyId ? `TX-${transactionLegacyId}` : null,
          });
        if (pErr) throw pErr;

        const { error } = await supabase
          .from("ap_ar_documents")
          .update({
            amount_paid: Math.round(newPaid * 100) / 100,
            status: newStatus,
          })
          .eq("id", document.id);
        if (error) throw error;

        return { reusedExistingPayment: false };
      } catch (error) {
        if (journalId) {
          await supabase.from("ap_ar_payments").delete().eq("journal_id", journalId);
        }
        if (journalId) {
          await supabase.from("journal_lines").delete().eq("journal_id", journalId);
          await supabase.from("journals").delete().eq("id", journalId);
        }
        if (transactionId) {
          await supabase.from("transactions").delete().eq("id", transactionId);
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        result?.reusedExistingPayment
          ? t("payment.alreadyRecorded")
          : t("payment.successWithJournal")
      );
      onOpenChange(false);
      setPaymentAmount("");
      setBankAccountId("");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) { setPaymentAmount(""); setBankAccountId(""); }
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (submitLockRef.current || mutation.isPending) return;
    submitLockRef.current = true;
    mutation.mutate();
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("payment.title")}</DialogTitle>
          <DialogDescription>
            {document.contact_name} — {document.document_number || t("payment.noNumber")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t("payment.total")}</span>
              <span className="ml-2 font-mono font-medium">{formatCurrency(document.total_amount, document.currency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("payment.paid")}</span>
              <span className="ml-2 font-mono font-medium">{formatCurrency(document.amount_paid, document.currency)}</span>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30 text-center">
            <div className="text-xs text-muted-foreground">{t("payment.pendingBalance")}</div>
            <div className="text-lg font-bold font-mono text-destructive">
              {formatCurrency(document.balance_remaining, document.currency)}
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("payment.paymentDate")}</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("payment.bankAccount")}</Label>
            <Select value={bankAccountId || undefined} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder={t("payment.selectAccount")} /></SelectTrigger>
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
            <Label>{t("payment.paymentAmount")}</Label>
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
              {t("payment.payTotal")} {formatCurrency(document.balance_remaining, document.currency)}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || !bankAccountId || mutation.isPending}
          >
            {mutation.isPending ? t("payment.saving") : t("payment.register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
