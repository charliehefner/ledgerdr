import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
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

const CC_LABELS: Record<string, Record<string, string>> = {
  es: { general: "General", agricultural: "Agrícola", industrial: "Industrial" },
  en: { general: "General", agricultural: "Agricultural", industrial: "Industrial" },
};

// ─── Category mapping by account_code prefix ───
type SectionType = "revenue" | "cogs" | "opex" | "financial";

interface PLCategory {
  prefixMin: number;
  prefixMax: number;
  labelKey: string;          // translation key
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
}

interface CategoryBlock {
  category: PLCategory;
  label: string;
  accounts: AcctLine[];
  rdTotal: number;
  usTotal: number;
}

// Row types for rendering
type StatementRow =
  | { type: "sectionHeader"; label: string }
  | { type: "categoryHeader"; label: string }
  | { type: "account"; code: string; name: string; rd: number; us: number }
  | { type: "categorySubtotal"; label: string; rd: number; us: number }
  | { type: "sectionTotal"; label: string; rd: number; us: number }
  | { type: "intermediateTotal"; label: string; rd: number; us: number }
  | { type: "netIncome"; label: string; rd: number; us: number }
  | { type: "blank" };

function getAcctName(a: AccountRow, language: Language) {
  return language === "en"
    ? (a.english_description || a.account_name)
    : (a.spanish_description || a.account_name);
}

export function ProfitLossView() {
  const { t, language } = useLanguage();
  const ccLabels = CC_LABELS[language] || CC_LABELS.es;

  const now = new Date();
  const [startDate, setStartDate] = useState(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(now, "yyyy-MM-dd"));
  const [costCenter, setCostCenter] = useState("all");
  const [exchangeRate, setExchangeRate] = useState(60);

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

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["pl-transactions", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("master_acct_code, amount, currency, transaction_direction, cost_center")
        .eq("is_void", false)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredTx = useMemo(() => {
    if (costCenter === "all") return transactions;
    return transactions.filter((tx: any) => (tx.cost_center || "general") === costCenter);
  }, [transactions, costCenter]);

  const accountTotals = useMemo(() => {
    const totals: Record<string, { rd: number; us: number }> = {};
    filteredTx.forEach((tx: any) => {
      const code = tx.master_acct_code;
      if (!code) return;
      const amount = parseFloat(tx.amount) || 0;
      if (!totals[code]) totals[code] = { rd: 0, us: 0 };
      if (tx.currency === "USD") {
        totals[code].us += amount;
        totals[code].rd += amount * exchangeRate;
      } else {
        totals[code].rd += amount;
      }
    });
    return totals;
  }, [filteredTx, exchangeRate]);

  // Build the full categorized statement
  const { statementRows, hasUsd } = useMemo(() => {
    // Group accounts into categories
    const catMap = new Map<PLCategory, AcctLine[]>();
    PL_CATEGORIES.forEach(c => catMap.set(c, []));

    accounts.forEach(a => {
      const cat = findCategory(a.account_code);
      if (!cat) return;
      const t = accountTotals[a.account_code] || { rd: 0, us: 0 };
      if (t.rd === 0 && t.us === 0) return;
      catMap.get(cat)!.push({
        code: a.account_code,
        name: getAcctName(a, language),
        rd: t.rd,
        us: t.us,
      });
    });

    // Build category blocks
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
      });
    });

    // Compute section totals
    const sumSection = (section: SectionType) => {
      const sectionBlocks = blocks.filter(b => b.category.section === section);
      return {
        rd: sectionBlocks.reduce((s, b) => s + b.rdTotal, 0),
        us: sectionBlocks.reduce((s, b) => s + b.usTotal, 0),
        blocks: sectionBlocks,
      };
    };

    const revenue = sumSection("revenue");
    const cogs = sumSection("cogs");
    const opex = sumSection("opex");
    const financial = sumSection("financial");

    const grossProfitRd = revenue.rd - cogs.rd;
    const grossProfitUs = revenue.us - cogs.us;
    const ebitRd = grossProfitRd - opex.rd;
    const ebitUs = grossProfitUs - opex.us;
    // Financial items: income accounts (70-79) add, expense accounts (80-89) subtract
    // Since all are already signed by type (income = positive via transaction amounts), 
    // we treat financial section net as: income items - expense items
    // But since they're all stored as positive amounts regardless of type, 
    // we need to check: revenue-type financial items add, expense-type subtract
    // Actually, based on account_type in chart_of_accounts, INCOME accounts in financial 
    // section add value, EXPENSE accounts subtract.
    // But in this simplified approach, all financial section amounts come from transactions 
    // which are already signed appropriately. Let's just net them:
    // Financial income (70-79) - Financial expenses (80-89)
    const financialNetRd = financial.blocks.reduce((s, b) => {
      const prefix = b.category.prefixMin;
      // 70-84 range includes both income (70-79) and expenses (80-84)
      // Check account types from the original accounts data
      return s + b.rdTotal; // Already computed as positive amounts
    }, 0);
    const financialNetUs = financial.blocks.reduce((s, b) => s + b.usTotal, 0);
    
    // For financial items, income accounts should be positive, expense accounts negative for net
    // Let's recalculate based on account types
    let financialIncomeRd = 0, financialIncomeUs = 0;
    let financialExpenseRd = 0, financialExpenseUs = 0;
    financial.blocks.forEach(b => {
      b.accounts.forEach(acct => {
        const origAccount = accounts.find(a => a.account_code === acct.code);
        if (origAccount?.account_type === "INCOME") {
          financialIncomeRd += acct.rd;
          financialIncomeUs += acct.us;
        } else {
          financialExpenseRd += acct.rd;
          financialExpenseUs += acct.us;
        }
      });
    });
    const netFinancialRd = financialIncomeRd - financialExpenseRd;
    const netFinancialUs = financialIncomeUs - financialExpenseUs;

    const netIncomeRd = ebitRd + netFinancialRd;
    const netIncomeUs = ebitUs + netFinancialUs;

    // Check if any USD present
    const allBlocks = [...revenue.blocks, ...cogs.blocks, ...opex.blocks, ...financial.blocks];
    const hasUsd = allBlocks.some(b => b.usTotal !== 0);

    // Build statement rows
    const rows: StatementRow[] = [];

    // ─── REVENUE ───
    if (revenue.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.income") });
      revenue.blocks.forEach(b => {
        b.accounts.forEach(a => rows.push({ type: "account", ...a }));
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalIncome"), rd: revenue.rd, us: revenue.us });
      rows.push({ type: "blank" });
    }

    // ─── COGS ───
    if (cogs.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.cogs") });
      cogs.blocks.forEach(b => {
        b.accounts.forEach(a => rows.push({ type: "account", ...a }));
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalCogs"), rd: cogs.rd, us: cogs.us });
      rows.push({ type: "blank" });
    }

    // ─── GROSS PROFIT ───
    rows.push({ type: "intermediateTotal", label: t("pl.grossProfit"), rd: grossProfitRd, us: grossProfitUs });
    rows.push({ type: "blank" });

    // ─── OPERATING EXPENSES ───
    if (opex.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.operatingExpenses") });
      rows.push({ type: "blank" });
      opex.blocks.forEach(b => {
        rows.push({ type: "categoryHeader", label: b.label });
        b.accounts.forEach(a => rows.push({ type: "account", ...a }));
        rows.push({ type: "categorySubtotal", label: t("pl.subtotal"), rd: b.rdTotal, us: b.usTotal });
        rows.push({ type: "blank" });
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalOpex"), rd: opex.rd, us: opex.us });
      rows.push({ type: "blank" });
    }

    // ─── EBIT ───
    rows.push({ type: "intermediateTotal", label: t("pl.ebit"), rd: ebitRd, us: ebitUs });
    rows.push({ type: "blank" });

    // ─── FINANCIAL / OTHER ───
    if (financial.blocks.length > 0) {
      rows.push({ type: "sectionHeader", label: t("pl.financialItems") });
      financial.blocks.forEach(b => {
        b.accounts.forEach(acct => {
          const origAccount = accounts.find(a => a.account_code === acct.code);
          const sign = origAccount?.account_type === "EXPENSE" ? -1 : 1;
          rows.push({ type: "account", code: acct.code, name: acct.name, rd: acct.rd * sign, us: acct.us * sign });
        });
      });
      rows.push({ type: "sectionTotal", label: t("pl.totalFinancial"), rd: netFinancialRd, us: netFinancialUs });
      rows.push({ type: "blank" });
    }

    // ─── NET INCOME ───
    rows.push({ type: "netIncome", label: t("pl.netIncome"), rd: netIncomeRd, us: netIncomeUs });

    return { statementRows: rows, hasUsd };
  }, [accounts, accountTotals, language, t]);

  const colCount = hasUsd ? 4 : 3;

  // ─── EXCEL EXPORT ───
  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("pl.title"));
      
      // Title
      ws.mergeCells("A1:D1");
      ws.getCell("A1").value = t("pl.title");
      ws.getCell("A1").font = { bold: true, size: 16 };
      ws.mergeCells("A2:D2");
      ws.getCell("A2").value = `${t("pl.period")}: ${startDate} — ${endDate}`;
      ws.getCell("A2").font = { size: 10 };
      
      let row = 4;
      const colA = 1, colB = 2, colC = 3, colD = 4;
      ws.getColumn(colA).width = 14;
      ws.getColumn(colB).width = 40;
      ws.getColumn(colC).width = 18;
      ws.getColumn(colD).width = 18;

      const addRow = (code: string, name: string, rd?: number, us?: number, style?: Partial<ExcelJS.Style>) => {
        const r = ws.getRow(row);
        r.getCell(colA).value = code;
        r.getCell(colB).value = name;
        if (rd !== undefined) r.getCell(colC).value = rd;
        if (us !== undefined && hasUsd) r.getCell(colD).value = us;
        if (style?.font) r.font = style.font;
        if (style?.fill) r.fill = style.fill as ExcelJS.Fill;
        row++;
      };

      statementRows.forEach(sr => {
        switch (sr.type) {
          case "sectionHeader":
            addRow("", sr.label, undefined, undefined, { 
              font: { bold: true, size: 12 },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF4" } } as ExcelJS.Fill 
            });
            break;
          case "categoryHeader":
            addRow("", `  ${sr.label}`, undefined, undefined, { font: { bold: true, italic: true } });
            break;
          case "account":
            addRow(`    ${sr.code}`, `    ${sr.name}`, sr.rd, sr.us);
            break;
          case "categorySubtotal":
            addRow("", `        ${sr.label}`, sr.rd, sr.us, { font: { italic: true } });
            break;
          case "sectionTotal":
            addRow("", sr.label, sr.rd, sr.us, { font: { bold: true } });
            break;
          case "intermediateTotal":
            addRow("", sr.label, sr.rd, sr.us, { 
              font: { bold: true, size: 12 },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } } as ExcelJS.Fill
            });
            break;
          case "netIncome":
            addRow("", sr.label, sr.rd, sr.us, { 
              font: { bold: true, size: 14 },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFC5D9F1" } } as ExcelJS.Fill
            });
            break;
          case "blank":
            row++;
            break;
        }
      });

      // Format number columns
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
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(t("pl.title"), 14, 20);
    doc.setFontSize(10);
    doc.text(`${t("pl.period")}: ${startDate} — ${endDate}`, 14, 28);
    let y = 34;
    if (costCenter !== "all") { doc.text(`${t("acctReport.costCenter")}: ${ccLabels[costCenter]}`, 14, y); y += 6; }
    if (hasUsd) { doc.text(`${t("pl.exchangeRate")}: ${exchangeRate}`, 14, y); y += 6; }

    const headers = [t("acctReport.col.account"), t("acctReport.col.description"), "RD$"];
    if (hasUsd) headers.push("US$");

    const body: any[][] = [];
    const sectionHeaderIndices: number[] = [];
    const intermediateIndices: number[] = [];
    const netIncomeIndex: number[] = [];

    statementRows.forEach(sr => {
      switch (sr.type) {
        case "sectionHeader":
          sectionHeaderIndices.push(body.length);
          body.push([sr.label, "", "", ...(hasUsd ? [""] : [])]);
          break;
        case "categoryHeader":
          body.push(["", sr.label, "", ...(hasUsd ? [""] : [])]);
          break;
        case "account":
          body.push([`  ${sr.code}`, `  ${sr.name}`, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [sr.us ? formatCurrency(sr.us, "USD") : "—"] : [])]);
          break;
        case "categorySubtotal":
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [sr.us ? formatCurrency(sr.us, "USD") : "—"] : [])]);
          break;
        case "sectionTotal":
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [formatCurrency(sr.us, "USD")] : [])]);
          break;
        case "intermediateTotal":
          intermediateIndices.push(body.length);
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [formatCurrency(sr.us, "USD")] : [])]);
          break;
        case "netIncome":
          netIncomeIndex.push(body.length);
          body.push(["", sr.label, formatCurrency(sr.rd, "DOP"), ...(hasUsd ? [formatCurrency(sr.us, "USD")] : [])]);
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
          <Input
            type="number"
            step="0.01"
            min="1"
            value={exchangeRate}
            onChange={e => setExchangeRate(parseFloat(e.target.value) || 1)}
            className="w-28"
          />
        </div>
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
                      </TableRow>
                    );
                  case "categorySubtotal":
                    return (
                      <TableRow key={i} className="border-t border-dashed">
                        <TableCell />
                        <TableCell className="text-right italic text-sm text-muted-foreground pr-4">{row.label}</TableCell>
                        <TableCell className="text-right italic text-sm">{formatCurrency(row.rd, "DOP")}</TableCell>
                        {hasUsd && <TableCell className="text-right italic text-sm">{row.us !== 0 ? formatCurrency(row.us, "USD") : "—"}</TableCell>}
                      </TableRow>
                    );
                  case "sectionTotal":
                    return (
                      <TableRow key={i} className="border-t-2 border-primary/20">
                        <TableCell />
                        <TableCell className="font-bold">{row.label}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(row.rd, "DOP")}</TableCell>
                        {hasUsd && <TableCell className="text-right font-bold">{formatCurrency(row.us, "USD")}</TableCell>}
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
