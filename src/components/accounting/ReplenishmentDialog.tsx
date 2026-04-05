import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";

type PettyCashAccount = {
  id: string;
  account_name: string;
  fixed_amount: number | null;
  currency: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: PettyCashAccount | null;
};

const fmtNum = (n: number) =>
  n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReplenishmentDialog({ open, onOpenChange, fund }: Props) {
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();
  const queryClient = useQueryClient();
  const [cashCounted, setCashCounted] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");

  const fixedAmount = fund?.fixed_amount ?? 0;

  const { data: sourceAccounts = [] } = useQuery({
    queryKey: ["replenish-source-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, currency")
        .eq("is_active", true)
        .in("account_type", ["checking", "savings"])
        .order("account_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: lastReplenishment } = useQuery({
    queryKey: ["last-replenishment", fund?.id],
    queryFn: async () => {
      if (!fund) return null;
      const { data, error } = await supabase
        .from("transactions")
        .select("transaction_date")
        .eq("destination_acct_code", fund.id)
        .neq("pay_method", "petty_cash")
        .order("transaction_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.transaction_date || null;
    },
    enabled: open && !!fund,
  });

  const { data: expensesSinceRecharge = 0 } = useQuery({
    queryKey: ["petty-cash-expenses-since", fund?.id, lastReplenishment],
    queryFn: async () => {
      if (!fund) return 0;
      let query = supabase
        .from("transactions")
        .select("amount")
        .eq("pay_method", "petty_cash");

      if (lastReplenishment) {
        query = query.gt("transaction_date", lastReplenishment);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
    },
    enabled: open && !!fund,
  });

  const expectedCash = fixedAmount - expensesSinceRecharge;
  const counted = parseFloat(cashCounted) || 0;
  const overShort = counted - expectedCash;
  const replenishmentAmount = fixedAmount - counted;

  const createTransferMutation = useMutation({
    mutationFn: async () => {
      if (!fund || !sourceAccountId || replenishmentAmount <= 0) {
        throw new Error(t("treasury.replenish.incomplete"));
      }

      const today = new Date().toISOString().split("T")[0];
      const overShortNote = Math.abs(overShort) > 0.005
        ? ` | ${t("treasury.replenish.overShort")} ${fmtNum(overShort)}`
        : "";

      const { error } = await supabase.from("transactions").insert({
        transaction_date: today,
        description: `${t("treasury.replenish.submit")}: ${fund.account_name}${overShortNote}`,
        amount: replenishmentAmount,
        currency: fund.currency || "DOP",
        transaction_direction: "payment",
        is_internal: true,
        pay_method: sourceAccountId,
        destination_acct_code: fund.id,
        account_code: "0000",
        name: fund.account_name,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty-cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["last-replenishment"] });
      queryClient.invalidateQueries({ queryKey: ["petty-cash-expenses-since"] });
      toast.success(t("treasury.replenish.success"));
      setCashCounted("");
      setSourceAccountId("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !!sourceAccountId && replenishmentAmount > 0 && !createTransferMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("treasury.replenish.title").replace("{name}", fund?.account_name || "")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-muted-foreground">{t("treasury.replenish.fixedAmount")}</div>
            <div className="font-mono font-semibold text-right">{fmtNum(fixedAmount)}</div>

            <div className="text-muted-foreground">{t("treasury.replenish.expensesSince")}</div>
            <div className="font-mono text-right">{fmtNum(expensesSinceRecharge)}</div>

            <div className="text-muted-foreground">{t("treasury.replenish.expectedCash")}</div>
            <div className="font-mono text-right">{fmtNum(expectedCash)}</div>
          </div>

          <div className="border-t pt-4">
            <Label>{t("treasury.replenish.cashCounted")}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cashCounted}
              onChange={e => setCashCounted(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>

          {cashCounted && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-muted-foreground">{t("treasury.replenish.overShort")}</div>
              <div className="text-right font-mono flex items-center justify-end gap-1">
                {Math.abs(overShort) < 0.005 ? (
                  <><CheckCircle className="h-4 w-4 text-primary" /> <span className="text-primary">0.00</span></>
                ) : overShort > 0 ? (
                  <Badge variant="secondary">
                    +{fmtNum(overShort)} {t("treasury.replenish.over")}
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    {fmtNum(overShort)} {t("treasury.replenish.short")}
                  </Badge>
                )}
              </div>

              <div className="text-muted-foreground font-medium">{t("treasury.replenish.amountToReplenish")}</div>
              <div className="text-right font-mono font-bold text-lg">
                {replenishmentAmount > 0 ? fmtNum(replenishmentAmount) : "0.00"}
              </div>
            </div>
          )}

          {Math.abs(overShort) > 0.005 && cashCounted && (
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                {t("treasury.replenish.overShortNote").replace("{amount}", fmtNum(Math.abs(overShort)))}
              </span>
            </div>
          )}

          <div className="border-t pt-4">
            <Label>{t("treasury.replenish.sourceAccount")}</Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger><SelectValue placeholder={t("treasury.replenish.selectBank")} /></SelectTrigger>
              <SelectContent className="bg-popover">
                {sourceAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name} ({a.currency || "DOP"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("treasury.replenish.cancel")}</Button>
          <Button onClick={() => createTransferMutation.mutate()} disabled={!canSubmit}>
            {createTransferMutation.isPending ? t("treasury.replenish.processing") : t("treasury.replenish.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
