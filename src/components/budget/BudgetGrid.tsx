import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getDescription } from "@/lib/getDescription";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Download, FileSpreadsheet, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { ActualDetailDialog } from "./ActualDetailDialog";
import { AccountSelector } from "./AccountSelector";
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
const COL_W = [140, 120, 120, 120, 120]; // code, budget, forecast, actual, variance
const stickyLeft = COL_W.map((_, i) => COL_W.slice(0, i).reduce((a, b) => a + b, 0));

/** P&L section definitions for the corporate template layout */
type PLSectionType = "accounts" | "subtotal" | "computed";

interface PLSection {
  key: string;
  labelKey: string;
  type: PLSectionType;
  /** For "accounts" sections: match account codes starting with these prefixes */
  codePrefixes?: string[];
  /** For "accounts" sections: filter by account_type */
  accountTypes?: string[];
  /** Sign multiplier: +1 for revenue, -1 for cost. Used in computed rows. */
  sign?: number;
  /** For "computed" rows: which subtotal keys to sum (with their signs) */
  computeFrom?: { key: string; sign: number }[];
}

const PL_SECTIONS: PLSection[] = [
  // Revenue
  { key: "netSales", labelKey: "budget.section.netSales", type: "accounts", codePrefixes: ["30","31","32","33","34","35","36","37","38"], accountTypes: ["INCOME","REVENUE"], sign: 1 },
  { key: "totalRevenue", labelKey: "budget.section.totalRevenue", type: "subtotal", computeFrom: [{ key: "netSales", sign: 1 }] },

  // Costs
  { key: "rawMaterial", labelKey: "budget.section.rawMaterial", type: "accounts", codePrefixes: ["40","41","42","43","44","45","46","47","48"], accountTypes: ["EXPENSE","COST_OF_GOODS_SOLD"], sign: -1 },
  { key: "otherExternal", labelKey: "budget.section.otherExternal", type: "accounts", codePrefixes: ["50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "personnelCost", labelKey: "budget.section.personnelCost", type: "accounts", codePrefixes: ["70","71","72","73","74","75","76"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "depreciation", labelKey: "budget.section.depreciation", type: "accounts", codePrefixes: ["77","78"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "totalCost", labelKey: "budget.section.totalCost", type: "subtotal", computeFrom: [{ key: "rawMaterial", sign: 1 },{ key: "otherExternal", sign: 1 },{ key: "personnelCost", sign: 1 },{ key: "depreciation", sign: 1 }] },

  // Operating profit
  { key: "operatingProfit", labelKey: "budget.section.operatingProfit", type: "computed", computeFrom: [{ key: "totalRevenue", sign: 1 },{ key: "totalCost", sign: 1 }] },

  // Financial items
  { key: "interestIncome", labelKey: "budget.section.interestIncome", type: "accounts", codePrefixes: ["80","81","82","831","834","835","836","837","838","839"], accountTypes: ["INCOME","REVENUE"], sign: 1 },
  { key: "interestExpense", labelKey: "budget.section.interestExpense", type: "accounts", codePrefixes: ["841","842","844","845","846"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "realizedFx", labelKey: "budget.section.realizedFx", type: "accounts", codePrefixes: ["833","843"], sign: 1 },
  { key: "unrealizedFx", labelKey: "budget.section.unrealizedFx", type: "accounts", codePrefixes: ["851"], sign: -1 },
  { key: "totalFinancial", labelKey: "budget.section.totalFinancial", type: "subtotal", computeFrom: [{ key: "interestIncome", sign: 1 },{ key: "interestExpense", sign: 1 },{ key: "realizedFx", sign: 1 },{ key: "unrealizedFx", sign: 1 }] },
  { key: "profitAfterFinancial", labelKey: "budget.section.profitAfterFinancial", type: "computed", computeFrom: [{ key: "operatingProfit", sign: 1 },{ key: "totalFinancial", sign: 1 }] },

  // Appropriations (88xx are EQUITY type)
  { key: "appropriations", labelKey: "budget.section.appropriations", type: "accounts", codePrefixes: ["88"], accountTypes: ["EQUITY"], sign: -1 },
  { key: "totalAppropriations", labelKey: "budget.section.totalAppropriations", type: "subtotal", computeFrom: [{ key: "appropriations", sign: 1 }] },
  { key: "profitBeforeTax", labelKey: "budget.section.profitBeforeTax", type: "computed", computeFrom: [{ key: "profitAfterFinancial", sign: 1 },{ key: "totalAppropriations", sign: 1 }] },

  // Tax
  { key: "companyTax", labelKey: "budget.section.companyTax", type: "accounts", codePrefixes: ["89"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "totalTaxes", labelKey: "budget.section.totalTaxes", type: "subtotal", computeFrom: [{ key: "companyTax", sign: 1 }] },
  { key: "netProfit", labelKey: "budget.section.netProfit", type: "computed", computeFrom: [{ key: "profitBeforeTax", sign: 1 },{ key: "totalTaxes", sign: 1 }] },
];

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const CHANGE_IN_STOCK_RE = [
  /change in stock/i,
  /change in inventories/i,
  /variaci[oó]n.*existenc/i,
  /cambio.*existenc/i,
  /cambio.*stock/i,
];

const isChangeInStockAccount = (en?: string | null, es?: string | null) =>
  CHANGE_IN_STOCK_RE.some((re) => re.test(en ?? "") || re.test(es ?? ""));

export function BudgetGrid({ budgetType, projectCode, fiscalYear }: BudgetGridProps) {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { exportToExcel, exportToPDF } = useExport();
  const monthLabels = language === "en" ? MONTH_LABELS_EN : MONTH_LABELS_ES;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCode, setDetailCode] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // ── Hidden accounts (display-only filter) ───────────────────────
  const hiddenStorageKey = `budget-hidden-accounts-${budgetType}-${fiscalYear}`;
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(hiddenStorageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(hiddenCodes)));
  }, [hiddenCodes, hiddenStorageKey]);

  const toggleHidden = useCallback((code: string) => {
    setHiddenCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }, []);

  const showAllAccounts = useCallback(() => setHiddenCodes(new Set()), []);
  // hideAllAccounts defined after lineCodes

  // Fetch line codes
  const { data: rawLineCodes = [] } = useQuery({
    queryKey: ["budget-line-codes", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      if (budgetType === "project") {
        const { data } = await supabase.from("cbs_codes").select("code, english_description, spanish_description").order("code");
        return (data || []).map((c) => ({ code: c.code, desc: getDescription(c, language) }));
      }

      // For P&L: fetch ALL income + expense accounts (not just expense)
      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("account_code, english_description, spanish_description, account_type")
        .in("account_type", ["INCOME", "REVENUE", "EXPENSE", "COST_OF_GOODS_SOLD", "EQUITY"])
        .is("deleted_at", null)
        .order("account_code");

      const filtered = (accounts || []).filter(
        (a) => !isChangeInStockAccount(a.english_description, a.spanish_description)
      );

      return filtered.map((a) => ({
        code: a.account_code,
        desc: (language === "en" ? a.english_description : a.spanish_description) || a.account_code,
        accountType: a.account_type,
      }));
    },
  });

  // Defensive: also filter cached data so it disappears immediately without a hard refresh
  const lineCodes = useMemo(
    () =>
      budgetType === "pl"
        ? rawLineCodes.filter((lc: any) => !isChangeInStockAccount(lc.desc, lc.desc))
        : rawLineCodes,
    [budgetType, rawLineCodes]
  );

  const hideAllAccounts = useCallback(() => {
    setHiddenCodes(new Set(lineCodes.map(lc => lc.code)));
  }, [lineCodes]);

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

  // Fetch actuals
  const { data: actuals = {} } = useQuery({
    queryKey: ["budget-actuals", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      const startDate = `${fiscalYear}-01-01`;
      const endDate = `${fiscalYear}-12-31`;
      let query = supabase
        .from("transactions")
        .select("id, cbs_code, master_acct_code, amount, currency, transaction_date")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false);

      if (budgetType === "project") {
        query = query.eq("project_code", projectCode!);
      }

      const { data: txns } = await query;
      if (!txns || txns.length === 0) return {};

      const { data: rates } = await supabase
        .from("exchange_rates")
        .select("rate_date, sell_rate")
        .eq("currency_pair", "USD/DOP")
        .gte("rate_date", startDate)
        .lte("rate_date", endDate);

      const rateByDate: Record<string, number> = {};
      (rates || []).forEach(r => { rateByDate[r.rate_date] = r.sell_rate; });
      const sortedDates = Object.keys(rateByDate).sort();

      const findRate = (dateStr: string): number => {
        if (rateByDate[dateStr]) return rateByDate[dateStr];
        for (let i = sortedDates.length - 1; i >= 0; i--) {
          if (sortedDates[i] <= dateStr) return rateByDate[sortedDates[i]];
        }
        return sortedDates.length > 0 ? rateByDate[sortedDates[0]] : 1;
      };

      const map: Record<string, number> = {};
      txns.forEach(tx => {
        const key = budgetType === "project" ? tx.cbs_code : tx.master_acct_code;
        if (key) {
          const rate = (tx.currency && tx.currency !== 'DOP') ? findRate(tx.transaction_date) : 1;
          map[key] = (map[key] || 0) + ((tx.amount || 0) * rate);
        }
      });
      Object.keys(map).forEach(k => { map[k] = Math.round(map[k]); });
      return map;
    },
  });

  // Build line map
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

  // ── P&L sectioned data ──────────────────────────────────────────
  // Group line codes into sections and compute aggregates
  const plData = useMemo(() => {
    if (budgetType !== "pl") return null;

    // Assign each account to a section
    const sectionAccounts: Record<string, typeof lineCodes> = {};
    PL_SECTIONS.forEach(s => { if (s.type === "accounts") sectionAccounts[s.key] = []; });

    // Sort sections by prefix length descending so more specific prefixes match first
    const accountSections = PL_SECTIONS.filter(s => s.type === "accounts" && s.codePrefixes);
    const sortedSections = [...accountSections].sort((a, b) => {
      const maxA = Math.max(...(a.codePrefixes || []).map(p => p.length));
      const maxB = Math.max(...(b.codePrefixes || []).map(p => p.length));
      return maxB - maxA; // longer prefixes first
    });

    lineCodes.forEach(lc => {
      for (const section of sortedSections) {
        if (section.codePrefixes!.some(prefix => lc.code.startsWith(prefix))) {
          sectionAccounts[section.key].push(lc);
          break;
        }
      }
    });

    // Compute aggregates per section
    type Agg = { budget: number; forecast: number; actual: number; months: number[] };
    const sectionAgg: Record<string, Agg> = {};

    // First pass: account sections
    PL_SECTIONS.forEach(section => {
      if (section.type === "accounts") {
        const agg: Agg = { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
        (sectionAccounts[section.key] || []).forEach(lc => {
          const bl = lineMap[lc.code];
          agg.budget += bl?.annual_budget ?? 0;
          agg.forecast += bl?.current_forecast ?? 0;
          agg.actual += actuals[lc.code] ?? 0;
          MONTH_KEYS.forEach((mk, mi) => { agg.months[mi] += bl?.[mk] ?? 0; });
        });
        sectionAgg[section.key] = agg;
      }
    });

    // Resolve subtotals and computed rows (order matters)
    const resolveAgg = (key: string): Agg => {
      if (sectionAgg[key]) return sectionAgg[key];
      return { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
    };

    PL_SECTIONS.forEach(section => {
      if (section.type === "subtotal" || section.type === "computed") {
        const agg: Agg = { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
        (section.computeFrom || []).forEach(({ key, sign }) => {
          const src = resolveAgg(key);
          agg.budget += src.budget * sign;
          agg.forecast += src.forecast * sign;
          agg.actual += src.actual * sign;
          src.months.forEach((v, i) => { agg.months[i] += v * sign; });
        });
        sectionAgg[section.key] = agg;
      }
    });

    return { sectionAccounts, sectionAgg };
  }, [budgetType, lineCodes, lineMap, actuals]);

  // ── Totals (for project tabs and export) ─────────────────────────
  const totals = useMemo(() => {
    const t = { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
    lineCodes.forEach(lc => {
      const bl = lineMap[lc.code];
      t.budget += bl?.annual_budget ?? 0;
      t.forecast += bl?.current_forecast ?? 0;
      t.actual += actuals[lc.code] ?? 0;
      MONTH_KEYS.forEach((mk, mi) => { t.months[mi] += bl?.[mk] ?? 0; });
    });
    return t;
  }, [lineCodes, lineMap, actuals]);

  const totalMonthsSum = totals.months.reduce((a, b) => a + b, 0);
  const totalToDistribute = totals.forecast - totals.actual - totalMonthsSum;

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
      { key: "toDistribute", header: t("budget.toDistribute"), width: 14 },
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
        toDistribute: forecastVal - actualVal - MONTH_KEYS.reduce((s, mk) => s + (bl?.[mk] ?? 0), 0),
      };
      MONTH_KEYS.forEach((mk, mi) => { row[`m${mi}`] = bl?.[mk] ?? 0; });
      return row;
    });
    const totalsRow: Record<string, string | number> = {
      code: t("common.total"),
      budget: totals.budget,
      forecast: totals.forecast,
      actual: totals.actual,
      toDistribute: totalToDistribute,
    };
    totals.months.forEach((mv, mi) => { totalsRow[`m${mi}`] = mv; });
    return { columns, rows, totalsRow };
  }, [lineCodes, lineMap, actuals, totals, totalToDistribute, monthLabels, t]);

  // ── Render helpers ───────────────────────────────────────────────
  const renderAccountRow = (lc: { code: string; desc: string }, rowIdx: number) => {
    const bl = lineMap[lc.code];
    const actualVal = actuals[lc.code] ?? 0;
    const forecastVal = bl?.current_forecast ?? 0;
    const monthsSum = MONTH_KEYS.reduce((s, mk) => s + (bl?.[mk] ?? 0), 0);
    const toDistribute = forecastVal - actualVal - monthsSum;
    const stripeBg = rowIdx % 2 === 1 ? "bg-accent" : "";

    return (
      <tr key={lc.code} className={cn("border-b hover:bg-muted/60", stripeBg)}>
        <td className={cn("sticky left-0 z-20 border-r px-3 py-1.5 whitespace-nowrap", stripeBg || "bg-background")} style={{ minWidth: 100 }}>
          <span className="font-mono text-xs">{lc.code}</span>
          <span className="ml-2 text-foreground text-xs">{lc.desc}</span>
        </td>
        <td className={cn("sticky z-20 border-r px-1 py-1", stripeBg || "bg-background")} style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
          <Input key={`${lc.code}-budget-${bl?.annual_budget ?? 0}`} type="number" defaultValue={bl?.annual_budget ?? 0}
            className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(lc.code, "annual_budget", e.target.value)} />
        </td>
        <td className={cn("sticky z-20 border-r px-1 py-1", stripeBg || "bg-background")} style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
          <Input key={`${lc.code}-forecast-${bl?.current_forecast ?? 0}`} type="number" defaultValue={bl?.current_forecast ?? 0}
            className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(lc.code, "current_forecast", e.target.value)} />
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-1.5 text-right font-mono text-xs", stripeBg || "bg-background")} style={{ left: stickyLeft[3], minWidth: COL_W[3] }}>
          <button onClick={() => { setDetailCode(lc.code); setDetailOpen(true); }}
            className="inline-flex items-center gap-1 hover:text-primary transition-colors">
            {fmt(actualVal)}<Search className="h-3 w-3" />
          </button>
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-1.5 text-right font-mono text-xs font-semibold",
          stripeBg || "bg-background", toDistribute >= 0 ? "text-green-600" : "text-red-600"
        )} style={{ left: stickyLeft[4], minWidth: COL_W[4] }}>
          {fmt(toDistribute)}
        </td>
        {MONTH_KEYS.map((mk, mi) => (
          <td key={mi} className="px-1 py-1" style={{ minWidth: 100 }}>
            <Input key={`${lc.code}-${mk}-${bl?.[mk] ?? 0}`} type="number" defaultValue={bl?.[mk] ?? 0}
              className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(lc.code, mk, e.target.value)} />
          </td>
        ))}
      </tr>
    );
  };

  const renderAggregateRow = (section: PLSection, isComputed: boolean) => {
    const agg = plData?.sectionAgg[section.key] || { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
    const monthsSum = agg.months.reduce((a, b) => a + b, 0);
    const toDistribute = agg.forecast - agg.actual - monthsSum;
    const bgClass = isComputed ? "bg-primary/10 border-t-2 border-b-2 border-primary/30" : "bg-muted/40";

    return (
      <tr key={section.key} className={cn("font-bold", bgClass)}>
        <td className={cn("sticky left-0 z-20 border-r px-3 py-2 text-sm whitespace-nowrap", bgClass)} style={{ minWidth: COL_W[0] }}>
          {t(section.labelKey)}
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-2 text-right font-mono text-xs", bgClass)} style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
          {fmt(agg.budget)}
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-2 text-right font-mono text-xs", bgClass)} style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
          {fmt(agg.forecast)}
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-2 text-right font-mono text-xs", bgClass)} style={{ left: stickyLeft[3], minWidth: COL_W[3] }}>
          {fmt(agg.actual)}
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-2 text-right font-mono text-xs", bgClass,
          toDistribute >= 0 ? "text-green-600" : "text-red-600"
        )} style={{ left: stickyLeft[4], minWidth: COL_W[4] }}>
          {fmt(toDistribute)}
        </td>
        {agg.months.map((mv, mi) => (
          <td key={mi} className="px-3 py-2 text-right font-mono text-xs" style={{ minWidth: 100 }}>
            {fmt(mv)}
          </td>
        ))}
      </tr>
    );
  };

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderSectionHeader = (section: PLSection) => {
    const isCollapsed = collapsedSections[section.key];
    return (
      <tr key={`header-${section.key}`} className="bg-muted/70 cursor-pointer select-none" onClick={() => toggleSection(section.key)}>
        <td colSpan={5 + 12} className="sticky left-0 z-20 bg-muted/70 px-3 py-2 text-sm font-semibold text-foreground">
          <span className="inline-flex items-center gap-1">
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {t(section.labelKey)}
          </span>
        </td>
      </tr>
    );
  };

  // ── Render ───────────────────────────────────────────────────────
  const renderPLBody = () => {
    if (!plData) return null;
    const rows: React.ReactNode[] = [];
    let rowCounter = 0;

    PL_SECTIONS.forEach(section => {
      if (section.type === "accounts") {
        // Section header
        rows.push(renderSectionHeader(section));
        // Account rows
        const accounts = (plData.sectionAccounts[section.key] || []).filter(lc => !hiddenCodes.has(lc.code));
        if (!collapsedSections[section.key]) {
          accounts.forEach(lc => {
            rows.push(renderAccountRow(lc, rowCounter++));
          });
        }
        // Section subtotal (inline — look ahead for next subtotal)
      } else if (section.type === "subtotal") {
        rows.push(renderAggregateRow(section, false));
      } else if (section.type === "computed") {
        rows.push(renderAggregateRow(section, true));
      }
    });

    return rows;
  };

  const renderProjectBody = () => {
    const visibleLineCodes = lineCodes.filter(lc => !hiddenCodes.has(lc.code));
    return (
      <>
        {visibleLineCodes.map((lc, rowIdx) => renderAccountRow(lc, rowIdx))}
        {/* Totals row */}
        <tr className="border-t-2 font-bold bg-muted/30">
          <td className="sticky left-0 z-20 bg-muted/30 border-r px-3 py-2 text-sm" style={{ minWidth: COL_W[0] }}>
            {t("common.total")}
          </td>
          <td className="sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs" style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
            {fmt(totals.budget)}
          </td>
          <td className="sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs" style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
            {fmt(totals.forecast)}
          </td>
          <td className="sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs" style={{ left: stickyLeft[3], minWidth: COL_W[3] }}>
            {fmt(totals.actual)}
          </td>
          <td className={cn("sticky z-20 bg-muted/30 border-r px-3 py-2 text-right font-mono text-xs",
            totalToDistribute >= 0 ? "text-green-600" : "text-red-600"
          )} style={{ left: stickyLeft[4], minWidth: COL_W[4] }}>
            {fmt(totalToDistribute)}
          </td>
          {totals.months.map((mv, mi) => (
            <td key={mi} className="px-3 py-2 text-right font-mono text-xs" style={{ minWidth: 100 }}>
              {fmt(mv)}
            </td>
          ))}
        </tr>
      </>
    );
  };

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

      {lineCodes.length === 0 && budgetType !== "pl" ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>{t("budget.noLines") || "No budget lines found for this period."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-max min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-30 bg-muted/50 border-r border-b px-3 py-2 text-left font-medium whitespace-nowrap" style={{ minWidth: 100 }}>
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
                  {t("budget.toDistribute")}
                </th>
                {monthLabels.map((m, i) => (
                  <th key={i} className="border-b px-3 py-2 text-right font-medium whitespace-nowrap" style={{ minWidth: 100 }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgetType === "pl" ? renderPLBody() : renderProjectBody()}
            </tbody>
          </table>
        </div>
      )}

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
