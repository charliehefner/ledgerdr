import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface ActualDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineCode: string;
  budgetType: "project" | "pl";
  projectCode?: string;
  fiscalYear: number;
}

export function ActualDetailDialog({
  open,
  onOpenChange,
  lineCode,
  budgetType,
  projectCode,
  fiscalYear,
}: ActualDetailDialogProps) {
  const { t } = useLanguage();
  const startDate = `${fiscalYear}-01-01`;
  const endDate = `${fiscalYear}-12-31`;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["budget-actual-detail", budgetType, projectCode, lineCode, fiscalYear],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("id, legacy_id, transaction_date, name, amount, currency")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false);

      if (budgetType === "project") {
        query = query.eq("project_code", projectCode!).eq("cbs_code", lineCode);
      } else {
        query = query.eq("master_acct_code", lineCode);
      }

      const { data, error } = await query.order("transaction_date", { ascending: true });
      if (error) throw error;
      const txns = data || [];

      // Fetch exchange rates from journals for foreign-currency transactions
      const foreignIds = txns.filter(t => t.currency && t.currency !== 'DOP').map(t => t.id);
      const rateMap: Record<string, number> = {};
      if (foreignIds.length > 0) {
        const { data: journals } = await supabase
          .from("journals")
          .select("transaction_source_id, exchange_rate")
          .in("transaction_source_id", foreignIds);
        (journals || []).forEach(j => {
          if (j.transaction_source_id && j.exchange_rate) {
            rateMap[j.transaction_source_id] = j.exchange_rate;
          }
        });
      }

      return txns.map(tx => ({
        ...tx,
        dop_amount: (tx.amount || 0) * ((tx.currency && tx.currency !== 'DOP') ? (rateMap[tx.id] || 1) : 1),
      }));
    },
    enabled: open,
  });

  const total = transactions.reduce((s, t) => s + (t.dop_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t("budget.actualDetail")} — {lineCode}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        ) : transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("common.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{tx.legacy_id ?? "—"}</TableCell>
                  <TableCell>{format(new Date(tx.transaction_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{tx.name || "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {toDop(tx).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    {tx.currency && tx.currency !== 'DOP' && (
                      <span className="text-muted-foreground text-[10px] ml-1">({tx.currency})</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={3} className="text-right">{t("common.total")}</TableCell>
                <TableCell className="text-right font-mono">
                  {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
