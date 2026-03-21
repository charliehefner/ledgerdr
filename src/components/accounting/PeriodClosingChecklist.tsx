import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

type CheckResult = {
  key: string;
  label: string;
  count: number;
  blocking: boolean;
  loading: boolean;
};

interface PeriodClosingChecklistProps {
  periodId: string;
  startDate: string;
  endDate: string;
  nextStatusLabel: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function PeriodClosingChecklist({
  startDate,
  endDate,
  nextStatusLabel,
  onConfirm,
  isPending,
}: PeriodClosingChecklistProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runChecks = async () => {
    setLoading(true);
    const results: CheckResult[] = [
      { key: "unlinked", label: t("accounting.checklist.unlinked"), count: 0, blocking: true, loading: true },
      { key: "unposted", label: t("accounting.checklist.unposted"), count: 0, blocking: true, loading: true },
      { key: "missingFx", label: t("accounting.checklist.missingFx"), count: 0, blocking: true, loading: true },
      { key: "unreconciled", label: t("accounting.checklist.unreconciled"), count: 0, blocking: false, loading: true },
    ];
    setChecks([...results]);

    // 1. Unlinked transactions
    const { data: unlinkedCount } = await supabase.rpc("count_unlinked_transactions", {
      p_start: startDate,
      p_end: endDate,
    });
    results[0] = { ...results[0], count: (unlinkedCount as number) ?? 0, loading: false };
    setChecks([...results]);

    // 2. Unposted journals
    const { count: unpostedCount } = await supabase
      .from("journals")
      .select("id", { count: "exact", head: true })
      .eq("posted", false)
      .is("deleted_at", null)
      .gte("journal_date", startDate)
      .lte("journal_date", endDate);
    results[1] = { ...results[1], count: unpostedCount ?? 0, loading: false };
    setChecks([...results]);

    // 3. Missing exchange rates on USD transactions
    const { count: missingFxCount } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("currency", "USD")
      .eq("is_void", false)
      .is("exchange_rate", null)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate);
    results[2] = { ...results[2], count: missingFxCount ?? 0, loading: false };
    setChecks([...results]);

    // 4. Unreconciled bank lines (warning only)
    const { count: unreconciledCount } = await supabase
      .from("bank_statement_lines")
      .select("id", { count: "exact", head: true })
      .eq("is_reconciled", false)
      .gte("statement_date", startDate)
      .lte("statement_date", endDate);
    results[3] = { ...results[3], count: unreconciledCount ?? 0, loading: false };
    setChecks([...results]);

    setLoading(false);
  };

  useEffect(() => {
    if (open) runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasBlockers = checks.some(c => c.blocking && c.count > 0 && !c.loading);
  const anyLoading = checks.some(c => c.loading);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          → {nextStatusLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("accounting.checklist.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("accounting.checklist.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          {checks.map((check) => (
            <div key={check.key} className="flex items-center gap-3 text-sm">
              {check.loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : check.count === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : check.blocking ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="flex-1">{check.label}</span>
              {!check.loading && (
                <span className={`font-mono text-xs ${
                  check.count === 0
                    ? "text-green-600"
                    : check.blocking
                    ? "text-destructive"
                    : "text-yellow-600"
                }`}>
                  {check.count}
                </span>
              )}
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
            disabled={hasBlockers || anyLoading || isPending}
          >
            {isPending ? t("common.loading") : `→ ${nextStatusLabel}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
