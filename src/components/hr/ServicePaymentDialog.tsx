import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateLocal } from "@/lib/dateUtils";
import { toast } from "@/hooks/use-toast";

interface BankAccountOption {
  id: string;
  account_name: string;
  bank_name: string;
  account_type: string;
}

interface ServiceEntryPaymentDialogEntry {
  id: string;
  description: string | null;
  currency: string;
  committed_amount?: number | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  pay_method: string | null;
  service_providers: {
    name: string;
    cedula: string;
  };
}

export interface ServicePaymentRecord {
  id: string;
  payment_date: string;
  amount: number;
  ncf: string | null;
  notes: string | null;
  is_final_payment: boolean;
  bank_account_name: string | null;
  transaction_legacy_id: number | null;
}

interface ServicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ServiceEntryPaymentDialogEntry | null;
  bankAccounts: BankAccountOption[];
  onPaymentRegistered?: (payload: {
    result: { transaction_id?: string | null; is_final_payment?: boolean };
    payments: ServicePaymentRecord[];
  }) => void;
}

const formatMoney = (currency: string, amount: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);

export function ServicePaymentDialog({
  open,
  onOpenChange,
  entry,
  bankAccounts,
  onPaymentRegistered,
}: ServicePaymentDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [paymentDate, setPaymentDate] = useState(formatDateLocal(new Date()));
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [ncf, setNcf] = useState("B11");
  const [notes, setNotes] = useState("");

  const committedAmount = Number(entry?.committed_amount || 0);
  const paidAmount = Number(entry?.paid_amount || 0);
  const remainingAmount = Number(entry?.remaining_amount || Math.max(committedAmount - paidAmount, 0));

  const fetchPayments = async (serviceEntryId: string): Promise<ServicePaymentRecord[]> => {
    const { data, error } = await supabase
      .from("service_entry_payments")
      .select("id, payment_date, amount, ncf, notes, is_final_payment, bank_account_id, transaction_id, created_at")
      .eq("service_entry_id", serviceEntryId)
      .order("payment_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    const transactionIds = (data || []).map((item) => item.transaction_id).filter((value): value is string => Boolean(value));
    let transactionLegacyMap = new Map<string, number | null>();
    if (transactionIds.length > 0) {
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions").select("id, legacy_id").in("id", transactionIds);
      if (transactionError) throw transactionError;
      transactionLegacyMap = new Map((transactionData || []).map((tx) => [tx.id, tx.legacy_id]));
    }
    return (data || []).map((item) => ({
      id: item.id,
      payment_date: item.payment_date,
      amount: Number(item.amount || 0),
      ncf: item.ncf,
      notes: item.notes,
      is_final_payment: item.is_final_payment,
      bank_account_name: bankAccounts.find((account) => account.id === item.bank_account_id)?.account_name || null,
      transaction_legacy_id: item.transaction_id ? transactionLegacyMap.get(item.transaction_id) ?? null : null,
    }));
  };

  const { data: payments = [] } = useQuery({
    queryKey: ["service-entry-payments", entry?.id],
    enabled: open && !!entry,
    queryFn: async () => fetchPayments(entry!.id),
  });

  const paymentCountLabel = useMemo(() => {
    if (payments.length === 0) return t("svcPayment.noPayments");
    if (payments.length === 1) return t("svcPayment.onePayment");
    return t("svcPayment.nPayments").replace("{count}", String(payments.length));
  }, [payments.length, t]);

  useEffect(() => {
    if (!open || !entry) return;
    setPaymentDate(formatDateLocal(new Date()));
    setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : "");
    setBankAccountId(entry.pay_method || "");
    setNcf("B11");
    setNotes("");
  }, [open, entry, remainingAmount]);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error(t("svcPayment.serviceNotFound"));
      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || parsedAmount <= 0) throw new Error(t("svcPayment.invalidAmount"));
      if (!bankAccountId) throw new Error(t("svcPayment.selectAccountError"));
      if (parsedAmount > remainingAmount + 0.005) throw new Error(t("svcPayment.exceedsBalance"));

      const { data, error } = await supabase.rpc("register_service_partial_payment" as never, {
        p_service_entry_id: entry.id,
        p_payment_date: paymentDate,
        p_amount: parsedAmount,
        p_bank_account_id: bankAccountId,
        p_ncf: ncf.trim() || null,
        p_notes: notes.trim() || null,
        p_is_final_payment: false,
      } as never);
      if (error) throw error;
      const result = (data || {}) as { transaction_id?: string | null; is_final_payment?: boolean };
      if (result.transaction_id) {
        const { error: updateError } = await supabase
          .from("service_entries")
          .update({ transaction_id: result.transaction_id } as never)
          .eq("id", entry.id);
        if (updateError) throw updateError;
      }
      const updatedPayments = await fetchPayments(entry.id);
      return { result, payments: updatedPayments };
    },
    onSuccess: ({ result, payments: updatedPayments }) => {
      queryClient.invalidateQueries({ queryKey: ["service-entries"] });
      queryClient.invalidateQueries({ queryKey: ["service-provider-history"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      queryClient.invalidateQueries({ queryKey: ["service-entry-payments", entry?.id] });
      onPaymentRegistered?.({ result, payments: updatedPayments });
      toast({
        title: result.is_final_payment ? t("svcPayment.finalPayment") : t("svcPayment.partialPayment"),
        description: result.is_final_payment ? t("svcPayment.finalPaymentDesc") : t("svcPayment.partialPaymentDesc"),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: t("svcPayment.paymentError"), description: error.message, variant: "destructive" });
    },
  });

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("svcPayment.title")}</DialogTitle>
          <DialogDescription>{t("svcPayment.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("svcPayment.totalService")}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(entry.currency, committedAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("svcPayment.paid")}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(entry.currency, paidAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("svcPayment.pending")}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(entry.currency, remainingAmount)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{entry.service_providers.name}</p>
              <p className="text-sm text-muted-foreground">{entry.description || t("svcPayment.noDesc")}</p>
            </div>
            <Badge variant="outline">{paymentCountLabel}</Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("svcPayment.paymentDate")}</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("svcPayment.amount")}</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("svcPayment.paidFrom")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
            >
              <option value="">{t("svcPayment.selectAccount")}</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.account_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>NCF</Label>
            <Input value={ncf} onChange={(e) => setNcf(e.target.value)} placeholder="B11" />
          </div>
          <div className="space-y-2">
            <Label>{t("svcPayment.notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("svcPayment.notesPlaceholder")} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{t("svcPayment.paymentHistory")}</h3>
            <Badge variant="secondary">{paymentCountLabel}</Badge>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>NCF</TableHead>
                  <TableHead>{t("common.account")}</TableHead>
                  <TableHead>Trans. #</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      {t("svcPayment.noPaymentsYet")}
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.payment_date}</TableCell>
                      <TableCell>{payment.ncf || "—"}</TableCell>
                      <TableCell>{payment.bank_account_name || "—"}</TableCell>
                      <TableCell>{payment.transaction_legacy_id ? `#${payment.transaction_legacy_id}` : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(entry.currency, payment.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending || remainingAmount <= 0}>
            {paymentMutation.isPending ? t("svcPayment.saving") : t("svcPayment.registerPayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}