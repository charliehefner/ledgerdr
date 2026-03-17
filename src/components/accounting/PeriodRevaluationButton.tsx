import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: string;
}

export function PeriodRevaluationButton({ periodId, periodName, startDate, endDate, status }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<{ rate: number; total: number; count: number } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const openConfirm = async () => {
    try {
      const { data: rateRow, error: rateErr } = await supabase
        .from("exchange_rates")
        .select("sell_rate")
        .eq("currency_pair", "USD/DOP")
        .lte("rate_date", endDate)
        .order("rate_date", { ascending: false })
        .limit(1)
        .single();

      if (rateErr || !rateRow) {
        toast({ title: "Error", description: t("accounting.reval.noRate"), variant: "destructive" });
        return;
      }

      const { data: balances, error: balErr } = await supabase.rpc("foreign_currency_balances", {
        p_start: startDate,
        p_end: endDate,
      });

      if (balErr) throw balErr;

      if (!balances || balances.length === 0) {
        toast({ title: t("accounting.reval.noBalances") });
        return;
      }

      let totalAdj = 0;
      (balances as any[]).forEach((b) => {
        totalAdj += (b.usd_balance * rateRow.sell_rate) - b.booked_dop_total;
      });

      setPreview({ rate: rateRow.sell_rate, total: totalAdj, count: balances.length });
      setConfirmOpen(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const revalMutation = useMutation({
    mutationFn: async () => {
      const { data: rateRow } = await supabase
        .from("exchange_rates")
        .select("sell_rate")
        .eq("currency_pair", "USD/DOP")
        .lte("rate_date", endDate)
        .order("rate_date", { ascending: false })
        .limit(1)
        .single();

      if (!rateRow) throw new Error("No exchange rate found");
      const closingRate = rateRow.sell_rate;

      const { data: balances, error: balErr } = await supabase.rpc("foreign_currency_balances", {
        p_start: startDate,
        p_end: endDate,
      });
      if (balErr) throw balErr;
      if (!balances || balances.length === 0) throw new Error("No foreign currency balances");

      const { data: fxAcct, error: fxErr } = await supabase
        .from("chart_of_accounts")
        .select("id")
        .is("deleted_at", null)
        .eq("account_code", "8510")
        .single();
      if (fxErr || !fxAcct) throw new Error("No se encontró cuenta 8510 — Diferencia Cambiaria");

      const { data: journal, error: jErr } = await supabase
        .from("journals")
        .insert({
          journal_date: endDate,
          journal_type: "ADJ",
          currency: "DOP",
          exchange_rate: 1,
          description: `Revaluación cambiaria — ${periodName} (Tasa: ${closingRate})`,
          posted: false,
          created_by: user?.id,
          period_id: periodId,
        })
        .select("id")
        .single();
      if (jErr) throw jErr;

      const lines: any[] = [];
      let totalAdj = 0;

      (balances as any[]).forEach((b) => {
        const adj = (b.usd_balance * closingRate) - b.booked_dop_total;
        if (Math.abs(adj) < 0.01) return;
        totalAdj += adj;

        lines.push({
          journal_id: journal.id,
          account_id: b.account_id,
          debit: adj > 0 ? Math.round(adj * 100) / 100 : 0,
          credit: adj < 0 ? Math.round(Math.abs(adj) * 100) / 100 : 0,
        });
      });

      if (Math.abs(totalAdj) >= 0.01) {
        lines.push({
          journal_id: journal.id,
          account_id: fxAcct.id,
          debit: totalAdj < 0 ? Math.round(Math.abs(totalAdj) * 100) / 100 : 0,
          credit: totalAdj > 0 ? Math.round(totalAdj * 100) / 100 : 0,
        });
      }

      if (lines.length === 0) throw new Error("No hay ajustes a generar");

      const { error: lErr } = await supabase.from("journal_lines").insert(lines);
      if (lErr) throw lErr;

      await supabase.from("revaluation_log").insert({
        period_id: periodId,
        journal_id: journal.id,
        revaluation_date: endDate,
        closing_rate: closingRate,
        total_adjustment: Math.round(totalAdj * 100) / 100,
        created_by: user?.id,
      } as any);

      return { lineCount: lines.length, totalAdj };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-periods"] });
      const formatted = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(result.totalAdj);
      toast({
        title: t("accounting.reval.generated"),
        description: t("accounting.reval.generatedDesc").replace("{count}", String(result.lineCount)).replace("{amount}", formatted),
      });
      setConfirmOpen(false);
      setPreview(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (status === "reported" || status === "locked") return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openConfirm}
        disabled={revalMutation.isPending}
      >
        {revalMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
        {t("accounting.reval.button")}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounting.reval.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {t("accounting.reval.description").replace("{period}", periodName)}
                </p>
                {preview && (
                  <div className="bg-muted rounded-md p-3 text-sm space-y-1">
                    <p><strong>{t("accounting.reval.closingRate")}</strong> {preview.rate.toFixed(4)} DOP/USD</p>
                    <p><strong>{t("accounting.reval.accountsToRevalue")}</strong> {preview.count}</p>
                    <p><strong>{t("accounting.reval.estimatedAdj")}</strong> {new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(preview.total)}</p>
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  {t("accounting.reval.reviewNote")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => revalMutation.mutate()}>
              {t("accounting.closing.generateDraft")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
