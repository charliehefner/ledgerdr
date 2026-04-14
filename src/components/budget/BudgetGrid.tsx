import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getDescription } from "@/lib/getDescription";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Download, FileSpreadsheet, FileText, ChevronRight, ChevronDown, Plus, Trash2 } from "lucide-react";
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
  codePrefixes?: string[];
  accountTypes?: string[];
  sign?: number;
  computeFrom?: { key: string; sign: number }[];
}

const PL_SECTIONS: PLSection[] = [
  { key: "netSales", labelKey: "budget.section.netSales", type: "accounts", codePrefixes: ["30","31","32","33","34","35","36","37","38"], accountTypes: ["INCOME","REVENUE"], sign: 1 },
  { key: "totalRevenue", labelKey: "budget.section.totalRevenue", type: "subtotal", computeFrom: [{ key: "netSales", sign: 1 }] },
  { key: "rawMaterial", labelKey: "budget.section.rawMaterial", type: "accounts", codePrefixes: ["40","41","42","43","44","45","46","47","48"], accountTypes: ["EXPENSE","COST_OF_GOODS_SOLD"], sign: -1 },
  { key: "otherExternal", labelKey: "budget.section.otherExternal", type: "accounts", codePrefixes: ["50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "personnelCost", labelKey: "budget.section.personnelCost", type: "accounts", codePrefixes: ["70","71","72","73","74","75","76"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "depreciation", labelKey: "budget.section.depreciation", type: "accounts", codePrefixes: ["77","78"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "totalCost", labelKey: "budget.section.totalCost", type: "subtotal", computeFrom: [{ key: "rawMaterial", sign: 1 },{ key: "otherExternal", sign: 1 },{ key: "personnelCost", sign: 1 },{ key: "depreciation", sign: 1 }] },
  { key: "operatingProfit", labelKey: "budget.section.operatingProfit", type: "computed", computeFrom: [{ key: "totalRevenue", sign: 1 },{ key: "totalCost", sign: 1 }] },
  { key: "interestIncome", labelKey: "budget.section.interestIncome", type: "accounts", codePrefixes: ["80","81","82","831","834","835","836","837","838","839"], accountTypes: ["INCOME","REVENUE"], sign: 1 },
  { key: "interestExpense", labelKey: "budget.section.interestExpense", type: "accounts", codePrefixes: ["841","842","844","845","846"], accountTypes: ["EXPENSE"], sign: -1 },
  { key: "realizedFx", labelKey: "budget.section.realizedFx", type: "accounts", codePrefixes: ["833","843"], sign: 1 },
  { key: "unrealizedFx", labelKey: "budget.section.unrealizedFx", type: "accounts", codePrefixes: ["851"], sign: -1 },
  { key: "totalFinancial", labelKey: "budget.section.totalFinancial", type: "subtotal", computeFrom: [{ key: "interestIncome", sign: 1 },{ key: "interestExpense", sign: 1 },{ key: "realizedFx", sign: 1 },{ key: "unrealizedFx", sign: 1 }] },
  { key: "profitAfterFinancial", labelKey: "budget.section.profitAfterFinancial", type: "computed", computeFrom: [{ key: "operatingProfit", sign: 1 },{ key: "totalFinancial", sign: 1 }] },
  { key: "appropriations", labelKey: "budget.section.appropriations", type: "accounts", codePrefixes: ["88"], accountTypes: ["EQUITY"], sign: -1 },
  { key: "totalAppropriations", labelKey: "budget.section.totalAppropriations", type: "subtotal", computeFrom: [{ key: "appropriations", sign: 1 }] },
  { key: "profitBeforeTax", labelKey: "budget.section.profitBeforeTax", type: "computed", computeFrom: [{ key: "profitAfterFinancial", sign: 1 },{ key: "totalAppropriations", sign: 1 }] },
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

  // Sub-line state
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [addSubLineFor, setAddSubLineFor] = useState<string | null>(null);
  const [newSubLabel, setNewSubLabel] = useState("");

  // ── Hidden accounts (display-only filter) ───────────────────────
  const hiddenStorageKey = `budget-hidden-accounts-${budgetType}-${fiscalYear}`;
  const [hiddenCodes, setHiddenCodes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(hiddenStorageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(hiddenStorageKey);
      setHiddenCodes(saved ? new Set(JSON.parse(saved)) : new Set<string>());
    } catch { setHiddenCodes(new Set<string>()); }
  }, [hiddenStorageKey]);

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

  // Fetch line codes
  const { data: rawLineCodes = [] } = useQuery({
    queryKey: ["budget-line-codes", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      if (budgetType === "project") {
        const { data } = await supabase.from("cbs_codes").select("code, english_description, spanish_description").order("code");
        return (data || []).map((c) => ({ code: c.code, desc: getDescription(c, language) }));
      }
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

  // Fetch budget lines (including sub-lines)
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

  // Separate top-level lines from sub-lines
  const topLevelLines = useMemo(() => budgetLines.filter(bl => !bl.parent_line_id), [budgetLines]);
  const subLinesByParent = useMemo(() => {
    const map: Record<string, typeof budgetLines> = {};
    budgetLines.forEach(bl => {
      if (bl.parent_line_id) {
        if (!map[bl.parent_line_id]) map[bl.parent_line_id] = [];
        map[bl.parent_line_id].push(bl);
      }
    });
    return map;
  }, [budgetLines]);

  // Build line map (top-level only for account-code lookup)
  const lineMap: Record<string, any> = {};
  topLevelLines.forEach(bl => { lineMap[bl.line_code] = bl; });

  // Compute auto-summed values for parents that have sub-lines
  const getLineValues = useCallback((lineCode: string) => {
    const bl = lineMap[lineCode];
    if (!bl) return null;
    const children = subLinesByParent[bl.id];
    if (!children || children.length === 0) return bl;

    // Auto-sum from children
    const summed: any = { ...bl };
    summed.annual_budget = children.reduce((s: number, c: any) => s + (c.annual_budget ?? 0), 0);
    summed.current_forecast = children.reduce((s: number, c: any) => s + (c.current_forecast ?? 0), 0);
    MONTH_KEYS.forEach(mk => {
      summed[mk] = children.reduce((s: number, c: any) => s + (c[mk] ?? 0), 0);
    });
    return summed;
  }, [lineMap, subLinesByParent]);

  // Fetch actuals
  const { data: actuals = {} } = useQuery({
    queryKey: ["budget-actuals", budgetType, projectCode, fiscalYear],
    queryFn: async () => {
      const startDate = `${fiscalYear}-01-01`;
      const endDate = `${fiscalYear}-12-31`;
      let query = supabase
        .from("transactions")
        .select(`
          id, amount, currency, transaction_date,
          master_acct_code, cbs_code,
          chart_of_accounts:chart_of_accounts!transactions_account_id_fkey (account_code),
          cbs_codes:cbs_codes!transactions_cbs_id_fkey (code)
        `)
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
      txns.forEach((tx: any) => {
        const acctCode = tx.chart_of_accounts?.account_code || tx.master_acct_code;
        const cbsCode = tx.cbs_codes?.code || tx.cbs_code;
        const key = budgetType === "project" ? cbsCode : acctCode;
        if (key) {
          const rate = (tx.currency && tx.currency !== 'DOP') ? findRate(tx.transaction_date) : 1;
          map[key] = (map[key] || 0) + ((tx.amount || 0) * rate);
        }
      });
      Object.keys(map).forEach(k => { map[k] = Math.round(map[k]); });
      return map;
    },
  });

  // Upsert mutation (works for both top-level and sub-lines)
  const upsertMutation = useMutation({
    mutationFn: async (params: { lineId?: string; lineCode: string; field: string; value: number; parentLineId?: string; subLabel?: string }) => {
      if (params.lineId) {
        // Update existing line (top-level or sub-line)
        const { error } = await supabase
          .from("budget_lines")
          .update({ [params.field]: params.value } as any)
          .eq("id", params.lineId);
        if (error) throw error;
      } else {
        // Check if a row already exists (race-condition guard against duplicate inserts)
        const pCode = budgetType === "project" ? projectCode : null;
        const pLineId = params.parentLineId || null;
        const sLabel = params.subLabel || null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase.from("budget_lines").select("id");
        q = q.eq("budget_type", budgetType);
        q = q.eq("fiscal_year", fiscalYear);
        q = q.eq("line_code", params.lineCode);
        q = pCode ? q.eq("project_code", pCode) : q.is("project_code", null);
        q = pLineId ? q.eq("parent_line_id", pLineId) : q.is("parent_line_id", null);
        q = sLabel ? q.eq("sub_label", sLabel) : q.is("sub_label", null);

        const { data: existing } = await q.limit(1).maybeSingle();

        if (existing?.id) {
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
            parent_line_id: params.parentLineId || null,
            sub_label: params.subLabel || null,
          };
          const { error } = await supabase.from("budget_lines").insert(row);
          if (error) throw error;
        }
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
    (lineCode: string, field: string, value: string, lineId?: string) => {
      const num = parseFloat(value) || 0;
      if (lineId) {
        // Sub-line or existing line by ID
        const existing = budgetLines.find(bl => bl.id === lineId);
        const current = existing ? (existing[field as keyof typeof existing] ?? 0) : 0;
        if (num !== current) {
          upsertMutation.mutate({ lineId, lineCode, field, value: num });
        }
      } else {
        const existing = lineMap[lineCode];
        const current = existing ? (existing[field] ?? 0) : 0;
        if (num !== current) {
          upsertMutation.mutate({ lineCode, field, value: num });
        }
      }
    },
    [lineMap, budgetLines, upsertMutation]
  );

  // Add sub-line mutation
  const addSubLineMutation = useMutation({
    mutationFn: async ({ parentId, lineCode, label }: { parentId: string; lineCode: string; label: string }) => {
      const row: any = {
        budget_type: budgetType,
        project_code: budgetType === "project" ? projectCode : null,
        fiscal_year: fiscalYear,
        line_code: lineCode,
        parent_line_id: parentId,
        sub_label: label,
        created_by: user?.id || null,
      };
      const { error } = await supabase.from("budget_lines").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines", budgetType, projectCode, fiscalYear] });
      toast.success(t("budget.subLineAdded"));
      setAddSubLineFor(null);
      setNewSubLabel("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete sub-line mutation
  const deleteSubLineMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines", budgetType, projectCode, fiscalYear] });
      toast.success(t("budget.subLineDeleted"));
    },
  });

  const handleAddSubLine = () => {
    if (!addSubLineFor || !newSubLabel.trim()) return;
    const parentBl = lineMap[addSubLineFor];
    if (!parentBl) {
      // Need to create the parent line first, then add sub-line
      // For simplicity, create parent first
      const createParentAndChild = async () => {
        const { data: parentData, error: parentErr } = await supabase
          .from("budget_lines")
          .insert({
            budget_type: budgetType,
            project_code: budgetType === "project" ? projectCode : null,
            fiscal_year: fiscalYear,
            line_code: addSubLineFor!,
            created_by: user?.id || null,
          })
          .select("id")
          .single();
        if (parentErr) throw parentErr;
        await addSubLineMutation.mutateAsync({
          parentId: parentData.id,
          lineCode: addSubLineFor!,
          label: newSubLabel.trim(),
        });
      };
      createParentAndChild().catch(err => toast.error(err.message));
    } else {
      addSubLineMutation.mutate({
        parentId: parentBl.id,
        lineCode: addSubLineFor,
        label: newSubLabel.trim(),
      });
    }
  };

  const toggleExpanded = useCallback((code: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }, []);

  // ── P&L sectioned data ──────────────────────────────────────────
  const plData = useMemo(() => {
    if (budgetType !== "pl") return null;

    const sectionAccounts: Record<string, typeof lineCodes> = {};
    PL_SECTIONS.forEach(s => { if (s.type === "accounts") sectionAccounts[s.key] = []; });

    const accountSections = PL_SECTIONS.filter(s => s.type === "accounts" && s.codePrefixes);
    const sortedSections = [...accountSections].sort((a, b) => {
      const maxA = Math.max(...(a.codePrefixes || []).map(p => p.length));
      const maxB = Math.max(...(b.codePrefixes || []).map(p => p.length));
      return maxB - maxA;
    });

    lineCodes.forEach(lc => {
      for (const section of sortedSections) {
        if (section.codePrefixes!.some(prefix => lc.code.startsWith(prefix))) {
          sectionAccounts[section.key].push(lc);
          break;
        }
      }
    });

    type Agg = { budget: number; forecast: number; actual: number; months: number[] };
    const sectionAgg: Record<string, Agg> = {};

    PL_SECTIONS.forEach(section => {
      if (section.type === "accounts") {
        const agg: Agg = { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
        (sectionAccounts[section.key] || []).forEach(lc => {
          const bl = getLineValues(lc.code);
          agg.budget += bl?.annual_budget ?? 0;
          agg.forecast += bl?.current_forecast ?? 0;
          agg.actual += actuals[lc.code] ?? 0;
          MONTH_KEYS.forEach((mk, mi) => { agg.months[mi] += bl?.[mk] ?? 0; });
        });
        sectionAgg[section.key] = agg;
      }
    });

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
  }, [budgetType, lineCodes, getLineValues, actuals]);

  // ── Totals ─────────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = { budget: 0, forecast: 0, actual: 0, months: new Array(12).fill(0) };
    lineCodes.forEach(lc => {
      const bl = getLineValues(lc.code);
      t.budget += bl?.annual_budget ?? 0;
      t.forecast += bl?.current_forecast ?? 0;
      t.actual += actuals[lc.code] ?? 0;
      MONTH_KEYS.forEach((mk, mi) => { t.months[mi] += bl?.[mk] ?? 0; });
    });
    return t;
  }, [lineCodes, getLineValues, actuals]);

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
      const bl = getLineValues(lc.code);
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
  }, [lineCodes, getLineValues, actuals, totals, totalToDistribute, monthLabels, t]);

  // ── Render helpers ───────────────────────────────────────────────
  const renderSubLineRow = (subLine: any, rowIdx: number) => {
    const forecastVal = subLine.current_forecast ?? 0;
    const monthsSum = MONTH_KEYS.reduce((s, mk) => s + (subLine[mk] ?? 0), 0);
    const toDistribute = forecastVal - monthsSum;
    const stripeBg = rowIdx % 2 === 1 ? "bg-accent/50" : "";

    return (
      <tr key={subLine.id} className={cn("border-b hover:bg-muted/40", stripeBg)}>
        <td className={cn("sticky left-0 z-20 border-r px-3 py-1.5 whitespace-nowrap", stripeBg || "bg-background")} style={{ minWidth: 100 }}>
          <span className="ml-6 text-xs text-muted-foreground">↳</span>
          <span className="ml-1 text-xs text-foreground">{subLine.sub_label}</span>
          <button
            onClick={() => {
              if (confirm(t("budget.deleteSubLine") + "?")) {
                deleteSubLineMutation.mutate(subLine.id);
              }
            }}
            className="ml-2 text-destructive/60 hover:text-destructive inline-flex"
            title={t("budget.deleteSubLine")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
        <td className={cn("sticky z-20 border-r px-1 py-1", stripeBg || "bg-background")} style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
          <Input key={`sub-${subLine.id}-budget-${subLine.annual_budget ?? 0}`} type="number" defaultValue={subLine.annual_budget ?? 0}
            className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(subLine.line_code, "annual_budget", e.target.value, subLine.id)} />
        </td>
        <td className={cn("sticky z-20 border-r px-1 py-1", stripeBg || "bg-background")} style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
          <Input key={`sub-${subLine.id}-forecast-${subLine.current_forecast ?? 0}`} type="number" defaultValue={subLine.current_forecast ?? 0}
            className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(subLine.line_code, "current_forecast", e.target.value, subLine.id)} />
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-1.5 text-right font-mono text-xs text-muted-foreground", stripeBg || "bg-background")} style={{ left: stickyLeft[3], minWidth: COL_W[3] }}>
          —
        </td>
        <td className={cn("sticky z-20 border-r px-3 py-1.5 text-right font-mono text-xs",
          stripeBg || "bg-background", toDistribute >= 0 ? "text-green-600" : "text-red-600"
        )} style={{ left: stickyLeft[4], minWidth: COL_W[4] }}>
          {fmt(toDistribute)}
        </td>
        {MONTH_KEYS.map((mk, mi) => (
          <td key={mi} className="px-1 py-1" style={{ minWidth: 100 }}>
            <Input key={`sub-${subLine.id}-${mk}-${subLine[mk] ?? 0}`} type="number" defaultValue={subLine[mk] ?? 0}
              className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(subLine.line_code, mk, e.target.value, subLine.id)} />
          </td>
        ))}
      </tr>
    );
  };

  const renderAccountRow = (lc: { code: string; desc: string }, rowIdx: number) => {
    const bl = getLineValues(lc.code);
    const rawBl = lineMap[lc.code];
    const hasSubLines = rawBl && subLinesByParent[rawBl.id]?.length > 0;
    const isExpanded = expandedAccounts.has(lc.code);
    const actualVal = actuals[lc.code] ?? 0;
    const forecastVal = bl?.current_forecast ?? 0;
    const monthsSum = MONTH_KEYS.reduce((s, mk) => s + (bl?.[mk] ?? 0), 0);
    const toDistribute = forecastVal - actualVal - monthsSum;
    const stripeBg = rowIdx % 2 === 1 ? "bg-accent" : "";

    const children = hasSubLines ? subLinesByParent[rawBl.id] : [];

    return (
      <>
        <tr key={lc.code} className={cn("border-b hover:bg-muted/60 group/row", stripeBg)}>
          <td className={cn("sticky left-0 z-20 border-r px-3 py-1.5 whitespace-nowrap", stripeBg || "bg-background")} style={{ minWidth: 100 }}>
            <span className="inline-flex items-center gap-1">
              {hasSubLines ? (
                <button onClick={() => toggleExpanded(lc.code)} className="hover:text-primary">
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              <span className="font-mono text-xs">{lc.code}</span>
              <span className="text-foreground text-xs">{lc.desc}</span>
              <button
                onClick={() => { setAddSubLineFor(lc.code); setNewSubLabel(""); }}
                className="ml-1 text-muted-foreground hover:text-primary opacity-0 group-hover/row:opacity-100 transition-opacity"
                title={t("budget.addSubLine")}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          </td>
          {hasSubLines ? (
            <>
              <td className={cn("sticky z-20 border-r px-3 py-1.5 text-right font-mono text-xs", stripeBg || "bg-background")} style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
                {fmt(bl?.annual_budget ?? 0)}
              </td>
              <td className={cn("sticky z-20 border-r px-3 py-1.5 text-right font-mono text-xs", stripeBg || "bg-background")} style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
                {fmt(forecastVal)}
              </td>
            </>
          ) : (
            <>
              <td className={cn("sticky z-20 border-r px-1 py-1", stripeBg || "bg-background")} style={{ left: stickyLeft[1], minWidth: COL_W[1] }}>
                <Input key={`${lc.code}-budget-${bl?.annual_budget ?? 0}`} type="number" defaultValue={bl?.annual_budget ?? 0}
                  className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(lc.code, "annual_budget", e.target.value)} />
              </td>
              <td className={cn("sticky z-20 border-r px-1 py-1", stripeBg || "bg-background")} style={{ left: stickyLeft[2], minWidth: COL_W[2] }}>
                <Input key={`${lc.code}-forecast-${bl?.current_forecast ?? 0}`} type="number" defaultValue={bl?.current_forecast ?? 0}
                  className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(lc.code, "current_forecast", e.target.value)} />
              </td>
            </>
          )}
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
          {hasSubLines ? (
            MONTH_KEYS.map((mk, mi) => (
              <td key={mi} className="px-3 py-1.5 text-right font-mono text-xs" style={{ minWidth: 100 }}>
                {fmt(bl?.[mk] ?? 0)}
              </td>
            ))
          ) : (
            MONTH_KEYS.map((mk, mi) => (
              <td key={mi} className="px-1 py-1" style={{ minWidth: 100 }}>
                <Input key={`${lc.code}-${mk}-${bl?.[mk] ?? 0}`} type="number" defaultValue={bl?.[mk] ?? 0}
                  className="h-7 text-right text-xs font-mono" onBlur={e => handleBlur(lc.code, mk, e.target.value)} />
              </td>
            ))
          )}
        </tr>
        {hasSubLines && isExpanded && children.map((sub, si) => renderSubLineRow(sub, si))}
      </>
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
        rows.push(renderSectionHeader(section));
        const accounts = (plData.sectionAccounts[section.key] || []).filter(lc => !hiddenCodes.has(lc.code));
        if (!collapsedSections[section.key]) {
          accounts.forEach(lc => {
            rows.push(renderAccountRow(lc, rowCounter++));
          });
        }
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

  // Build account groups for the selector dialog
  const accountGroups = useMemo(() => {
    if (budgetType === "pl" && plData) {
      return PL_SECTIONS
        .filter(s => s.type === "accounts" && (plData.sectionAccounts[s.key] || []).length > 0)
        .map(s => ({
          label: t(s.labelKey),
          accounts: plData.sectionAccounts[s.key],
        }));
    }
    return undefined;
  }, [budgetType, plData, t]);

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex justify-end gap-2 mb-2">
        <AccountSelector
          accounts={lineCodes}
          groups={accountGroups}
          hiddenCodes={hiddenCodes}
          onToggle={toggleHidden}
          onShowAll={showAllAccounts}
          onHideAll={hideAllAccounts}
        />
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
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh] border rounded-lg">
          <table className="w-max min-w-full text-sm border-collapse">
            <thead className="sticky top-0 z-40">
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

      {/* Add Sub-Line Dialog */}
      <Dialog open={!!addSubLineFor} onOpenChange={(open) => { if (!open) setAddSubLineFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("budget.addSubLine")} — {addSubLineFor}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("budget.subLineLabel")}</Label>
              <Input
                value={newSubLabel}
                onChange={e => setNewSubLabel(e.target.value)}
                placeholder={t("budget.subLinePlaceholder")}
                onKeyDown={e => { if (e.key === "Enter") handleAddSubLine(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddSubLine} disabled={!newSubLabel.trim() || addSubLineMutation.isPending}>
              {t("budget.addSubLine")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
