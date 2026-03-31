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
      // Resolve lineCode to UUID for FK-based filtering
      let accountFilter: { column: string; value: string } | null = null;

      if (budgetType === "project") {
        const { data: cbsRow } = await supabase
          .from("cbs_codes")
          .select("id")
          .eq("code", lineCode)
          .maybeSingle();
        if (cbsRow) {
          accountFilter = { column: "cbs_id", value: cbsRow.id };
        } else {
          accountFilter = { column: "cbs_code", value: lineCode };
        }
      } else {
        const { data: acctRow } = await supabase
          .from("chart_of_accounts")
          .select("id")
          .eq("account_code", lineCode)
          .is("deleted_at", null)
          .maybeSingle();
        if (acctRow) {
          accountFilter = { column: "account_id", value: acctRow.id };
        } else {
          accountFilter = { column: "master_acct_code", value: lineCode };
        }
      }

      let query = supabase
        .from("transactions")
        .select("id, legacy_id, transaction_date, name, amount, currency")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false) as any;

      if (budgetType === "project") {
        query = query.eq("project_code", projectCode!);
      }

      query = query.eq(accountFilter.column, accountFilter.value);

      const { data, error } = await query.order("transaction_date", { ascending: true });
      if (error) throw error;
      const txns = data || [];

      // Fetch BCRD daily exchange rates for the fiscal year
      const { data: rates } = await supabase
        .from("exchange_rates")
        .select("rate_date, sell_rate")
        .eq("currency_pair", "USD/DOP")
        .gte("rate_date", startDate)
        .lte("rate_date", endDate);

      const rateByDate: Record<string, number> = {};
      (rates || []).forEach(r => {
        rateByDate[r.rate_date] = r.sell_rate;
      });

      const sortedDates = Object.keys(rateByDate).sort();

      const findRate = (dateStr: string): number => {
        if (rateByDate[dateStr]) return rateByDate[dateStr];
        for (let i = sortedDates.length - 1; i >= 0; i--) {
          if (sortedDates[i] <= dateStr) return rateByDate[sortedDates[i]];
        }
        return sortedDates.length > 0 ? rateByDate[sortedDates[0]] : 1;
      };

      return txns.map(tx => ({
        ...tx,
        exchange_rate: (tx.currency && tx.currency !== 'DOP') ? findRate(tx.transaction_date) : 1,
        dop_amount: (tx.amount || 0) * ((tx.currency && tx.currency !== 'DOP') ? findRate(tx.transaction_date) : 1),
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
                    {(tx.dop_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    {tx.currency && tx.currency !== 'DOP' && (
                      <span className="text-muted-foreground text-[10px] ml-1">
                        ({tx.currency} @{tx.exchange_rate?.toFixed(2)})
                      </span>
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
