import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";

type PettyCashAccount = {
  id: string;
  account_name: string;
  currency: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: PettyCashAccount | null;
};

const todayISO = () => new Date().toISOString().split("T")[0];

export function CashAdjustmentDialog({ open, onOpenChange, fund }: Props) {
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"sobra" | "falta">("falta");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setType("falta");
      setAmount("");
      setDate(todayISO());
      setReason("");
    }
  }, [open]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!fund) throw new Error("No fund");
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error(t("treasury.adjust.errAmount"));
      if (!reason.trim()) throw new Error(t("treasury.adjust.errReason"));

      const isFalta = type === "falta";
      const labelPrefix = isFalta
        ? t("treasury.adjust.faltaPrefix")
        : t("treasury.adjust.sobraPrefix");

      const payload: any = {
        transaction_date: date,
        description: `${labelPrefix}: ${reason.trim()}`,
        amount: amt,
        currency: fund.currency || "DOP",
        master_acct_code: isFalta ? "7990" : "3990",
        transaction_direction: isFalta ? "purchase" : "payment",
        pay_method: isFalta ? fund.id : "coa:3990",
        destination_acct_code: isFalta ? null : fund.id,
        name: fund.account_name,
        ...(selectedEntityId ? { entity_id: selectedEntityId } : {}),
      };

      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty-cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["petty-cash-gl-balances"] });
      queryClient.invalidateQueries({ queryKey: ["last-replenishment"] });
      queryClient.invalidateQueries({ queryKey: ["petty-cash-expenses-since"] });
      toast.success(t("treasury.adjust.success"));
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accountCode = type === "falta" ? "7990" : "3990";
  const accountName = type === "falta"
    ? "Otros gastos de explotación"
    : "Otras remuneraciones, subvenciones e ingresos";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("treasury.adjust.title").replace("{name}", fund?.account_name || "")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">{t("treasury.adjust.type")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("falta")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border-2 p-3 text-sm font-medium transition-colors",
                  type === "falta"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <TrendingDown className="h-4 w-4" />
                {t("treasury.adjust.falta")}
              </button>
              <button
                type="button"
                onClick={() => setType("sobra")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border-2 p-3 text-sm font-medium transition-colors",
                  type === "sobra"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                {t("treasury.adjust.sobra")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("treasury.adjust.amount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>
            <div>
              <Label>{t("treasury.adjust.date")}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t("treasury.adjust.reason")}</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t("treasury.adjust.reasonPlaceholder")}
              rows={3}
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            {t("treasury.adjust.glHint")
              .replace("{code}", accountCode)
              .replace("{name}", accountName)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("treasury.bank.cancel")}
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !amount || !reason.trim()}
          >
            {submitMutation.isPending ? t("treasury.bank.saving") : t("treasury.adjust.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
