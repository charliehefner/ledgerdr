import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

/* ── Auto-categorization rules ── */
const AUTO_RULES: { pattern: RegExp; accountCode: string; label: string }[] = [
  { pattern: /COMISI[OÓ]N/i, accountCode: "6520", label: "Cargos Bancarios" },
  { pattern: /IMPUESTO\s*LEY/i, accountCode: "6530", label: "Impuestos y Tasas" },
  { pattern: /ITBIS/i, accountCode: "1650", label: "ITBIS Pagado" },
  { pattern: /INTER[EÉ]S/i, accountCode: "6510", label: "Gastos por Intereses" },
];

export function matchAutoCategory(description: string | null): string | null {
  if (!description) return null;
  for (const rule of AUTO_RULES) {
    if (rule.pattern.test(description)) return rule.accountCode;
  }
  return null;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  line: {
    id: string;
    statement_date: string;
    description: string | null;
    amount: number;
  };
  bankAccountId: string;
};

export function QuickEntryDialog({ open, onOpenChange, line, bankAccountId }: Props) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [description, setDescription] = useState(line.description || "");

  // Fetch postable accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-postable-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch bank account's linked GL account
  const { data: bankAccount } = useQuery({
    queryKey: ["bank-account-gl", bankAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("chart_account_id")
        .eq("id", bankAccountId)
        .single();
      if (error) throw error;
      return data as unknown as { chart_account_id: string | null };
    },
  });

  // Auto-select account based on description
  useEffect(() => {
    const suggestedCode = matchAutoCategory(line.description);
    if (suggestedCode && accounts.length > 0) {
      const match = accounts.find(a => a.account_code === suggestedCode);
      if (match) setSelectedAccountId(match.id);
    }
  }, [line.description, accounts]);

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const bankGLId = bankAccount?.chart_account_id;
      if (!bankGLId) throw new Error(t("quickEntry.noLinkedAccountError"));
      if (!selectedAccountId) throw new Error(t("quickEntry.selectAccountError"));

      const absAmount = Math.abs(line.amount);
      const isExpense = line.amount < 0;

      const { data: journal, error: jErr } = await supabase
        .from("journals")
        .insert({
          journal_date: line.statement_date,
          journal_type: "GJ",
          description: description || line.description || t("quickEntry.bankCharge"),
          approval_status: "pending",
          is_reconciled: true,
        } as any)
        .select("id")
        .single();
      if (jErr) throw jErr;

      const lines = isExpense
        ? [
            { journal_id: journal.id, account_id: selectedAccountId, debit: absAmount, credit: 0 },
            { journal_id: journal.id, account_id: bankGLId, debit: 0, credit: absAmount },
          ]
        : [
            { journal_id: journal.id, account_id: bankGLId, debit: absAmount, credit: 0 },
            { journal_id: journal.id, account_id: selectedAccountId, debit: 0, credit: absAmount },
          ];

      const { error: lErr } = await supabase.from("journal_lines").insert(lines as any);
      if (lErr) throw lErr;

      const { error: uErr } = await supabase
        .from("bank_statement_lines" as any)
        .update({ is_reconciled: true, matched_journal_id: journal.id } as any)
        .eq("id", line.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-lines"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: t("quickEntry.created") });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const suggestedCode = matchAutoCategory(line.description);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("quickEntry.title")}</DialogTitle>
          <DialogDescription>
            {t("quickEntry.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("quickEntry.date")}</Label>
              <Input value={line.statement_date} disabled />
            </div>
            <div>
              <Label>{t("quickEntry.amount")}</Label>
              <Input value={line.amount.toLocaleString("es-DO", { minimumFractionDigits: 2 })} disabled />
            </div>
          </div>

          <div>
            <Label>{t("quickEntry.description")}</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <Label>
              {t("quickEntry.glAccount")}
              {suggestedCode && selectedAccount?.account_code === suggestedCode && (
                <span className="ml-2 text-xs text-muted-foreground">{t("quickEntry.autoSuggested")}</span>
              )}
            </Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t("quickEntry.selectAccount")} />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-60">
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_code} — {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!bankAccount?.chart_account_id && (
            <p className="text-xs text-destructive">
              {t("quickEntry.noLinkedAccount")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !selectedAccountId || !bankAccount?.chart_account_id}
          >
            {createMutation.isPending ? t("quickEntry.creating") : t("quickEntry.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
