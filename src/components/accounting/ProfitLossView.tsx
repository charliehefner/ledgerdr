import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { UnlinkedTransactionsWarning } from "@/components/accounting/UnlinkedTransactionsWarning";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/formatters";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useExchangeRate } from "@/hooks/useExchangeRate";

const CC_LABELS: Record<string, Record<string, string>> = {
  es: { general: "General", agricultural: "Agrícola", industrial: "Industrial" },
  en: { general: "General", agricultural: "Agricultural", industrial: "Industrial" },
};

// ─── Category mapping by account_code prefix ───
type SectionType = "revenue" | "cogs" | "opex" | "financial";

interface PLCategory {
  prefixMin: number;
  prefixMax: number;
  labelKey: string;
  section: SectionType;
}

const PL_CATEGORIES: PLCategory[] = [
  { prefixMin: 30, prefixMax: 39, labelKey: "pl.income",        section: "revenue" },
  { prefixMin: 40, prefixMax: 49, labelKey: "pl.cogs",          section: "cogs" },
  { prefixMin: 50, prefixMax: 51, labelKey: "pl.premises",      section: "opex" },
  { prefixMin: 52, prefixMax: 53, labelKey: "pl.machinery",     section: "opex" },
  { prefixMin: 54, prefixMax: 54, labelKey: "pl.vehicles",      section: "opex" },
  { prefixMin: 55, prefixMax: 56, labelKey: "pl.toolsOffice",   section: "opex" },
  { prefixMin: 57, prefixMax: 59, labelKey: "pl.admin",         section: "opex" },
  { prefixMin: 60, prefixMax: 65, labelKey: "pl.personnel",     section: "opex" },
  { prefixMin: 69, prefixMax: 69, labelKey: "pl.depreciation",  section: "opex" },
  { prefixMin: 70, prefixMax: 84, labelKey: "pl.financialItems", section: "financial" },
  { prefixMin: 89, prefixMax: 89, labelKey: "pl.extraordinary", section: "financial" },
];

function getPrefix(code: string): number {
  return parseInt(code.substring(0, 2), 10) || 0;
}

function findCategory(code: string): PLCategory | null {
  const p = getPrefix(code);
  return PL_CATEGORIES.find(c => p >= c.prefixMin && p <= c.prefixMax) || null;
}

interface AccountRow {
  account_code: string;
  account_name: string;
  account_type: string;
  id: string;
  english_description: string | null;
  spanish_description: string | null;
}

interface AcctLine {
  code: string;
  name: string;
  rd: number;
  us: number;
  compRd: number;
  compUs: number;
}

interface CategoryBlock {
  category: PLCategory;
  label: string;
  accounts: AcctLine[];
  rdTotal: number;
  usTotal: number;
  compRdTotal: number;
  compUsTotal: number;
}

// Row types for rendering
type StatementRow =
  | { type: "sectionHeader"; label: string }
  | { type: "categoryHeader"; label: string }
  | { type: "account"; code: string; name: string; rd: number; us: number; compRd: number; compUs: number }
  | { type: "categorySubtotal"; label: string; rd: number; us: number; compRd: number; compUs: number }
  | { type: "sectionTotal"; label: string; rd: number; us: number; compRd: number; compUs: number }
  | { type: "intermediateTotal"; label: string; rd: number; us: number; compRd: number; compUs: number }
  | { type: "netIncome"; label: string; rd: number; us: number; compRd: number; compUs: number }
  | { type: "blank" };

function getAcctName(a: AccountRow, language: Language) {
  return language === "en"
    ? (a.english_description || a.account_name)
    : (a.spanish_description || a.account_name);
}

function fmtVar(current: number, prior: number): string {
  return formatCurrency(current - prior, "DOP");
}

function fmtVarPct(current: number, prior: number): string {
  if (Math.abs(prior) < 0.01) return "—";
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function ProfitLossView() {
  const { t, language } = useLanguage();
  const ccLabels = CC_LABELS[language] || CC_LABELS.es;

  const now = new Date();
  const [startDate, setStartDate] = useState(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(now, "yyyy-MM-dd"));
  const [costCenter, setCostCenter] = useState("all");
  const [exchangeRate, setExchangeRate] = useState(60);
  const manuallyEdited = useRef(false);
  const { rate: fetchedRate, isLoading: rateLoading } = useExchangeRate(endDate);

  useEffect(() => {
    if (fetchedRate != null && !manuallyEdited.current) {
      setExchangeRate(fetchedRate);
    }
  }, [fetchedRate]);

  // Reset manual flag when date changes
  useEffect(() => { manuallyEdited.current = false; }, [endDate]);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compStartDate, setCompStartDate] = useState(format(new Date(now.getFullYear() - 1, 0, 1), "yyyy-MM-dd"));
  const [compEndDate, setCompEndDate] = useState(format(new Date(now.getFullYear() - 1, 11, 31), "yyyy-MM-dd"));

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, english_description, spanish_description")
        .is("deleted_at", null)
        .in("account_type", ["INCOME", "EXPENSE"])
        .order("account_code");
      if (error) throw error;
      return data as AccountRow[];
    },
  });

  interface JournalBalance {
    account_code: string;
    account_name: string;
    account_type: string;
    currency: string;
    total_debit: number;
    total_credit: number;
    balance: number;
  }

  const costCenterParam = costCenter === "all" ? null : costCenter;

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["pl-journal-balances", startDate, endDate, costCenter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_balances_from_journals", {
        p_start: startDate,
        p_end: endDate,
        p_cost_center: costCenterParam,
      });
      if (error) throw error;
      return (data || []) as JournalBalance[];
    },
  });

  const { data: compBalances = [] } = useQuery({
    queryKey: ["pl-journal-balances-comp", compStartDate, compEndDate, costCenter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_balances_from_journals", {
        p_start: compStartDate,
        p_end: compEndDate,
        p_cost_center: costCenterParam,
      });
      if (error) throw error;
      return (data || []) as JournalBalance[];
    },
    enabled: compareEnabled,
  });

  const buildAccountTotals = (rows: JournalBalance[]) => {
    const totals: Record<string, { rd: number; us: number }> = {};
    rows.forEach((r) => {
      if (!totals[r.account_code]) totals[r.account_code] = { rd: 0, us: 0 };
      // For income: credit - debit; for expense: debit - credit
      // The sign convention is handled later by the P&L structure, so store raw balance
      const amount = r.balance; // debit - credit
      if (r.currency === "USD") {
        totals[r.account_code].us += amount;
        totals[r.account_code].rd += amount * exchangeRate;
      } else {
        // DOP or EUR (EUR converted at same rate)
        if (r.currency === "EUR") {
          totals[r.account_code].rd += amount * exchangeRate;
        } else {
          totals[r.account_code].rd += amount;
        }
      }
    });
    return totals;
  };

  const accountTotals = useMemo(() => buildAccountTotals(balances), [balances, exchangeRate]);
  const compAccountTotals = useMemo(() => buildAccountTotals(compBalances), [compBalances, exchangeRate]);

  // Build the full categorized statement
  const { statementRows, hasUsd } = useMemo(() => {
    const catMap = new Map<PLCategory, AcctLine[]>();
    PL_CATEGORIES.forEach(c => catMap.set(c, []));

    accounts.forEach(a => {
      const cat = findCategory(a.account_code);
      if (!cat) return;
      const t = accountTotals[a.account_code] || { rd: 0, us: 0 };
      const ct = compAccountTotals[a.account_code] || { rd: 0, us: 0 };
      if (t.rd === 0 && t.us === 0 && ct.rd === 0 && ct.us === 0) return;
      catMap.get(cat)!.push({
        code: a.account_code,
        name: getAcctName(a, language),
        rd: t.rd, us: t.us,
        compRd: ct.rd, compUs: ct.us,
      });
    });

    const blocks: CategoryBlock[] = [];
    PL_CATEGORIES.forEach(cat => {
      const accts = catMap.get(cat)!;
      if (accts.length === 0) return;
      blocks.push({
        category: cat,
        label: t(cat.labelKey),
        accounts: accts.sort((a, b) => a.code.localeCompare(b.code)),
        rdTotal: accts.reduce((s, a) => s + a.rd, 0),
        usTotal: accts.reduce((s, a) => s + a.us, 0),
        compRdTotal: accts.reduce((s, a) => s + a.compRd, 0),
        compUsTotal: accts.reduce((s, a) => s + a.compUs, 0),
      });
    });

    const sumSection = (section: SectionType) => {
      const sectionBlocks = blocks.filter(b => b.category.section === section);
      return {
        rd: sectionBlocks.reduce((s, b) => s + b.rdTotal, 0),
        us: sectionBlocks.reduce((s, b) => s + b.usTotal, 0),
        compRd: sectionBlocks.reduce((s, b) => s + b.compRdTotal, 0),
        compUs: sectionBlocks.reduce((s, b) => s + b.compUsTotal, 0),
        blocks: sectionBlocks,
      };
    };

    const revenue = sumSection("revenue");
    const cogs = sumSection("cogs");
    const opex = sumSection("opex");
    const financial = sumSection("financial");

    const grossProfitRd = revenue.rd - cogs.rd;
    const grossProfitUs = revenue.us - cogs.us;
    const compGrossProfitRd = revenue.compRd - cogs.compRd;
    const compGrossProfitUs = revenue.compUs - cogs.compUs;
    const ebitRd = grossProfitRd - opex.rd;
    const ebitUs = grossProfitUs - opex.us;
    const compEbitRd = compGrossProfitRd - opex.compRd;
    const compEbitUs = compGrossProfitUs - opex.compUs;

    let financialIncomeRd = 0, financialIncomeUs = 0;
    let financialExpenseRd = 0, financialExpenseUs = 0;
    let compFinancialIncomeRd = 0, compFinancialIncomeUs = 0;
    let compFinancialExpenseRd = 0, compFinancialExpenseUs = 0;
    financial.blocks.forEach(b => {
      b.accounts.forEach(acct => {
        const origAccount = accounts.find(a => a.account_code === acct.code);
        if (origAccount?.account_type === "INCOME") {
          financialIncomeRd += acct.rd; financialIncomeUs += acct.us;
          compFinancialIncomeRd += acct.compRd; compFinancialIncomeUs += acct.compUs;
        } else {
          financialExpenseRd += acct.rd; financialExpenseUs += acct.us;
          compFinancialExpenseRd += acct.compRd; compFinancialExpenseUs += acct.compUs;
        }
      });
    });
    const netFinancialRd = financialIncomeRd - financialExpenseRd;
    const netFinancialUs = financialIncomeUs - financialExpenseUs;
    const compNetFinancialRd = compFinancialIncomeRd - compFinancialExpenseRd;
    const compNetFinancialUs = compFinancialIncomeUs - compFinancialExpenseUs;

    const netIncomeRd = ebitRd + netFinancialRd;
    const netIncomeUs = ebitUs + netFinancialUs;
    const compNetIncomeRd = compEbitRd + compNetFinancialRd;
    const compNetIncomeUs = compEbitUs + compNetFinancialUs;

    const allBlocks = [...revenue.blocks, ...cogs.blocks, ...opex.blocks, ...financial.blocks];
    const hasUsd = allBlocks.some(b => b.usTotal !== 0 || b.compUsTotal !== 0);

    const rows: StatementRow[] = [];

    // ─── REVENUE ───
    if (revenue.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.income") });
      revenue.blocks.forEach(b => {
        b.accounts.forEach(a => rows.push({ type: "account", ...a }));
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalIncome"), rd: revenue.rd, us: revenue.us, compRd: revenue.compRd, compUs: revenue.compUs });
      rows.push({ type: "blank" });
    }

    // ─── COGS ───
    if (cogs.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.cogs") });
      cogs.blocks.forEach(b => {
        b.accounts.forEach(a => rows.push({ type: "account", ...a }));
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalCogs"), rd: cogs.rd, us: cogs.us, compRd: cogs.compRd, compUs: cogs.compUs });
      rows.push({ type: "blank" });
    }

    // ─── GROSS PROFIT ───
    rows.push({ type: "intermediateTotal", label: t("pl.grossProfit"), rd: grossProfitRd, us: grossProfitUs, compRd: compGrossProfitRd, compUs: compGrossProfitUs });
    rows.push({ type: "blank" });

    // ─── OPERATING EXPENSES ───
    if (opex.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.operatingExpenses") });
      rows.push({ type: "blank" });
      opex.blocks.forEach(b => {
        rows.push({ type: "categoryHeader", label: b.label });
        b.accounts.forEach(a => rows.push({ type: "account", ...a }));
        rows.push({ type: "categorySubtotal", label: t("pl.subtotal"), rd: b.rdTotal, us: b.usTotal, compRd: b.compRdTotal, compUs: b.compUsTotal });
        rows.push({ type: "blank" });
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalOpex"), rd: opex.rd, us: opex.us, compRd: opex.compRd, compUs: opex.compUs });
      rows.push({ type: "blank" });
    }

    // ─── EBIT ───
    rows.push({ type: "intermediateTotal", label: t("pl.ebit"), rd: ebitRd, us: ebitUs, compRd: compEbitRd, compUs: compEbitUs });
    rows.push({ type: "blank" });

    // ─── FINANCIAL / OTHER ───
    if (financial.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.financialItems") });
      financial.blocks.forEach(b => {
        b.accounts.forEach(acct => {
          const origAccount = accounts.find(a => a.account_code === acct.code);
          const sign = origAccount?.account_type === "EXPENSE" ? -1 : 1;
          rows.push({ type: "account", code: acct.code, name: acct.name, rd: acct.rd * sign, us: acct.us * sign, compRd: acct.compRd * sign, compUs: acct.compUs * sign });
        });
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalFinancial"), rd: netFinancialRd, us: netFinancialUs, compRd: compNetFinancialRd, compUs: compNetFinancialUs });
      rows.push({ type: "blank" });
    }

    // ─── NET INCOME ───
    rows.push({ type: "netIncome", label: t("pl.netIncome"), rd: netIncomeRd, us: netIncomeUs, compRd: compNetIncomeRd, compUs: compNetIncomeUs });

    return { statementRows: rows, hasUsd };
  }, [accounts, accountTotals, compAccountTotals, language, t]);

  const baseCols = hasUsd ? 4 : 3;
  const compCols = compareEnabled ? 3 : 0;
  const colCount = baseCols + compCols;

  // Variance cells helper
  const VarCells = ({ rd, compRd }: { rd: number; compRd: number }) => {
    if (!compareEnabled) return null;
    const variance = rd - compRd;
    return (
      <>
        <TableCell className="text-right">{formatCurrency(compRd, "DOP")}</TableCell>
        <TableCell className={`text-right ${variance >= 0 ? "" : "text-destructive"}`}>{formatCurrency(variance, "DOP")}</TableCell>
        <TableCell className={`text-right ${variance >= 0 ? "" : "text-destructive"}`}>{fmtVarPct(rd, compRd)}</TableCell>
      </>
    );
  };

  // ─── EXCEL EXPORT ───
  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("pl.title"));
      
      ws.mergeCells("A1:D1");
      ws.getCell("A1").value = t("pl.title");
      ws.getCell("A1").font = { bold: true, size: 16 };
      ws.mergeCells("A2:D2");
      ws.getCell("A2").value = `${t("pl.period")}: ${startDate} — ${endDate}`;
      ws.getCell("A2").font = { size: 10 };
      if (compareEnabled) {
        ws.mergeCells("A3:D3");
        ws.getCell("A3").value = `${t("pl.compare")}: ${compStartDate} — ${compEndDate}`;
        ws.getCell("A3").font = { size: 10 };
      }
      
      let row = compareEnabled ? 5 : 4;
      const colA = 1, colB = 2, colC = 3, colD = 4;
      const colE = 5, colF = 6, colG = 7;
      ws.getColumn(colA).width = 14;
      ws.getColumn(colB).width = 40;
      ws.getColumn(colC).width = 18;
      ws.getColumn(colD).width = 18;
      if (compareEnabled) {
        ws.getColumn(colE).width = 18;
        ws.getColumn(colF).width = 18;
        ws.getColumn(colG).width = 14;
      }

      const addRow = (code: string, name: string, rd?: number, us?: number, compRd?: number, style?: Partial<ExcelJS.Style>) => {
        const r = ws.getRow(row);
        r.getCell(colA).value = code;
        r.getCell(colB).value = name;
        if (rd !== undefined) r.getCell(colC).value = rd;
        if (us !== undefined && hasUsd) r.getCell(colD).value = us;
        if (compareEnabled && compRd !== undefined && rd !== undefined) {
          const varCol = hasUsd ? colE : colD;
          r.getCell(varCol).value = compRd;
          r.getCell(varCol + 1).value = rd - compRd;
          r.getCell(varCol + 2).value = Math.abs(compRd) > 0.01 ? ((rd - compRd) / Math.abs(compRd)) : null;
          r.getCell(varCol + 2).numFmt = '0.0"%"';
        }
        if (style?.font) r.font = style.font;
        if (style?.fill) r.fill = style.fill as ExcelJS.Fill;
        row++;
      };

      statementRows.forEach(sr => {
        switch (sr.type) {
          case "sectionHeader":
            addRow("", sr.label, undefined, undefined, undefined, { 
              font: { bold: true, size: 12 },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF4" } } as ExcelJS.Fill 
            });
            break;
          case "categoryHeader":
            addRow("", `  ${sr.label}`, undefined, undefined, undefined, { font: { bold: true, italic: true } });
            break;
          case "account":
            addRow(`    ${sr.code}`, `    ${sr.name}`, sr.rd, sr.us, sr.compRd);
            break;
          case "categorySubtotal":
            addRow("", `        ${sr.label}`, sr.rd, sr.us, sr.compRd, { font: { italic: true } });
            break;
          case "sectionTotal":
            addRow("", sr.label, sr.rd, sr.us, sr.compRd, { font: { bold: true } });
            break;
          case "intermediateTotal":
            addRow("", sr.label, sr.rd, sr.us, sr.compRd, { 
              font: { bold: true, size: 12 },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } } as ExcelJS.Fill
            });
            break;
          case "netIncome":
            addRow("", sr.label, sr.rd, sr.us, sr.compRd, { 
              font: { bold: true, size: 14 },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFC5D9F1" } } as ExcelJS.Fill
            });
            break;
          case "blank":
            row++;
            break;
        }
      });

      ws.getColumn(colC).numFmt = '#,##0.00';
      if (hasUsd) ws.getColumn(colD).numFmt = '#,##0.00';

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${language === "en" ? "profit_loss" : "estado_resultados"}_${startDate}_${endDate}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(t("acctReport.excelSuccess"));
    } catch (e) { console.error(e); toast.error(t("acctReport.excelError")); }
  };

  // ─── PDF EXPORT ───
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: compareEnabled ? "landscape" : "portrait" });
    doc.setFontSize(16);
    doc.text(t("pl.title"), 14, 20);
    doc.setFontSize(10);
    doc.text(`${t("pl.period")}: ${startDate} — ${endDate}`, 14, 28);
    let y = 34;
    if (compareEnabled) { doc.text(`${t("pl.compare")}: ${compStartDate} — ${compEndDate}`, 14, y); y += 6; }
    if (costCenter !== "all") { doc.text(`${t("acctReport.costCenter")}: ${ccLabels[costCenter]}`, 14, y); y += 6; }
    if (hasUsd) { doc.text(`${t("pl.exchangeRate")}: ${exchangeRate}`, 14, y); y += 6; }

    const headers = [t("acctReport.col.account"), t("acctReport.col.description"), "RD$"];
    if (hasUsd) headers.push("US$");
    if (compareEnabled) headers.push(t("pl.priorRd"), t("pl.variance"), t("pl.variancePct"));

    const body: any[][] = [];
    const sectionHeaderIndices: number[] = [];
    const intermediateIndices: number[] = [];
    const netIncomeIndex: number[] = [];

    const fmtCompCells = (rd: number, compRd: number) => {
      if (!compareEnabled) return [];
      return [formatCurrency(compRd, "DOP"), fmtVar(rd, compRd), fmtVarPct(rd, compRd)];
    };

    statementRows.forEach(sr => {
      switch (sr.type) {
        case "sectionHeader":
          sectionHeaderIndices.push(body.length);
          body.push([sr.label, "", "", ...(hasUsd ? [""] : []), ...(compareEnabled ? ["", "", ""] : [])]);
          break;
        case "categoryHeader":
          body.push(["", sr.label, "", ...(hasUsd ? [""] : []), ...(compareEnabled ? ["", "", ""] : [])]);
          break;
        case "account":
          body.push([`  ${sr.code}`, `  ${sr.name}`, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [sr.us ? formatCurrency(sr.us, "USD") : "—"] : []), ...fmtCompCells(sr.rd, sr.compRd)]);
          break;
        case "categorySubtotal":
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [sr.us ? formatCurrency(sr.us, "USD") : "—"] : []), ...fmtCompCells(sr.rd, sr.compRd)]);
          break;
        case "sectionTotal":
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [formatCurrency(sr.us, "USD")] : []), ...fmtCompCells(sr.rd, sr.compRd)]);
          break;
        case "intermediateTotal":
          intermediateIndices.push(body.length);
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [formatCurrency(sr.us, "USD")] : []), ...fmtCompCells(sr.rd, sr.compRd)]);
          break;
        case "netIncome":
          netIncomeIndex.push(body.length);
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [formatCurrency(sr.us, "USD")] : []), ...fmtCompCells(sr.rd, sr.compRd)]);
          break;
        case "blank":
          body.push(Array(headers.length).fill(""));
          break;
      }
    });

    autoTable(doc, {
      head: [headers],
      body,
      startY: y,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
      didParseCell: (data: any) => {
        if (data.section === "body") {
          const idx = data.row.index;
          if (sectionHeaderIndices.includes(idx)) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [232, 238, 244];
          }
          if (intermediateIndices.includes(idx)) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [220, 230, 241];
          }
          if (netIncomeIndex.includes(idx)) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
            data.cell.styles.fillColor = [197, 217, 241];
          }
        }
      },
    });
    doc.save(`${language === "en" ? "profit_loss" : "estado_resultados"}_${startDate}_${endDate}.pdf`);
    toast.success(t("acctReport.pdfSuccess"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>{t("acctReport.startDate")}</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>{t("acctReport.endDate")}</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>{t("acctReport.costCenter")}</Label>
          <Select value={costCenter} onValueChange={setCostCenter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="agricultural">{ccLabels.agricultural}</SelectItem>
              <SelectItem value="industrial">{ccLabels.industrial}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("pl.exchangeRate")} (USD→DOP)</Label>
          <Input type="number" step="0.01" min="1" value={exchangeRate}
            onChange={e => { manuallyEdited.current = true; setExchangeRate(parseFloat(e.target.value) || 1); }} className="w-28" />
        </div>
        <div className="flex items-center gap-2 self-end pb-1">
          <Switch checked={compareEnabled} onCheckedChange={setCompareEnabled} className="scale-75" />
          <span className="text-xs text-muted-foreground">{t("pl.compare")}</span>
        </div>
        {compareEnabled && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">{t("pl.priorStart")}</Label>
              <Input type="date" value={compStartDate} onChange={e => setCompStartDate(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("pl.priorEnd")}</Label>
              <Input type="date" value={compEndDate} onChange={e => setCompEndDate(e.target.value)} className="w-36" />
            </div>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" />
              {t("acctReport.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover">
            <DropdownMenuItem onClick={exportToExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <UnlinkedTransactionsWarning startDate={startDate} endDate={endDate} />

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{t("acctReport.col.account")}</TableHead>
                <TableHead>{t("acctReport.col.description")}</TableHead>
                <TableHead className="text-right w-36">RD$</TableHead>
                {hasUsd && <TableHead className="text-right w-36">US$</TableHead>}
                {compareEnabled && (
                  <>
                    <TableHead className="text-right w-36">{t("pl.priorRd")}</TableHead>
                    <TableHead className="text-right w-32">{t("pl.variance")}</TableHead>
                    <TableHead className="text-right w-24">{t("pl.variancePct")}</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {statementRows.map((row, i) => {
                switch (row.type) {
                  case "sectionHeader":
                    return (
                      <TableRow key={i} className="bg-primary/10">
                        <TableCell colSpan={colCount} className="font-bold text-base py-3">
                          {row.label}
                        </TableCell>
                      </TableRow>
                    );
                  case "categoryHeader":
                    return (
                      <TableRow key={i} className="bg-muted/30">
                        <TableCell />
                        <TableCell className="font-semibold italic text-sm" colSpan={colCount - 1}>
                          {row.label}
                        </TableCell>
                      </TableRow>
                    );
                  case "account":
                    return (
                      <TableRow key={i}>
                        <TableCell className="pl-8 text-muted-foreground">{row.code}</TableCell>
                        <TableCell className="pl-8">{row.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.rd, "DOP")}</TableCell>
                        {hasUsd && <TableCell className="text-right">{row.us !== 0 ? formatCurrency(row.us, "USD") : "—"}</TableCell>}
                        <VarCells rd={row.rd} compRd={row.compRd} />
                      </TableRow>
                    );
                  case "categorySubtotal":
                    return (
                      <TableRow key={i} className="border-t border-dashed">
                        <TableCell />
                        <TableCell className="text-right italic text-sm text-muted-foreground pr-4">{row.label}</TableCell>
                        <TableCell className="text-right italic text-sm">{formatCurrency(row.rd, "DOP")}</TableCell>
                        {hasUsd && <TableCell className="text-right italic text-sm">{row.us !== 0 ? formatCurrency(row.us, "USD") : "—"}</TableCell>}
                        <VarCells rd={row.rd} compRd={row.compRd} />
                      </TableRow>
                    );
                  case "sectionTotal":
                    return (
                      <TableRow key={i} className="border-t-2 border-primary/20">
                        <TableCell />
                        <TableCell className="font-bold">{row.label}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(row.rd, "DOP")}</TableCell>
                        {hasUsd && <TableCell className="text-right font-bold">{formatCurrency(row.us, "USD")}</TableCell>}
                        <VarCells rd={row.rd} compRd={row.compRd} />
                      </TableRow>
                    );
                  case "intermediateTotal":
                    return (
                      <TableRow key={i} className="bg-primary/5 border-y-2 border-primary/30">
                        <TableCell />
                        <TableCell className="font-bold text-base">{row.label}</TableCell>
                        <TableCell className={`text-right font-bold text-base ${row.rd >= 0 ? "" : "text-destructive"}`}>
                          {formatCurrency(row.rd, "DOP")}
                        </TableCell>
                        {hasUsd && (
                          <TableCell className={`text-right font-bold text-base ${row.us >= 0 ? "" : "text-destructive"}`}>
                            {formatCurrency(row.us, "USD")}
                          </TableCell>
                        )}
                        <VarCells rd={row.rd} compRd={row.compRd} />
                      </TableRow>
                    );
                  case "netIncome":
                    return (
                      <TableRow key={i} className="bg-muted border-y-4 border-primary/40">
                        <TableCell />
                        <TableCell className="font-bold text-lg">{row.label}</TableCell>
                        <TableCell className={`text-right font-bold text-lg ${row.rd >= 0 ? "text-primary" : "text-destructive"}`}>
                          {formatCurrency(row.rd, "DOP")}
                        </TableCell>
                        {hasUsd && (
                          <TableCell className={`text-right font-bold text-lg ${row.us >= 0 ? "text-primary" : "text-destructive"}`}>
                            {formatCurrency(row.us, "USD")}
                          </TableCell>
                        )}
                        <VarCells rd={row.rd} compRd={row.compRd} />
                      </TableRow>
                    );
                  case "blank":
                    return (
                      <TableRow key={i} className="h-2 border-0">
                        <TableCell colSpan={colCount} className="p-0" />
                      </TableRow>
                    );
                  default:
                    return null;
                }
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
