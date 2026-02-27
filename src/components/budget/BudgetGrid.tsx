import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getDescription } from "@/lib/getDescription";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Download, FileSpreadsheet, FileText } from "lucide-react";
import { ActualDetailDialog } from "./ActualDetailDialog";
import { useExport } from "@/hooks/useExport";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BudgetGridProps {
  budgetType: "project" | "pl";
  projectCode?: string;
  fiscalYear: number;
}

const MONTH_KEYS = [
  "month_1","month_2","month_3","month_4","month_5","month_6",
  "month_7","month_8","month_9","month_10","month_11","month_12",
] as const;

const MONTH_LABELS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LABELS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// Column widths for sticky positioning
const COL_W = [200, 120, 120, 120, 120]; // code, budget, forecast, actual, variance
const stickyLeft = COL_W.map((_, i) => COL_W.slice(0, i).reduce((a, b) => a + b, 0));

export function BudgetGrid({ budgetType, projectCode, fiscalYear }: BudgetGridProps) {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { exportToExcel, exportToPDF } = useExport();
  const monthLabels = language === "en" ? MONTH_LABELS_EN : MONTH_LABELS_ES;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCode, setDetailCode] = useState("");

  

  // Fetch line codes (CBS or expense accounts used in transactions)
  const { data: lineCodes = [] } = useQuery({
    queryKey: ["budget-line-codes", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      if (budgetType === "project") {
        const { data } = await supabase.from("cbs_codes").select("code, english_description, spanish_description").order("code");
        return (data || []).map(c => ({ code: c.code, desc: getDescription(c, language) }));
      } else {
        // Get distinct expense master_acct_codes used in transactions
        const { data: txCodes } = await supabase
          .from("transactions")
          .select("master_acct_code")
          .not("master_acct_code", "is", null)
          .eq("is_void", false);
        const uniqueCodes = [...new Set((txCodes || []).map(t => t.master_acct_code).filter(Boolean))] as string[];

        // Get account descriptions from chart_of_accounts for expense types
        const { data: accounts } = await supabase
          .from("chart_of_accounts")
          .select("account_code, english_description, spanish_description, account_type")
          .in("account_code", uniqueCodes)
          .eq("account_type", "EXPENSE")
          .is("deleted_at", null)
          .order("account_code");

        return (accounts || []).map(a => ({
          code: a.account_code,
          desc: (language === "en" ? a.english_description : a.spanish_description) || a.account_code,
        }));
      }
    },
  });

  // Fetch budget lines
  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget-lines", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      let query = supabase
        .from("budget_lines")
        .select("*")
        .eq("budget_type", budgetType)
        .eq("fiscal_year", fiscalYear);

      if (budgetType === "project") {
        query = query.eq("project_code", projectCode!);
      } else {
        query = query.is("project_code", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch actuals from transactions
  const { data: actuals = {} } = useQuery({
    queryKey: ["budget-actuals", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      const startDate = `${fiscalYear}-01-01`;
      const endDate = `${fiscalYear}-12-31`;
      let query = supabase
        .from("transactions")
        .select("cbs_code, master_acct_code, amount")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false);

      if (budgetType === "project") {
        query = query.eq("project_code", projectCode!);
      }

      const { data } = await query;
      const map: Record<string, number> = {};
      (data || []).forEach(tx => {
        const key = budgetType === "project" ? tx.cbs_code : tx.master_acct_code;
        if (key) map[key] = (map[key] || 0) + (tx.amount || 0);
      });
      return map;
    },
  });

  // Build a map of budget lines by line_code
  const lineMap: Record<string, any> = {};
  budgetLines.forEach(bl => { lineMap[bl.line_code] = bl; });

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (params: { lineCode: string; field: string; value: number }) => {
      const existing = lineMap[params.lineCode];
      if (existing) {
        const { error } = await supabase
          .from("budget_lines")
          .update({ [params.field]: params.value } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const row: any = {
          budget_type: budgetType,
          project_code: budgetType === "project" ? projectCode : null,
          fiscal_year: fiscalYear,
          line_code: params.lineCode,
          [params.field]: params.value,
          created_by: user?.id || null,
        };
        const { error } = await supabase.from("budget_lines").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines", budgetType, projectCode, fiscalYear] });
    },
    onError: () => {
      toast.error(t("common.saving") + " error");
    },
  });

  const handleBlur = useCallback(
    (lineCode: string, field: string, value: string) => {
      const num = parseFloat(value) || 0;
      const existing = lineMap[lineCode];
      const current = existing ? (existing[field] ?? 0) : 0;
      if (num !== current) {
        upsertMutation.mutate({ lineCode, field, value: num });
      }
    },
    [lineMap, upsertMutation]
  );

  const stickyClass = (colIndex: number) =>
    cn("sticky z-20 bg-background border-r border-border", `left-[${stickyLeft[colIndex]}px]`);

  // Compute totals
  const totals = {
    budget: 0, forecast: 0, actual: 0,
    months: new Array(12).fill(0),
  };
  lineCodes.forEach(lc => {
    const bl = lineMap[lc.code];
    totals.budget += bl?.annual_budget ?? 0;
    totals.forecast += bl?.current_forecast ?? 0;
    totals.actual += actuals[lc.code] ?? 0;
    MONTH_KEYS.forEach((mk, mi) => {
      totals.months[mi] += bl?.[mk] ?? 0;
    });
  });
  const totalVariance = totals.forecast - totals.actual;

  // Export logic
  const tabLabel = budgetType === "pl" ? t("budget.pl") : projectCode || "";
  const exportConfig = {
    filename: `presupuesto-${tabLabel}-${fiscalYear}`,
    title: `${t("page.budget.title")} — ${tabLabel} ${fiscalYear}`,
    orientation: "landscape" as const,
    fontSize: 6,
  };

  const buildExportData = useCallback(() => {
    const columns = [
      { key: "code", header: t("budget.code"), width: 30 },
      { key: "budget", header: t("budget.annual"), width: 14 },
      { key: "forecast", header: t("budget.forecast"), width: 14 },
      { key: "actual", header: t("budget.actual"), width: 14 },
      { key: "variance", header: t("budget.variance"), width: 14 },
      ...monthLabels.map((m, i) => ({ key: `m${i}`, header: m, width: 12 })),
    ];

    const rows = lineCodes.map(lc => {
      const bl = lineMap[lc.code];
      const actualVal = actuals[lc.code] ?? 0;
      const forecastVal = bl?.current_forecast ?? 0;
      const row: Record<string, string | number> = {
        code: `${lc.code} — ${lc.desc}`,
        budget: bl?.annual_budget ?? 0,
        forecast: forecastVal,
        actual: actualVal,
        variance: forecastVal - actualVal,
      };
      MONTH_KEYS.forEach((mk, mi) => { row[`m${mi}`] = bl?.[mk] ?? 0; });
      return row;
    });

    const totalsRow: Record<string, string | number> = {
      code: t("common.total"),
      budget: totals.budget,
      forecast: totals.forecast,
      actual: totals.actual,
      variance: totalVariance,
    };
    totals.months.forEach((mv, mi) => { totalsRow[`m${mi}`] = mv; });

    return { columns, rows, totalsRow };
  }, [lineCodes, lineMap, actuals, totals, totalVariance, monthLabels, t]);

  return (
    <div className="relative">
      {/* Export button */}
      <div className="flex justify-end mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              {t("common.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToExcel(buildExportData(), exportConfig)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToPDF(buildExportData(), exportConfig)}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Scrollable wrapper */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-max min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              {/* Sticky columns */}
              <th className="sticky left-0 z-30 bg-muted/50 border-r border-b px-3 py-2 text-left font-medium whitespace-nowrap" style={{ minWidth: COL_W[0], width: COL_W[0] }}>
                {t("budget.code")}
              </th>
              <th className="sticky z-30 bg-muted/50 border-r border-b px-3 py-2 text-right font-medium whitespace-nowrap" style={{ left: stickyLeft[1], minWidth: COL_W[1], width: COL_W[1] }}>
                {t("budget.annual")}
              </th>
              <th className="sticky z-30 bg-muted/50 border-r border-b px-3 py-2 text-right font-medium whitespace-nowrap" style={{ left: stickyLeft[2], minWidth: COL_W[2], width: COL_W[2] }}>
                {t("budget.forecast")}
              </th>
              <th className="sticky z-30 bg-muted/50 border-r border-b px-3 py-2 text-right font-medium whitespace-nowrap" style={{ left: stickyLeft[3], minWidth: COL_W[3], width: COL_W[3] }}>
                {t("budget.actual")}
              </th>
              <th className="sticky z-30 bg-muted/50 border-r border-b px-3 py-2 text-right font-medium whitespace-nowrap" style={{ left: stickyLeft[4], minWidth: COL_W[4], width: COL_W[4] }}>
                {t("budget.variance")}
              </th>
              {/* Month columns */}
              {monthLabels.map((m, i) => (
                <th key={i} className="border-b px-3 py-2 text-right font-medium whitespace-nowrap" style={{ minWidth: 100 }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineCodes.map(lc => {
              const bl = lineMap[lc.code];
              const actualVal = actuals[lc.code] ?? 0;
              const forecastVal = bl?.current_forecast ?? 0;
              const variance = forecastVal - actualVal;

              return (
                <tr key={lc.code} className="border-b hover:bg-muted/30">
                  {/* Col 1: Code + description */}
                  <td className="sticky left-0 z-20 bg-background border-r px-3 py-1.5 whitespace-nowrap" style={{ minWidth: COL_W[0] }}>
                    <span className="font-mono text-xs">{lc.code}</span>
                    <span className="ml-2 text-muted-foreground text-xs truncate">{lc.desc}</span>
                  </td>
                  {/* Col 2: Annual budget */}
                  <td className="sticky z-20 bg-background border-r px-1 py-1" style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
                    <Input
                      type="number"
                      defaultValue={bl?.annual_budget ?? 0}
                      className="h-7 text-right text-xs font-mono"
                      onBlur={e => handleBlur(lc.code, "annual_budget", e.target.value)}
                    />
                  </td>
                  {/* Col 3: Forecast */}
                  <td className="sticky z-20 bg-background border-r px-1 py-1" style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
                    <Input
                      type="number"
                      defaultValue={bl?.current_forecast ?? 0}
                      className="h-7 text-right text-xs font-mono"
                      onBlur={e => handleBlur(lc.code, "current_forecast", e.target.value)}
                    />
                  </td>
                  {/* Col 4: Actual */}
                  <td className="sticky z-20 bg-background border-r px-3 py-1.5 text-right font-mono text-xs" style={{ left: stickyLeft[3], minWidth: COL_W[3] }}>
                    <button
                      onClick={() => { setDetailCode(lc.code); setDetailOpen(true); }}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      {actualVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      <Search className="h-3 w-3" />
                    </button>
                  </td>
                  {/* Col 5: Variance */}
                  <td
                    className={cn(
                      "sticky z-20 bg-background border-r px-3 py-1.5 text-right font-mono text-xs font-semibold",
                      variance >= 0 ? "text-green-600" : "text-red-600"
                    )}
                    style={{ left: stickyLeft[4], minWidth: COL_W[4] }}
                  >
                    {variance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  {/* Months */}
                  {MONTH_KEYS.map((mk, mi) => (
                    <td key={mi} className="px-1 py-1" style={{ minWidth: 100 }}>
                      <Input
                        type="number"
                        defaultValue={bl?.[mk] ?? 0}
                        className="h-7 text-right text-xs font-mono"
                        onBlur={e => handleBlur(lc.code, mk, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="border-t-2 font-bold bg-muted/30">
              <td className="sticky left-0 z-20 bg-muted/30 border-r px-3 py-2 text-sm" style={{ minWidth: COL_W[0] }}>
                {t("common.total")}
              </td>
              <td className="sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs" style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
                {totals.budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
              <td className="sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs" style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
                {totals.forecast.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
              <td className="sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs" style={{ left: stickyLeft[3], minWidth: COL_W[3] }}>
                {totals.actual.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
              <td className={cn(
                "sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs",
                totalVariance >= 0 ? "text-green-600" : "text-red-600"
              )} style={{ left: stickyLeft[4], minWidth: COL_W[4] }}>
                {totalVariance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
              {totals.months.map((mv, mi) => (
                <td key={mi} className="px-3 py-2 text-right font-mono text-xs" style={{ minWidth: 100 }}>
                  {mv.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <ActualDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        lineCode={detailCode}
        budgetType={budgetType}
        projectCode={projectCode}
        fiscalYear={fiscalYear}
      />
    </div>
  );
}
