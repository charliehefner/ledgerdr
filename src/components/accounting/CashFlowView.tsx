import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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

type CashFlowSection = "operating" | "investing" | "financing";

// Map account prefixes to cash flow sections
function getCFSection(code: string): CashFlowSection | null {
  const p = parseInt(code.substring(0, 2), 10) || 0;
  // Assets 10-19: operating (receivables, prepaid, etc.)
  // Fixed Assets 12-15: investing
  if (p >= 12 && p <= 15) return "investing";
  if (p >= 10 && p <= 11) return "operating";
  if (p >= 16 && p <= 19) return "operating";
  // Liabilities 20-29: operating (payables, accrued)
  // Long-term debt 24-29: financing
  if (p >= 20 && p <= 23) return "operating";
  if (p >= 24 && p <= 29) return "financing";
  // Equity 30-39 (in BS context these are equity, but in CF they're financing)
  // Actually equity codes in this system are separate account_type
  return null;
}

function getCFSectionByType(accountType: string, code: string): CashFlowSection | null {
  if (accountType === "INCOME" || accountType === "EXPENSE") return null; // handled via net income
  if (accountType === "EQUITY") return "financing";
  if (accountType === "ASSET") {
    const p = parseInt(code.substring(0, 2), 10) || 0;
    if (p >= 12 && p <= 15) return "investing";
    return "operating";
  }
  if (accountType === "LIABILITY") {
    const p = parseInt(code.substring(0, 2), 10) || 0;
    if (p >= 24 && p <= 29) return "financing";
    return "operating";
  }
  return null;
}

interface AccountRow {
  account_code: string;
  account_name: string;
  account_type: string;
  id: string;
  english_description: string | null;
  spanish_description: string | null;
}

interface CFLine {
  code: string;
  name: string;
  amount: number; // positive = source, negative = use
}

export function CashFlowView() {
  const { t, language } = useLanguage();
  const ccLabels = CC_LABELS[language] || CC_LABELS.es;

  const now = new Date();
  const [startDate, setStartDate] = useState(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(now, "yyyy-MM-dd"));
  const [costCenter, setCostCenter] = useState("all");
  const [exchangeRate, setExchangeRate] = useState(60);

  // Fetch all accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-cf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, english_description, spanish_description")
        .is("deleted_at", null)
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

  // Opening balances (before start date) — from posted journals
  const { data: openingBalances = [] } = useQuery({
    queryKey: ["cf-opening-journals", startDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_balances_from_journals", {
        p_end: format(new Date(new Date(startDate).getTime() - 86400000), "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data || []) as JournalBalance[];
    },
  });

  // Closing balances (up to end date) — from posted journals
  const { data: closingBalances = [], isLoading } = useQuery({
    queryKey: ["cf-closing-journals", endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_balances_from_journals", {
        p_end: endDate,
      });
      if (error) throw error;
      return (data || []) as JournalBalance[];
    },
  });

  // Period balances for P&L (net income calculation) — from posted journals
  const { data: periodBalances = [] } = useQuery({
    queryKey: ["cf-period-journals", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_balances_from_journals", {
        p_start: startDate,
        p_end: endDate,
      });
      if (error) throw error;
      return (data || []) as JournalBalance[];
    },
  });

  const buildTotals = (rows: JournalBalance[]) => {
    const totals: Record<string, number> = {};
    rows.forEach((r) => {
      const code = r.account_code;
      if (!code) return;
      const amount = r.balance; // debit - credit
      if (r.currency === "USD" || r.currency === "EUR") {
        totals[code] = (totals[code] || 0) + amount * exchangeRate;
      } else {
        totals[code] = (totals[code] || 0) + amount;
      }
    });
    return totals;
  };

  const { sections, netIncome, depreciation, netCashChange } = useMemo(() => {
    const openTotals = buildTotals(openingTx);
    const closeTotals = buildTotals(closingTx);
    const periodTotals = buildTotals(periodTx);

    // Calculate net income from P&L accounts
    const incomeAccounts = accounts.filter(a => a.account_type === "INCOME");
    const expenseAccounts = accounts.filter(a => a.account_type === "EXPENSE");
    const totalIncome = incomeAccounts.reduce((s, a) => s + (periodTotals[a.account_code] || 0), 0);
    const totalExpense = expenseAccounts.reduce((s, a) => s + (periodTotals[a.account_code] || 0), 0);
    const netIncome = totalIncome - totalExpense;

    // Depreciation add-back (account prefix 69)
    const depAccounts = accounts.filter(a => {
      const p = parseInt(a.account_code.substring(0, 2), 10);
      return p === 69 && a.account_type === "EXPENSE";
    });
    const depreciation = depAccounts.reduce((s, a) => s + (periodTotals[a.account_code] || 0), 0);

    // Calculate BS account changes
    const bsAccounts = accounts.filter(a => 
      ["ASSET", "LIABILITY", "EQUITY"].includes(a.account_type)
    );

    const operating: CFLine[] = [];
    const investing: CFLine[] = [];
    const financing: CFLine[] = [];

    const getName = (a: AccountRow) => 
      language === "en" ? (a.english_description || a.account_name) : (a.spanish_description || a.account_name);

    bsAccounts.forEach(a => {
      const section = getCFSectionByType(a.account_type, a.account_code);
      if (!section) return;
      
      const openBal = openTotals[a.account_code] || 0;
      const closeBal = closeTotals[a.account_code] || 0;
      const delta = closeBal - openBal;
      if (Math.abs(delta) < 0.01) return;

      // For cash flow: 
      // Asset increase = cash use (negative), Asset decrease = cash source (positive)
      // Liability/Equity increase = cash source (positive), decrease = use (negative)
      let cfAmount: number;
      if (a.account_type === "ASSET") {
        cfAmount = -delta; // asset increase uses cash
      } else {
        cfAmount = delta; // liability/equity increase provides cash
      }

      // Skip cash accounts (they're the result, not a source/use)
      const p = parseInt(a.account_code.substring(0, 2), 10);
      if (p === 10 && a.account_code.startsWith("100")) return; // cash & bank accounts

      const line: CFLine = { code: a.account_code, name: getName(a), amount: cfAmount };
      if (section === "operating") operating.push(line);
      else if (section === "investing") investing.push(line);
      else financing.push(line);
    });

    const sumLines = (lines: CFLine[]) => lines.reduce((s, l) => s + l.amount, 0);
    
    // Operating includes net income + depreciation add-back + working capital changes
    const operatingTotal = netIncome + depreciation + sumLines(operating);
    const investingTotal = sumLines(investing);
    const financingTotal = sumLines(financing);
    const netCashChange = operatingTotal + investingTotal + financingTotal;

    return {
      sections: {
        operating: { lines: operating, total: operatingTotal },
        investing: { lines: investing, total: investingTotal },
        financing: { lines: financing, total: financingTotal },
      },
      netIncome,
      depreciation,
      netCashChange,
    };
  }, [accounts, openingTx, closingTx, periodTx, costCenter, exchangeRate, language]);

  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("cf.title"));
      ws.columns = [
        { header: t("acctReport.col.account"), key: "code", width: 14 },
        { header: t("acctReport.col.description"), key: "name", width: 45 },
        { header: "RD$", key: "amount", width: 18 },
      ];

      const addHeader = (label: string) => {
        ws.addRow({ code: "", name: label }).font = { bold: true, size: 12 };
      };
      const addLine = (code: string, name: string, amount: number) => {
        ws.addRow({ code, name, amount });
      };
      const addTotal = (label: string, amount: number) => {
        const r = ws.addRow({ code: "", name: label, amount });
        r.font = { bold: true };
      };

      // Operating
      addHeader(t("cf.operating"));
      addLine("", t("cf.netIncome"), netIncome);
      if (depreciation !== 0) addLine("", t("cf.depreciationAddBack"), depreciation);
      if (sections.operating.lines.length > 0) {
        addLine("", t("cf.workingCapitalChanges"), 0);
        sections.operating.lines.forEach(l => addLine(l.code, `  ${l.name}`, l.amount));
      }
      addTotal(t("cf.totalOperating"), sections.operating.total);
      ws.addRow({});

      // Investing
      addHeader(t("cf.investing"));
      sections.investing.lines.forEach(l => addLine(l.code, `  ${l.name}`, l.amount));
      addTotal(t("cf.totalInvesting"), sections.investing.total);
      ws.addRow({});

      // Financing
      addHeader(t("cf.financing"));
      sections.financing.lines.forEach(l => addLine(l.code, `  ${l.name}`, l.amount));
      addTotal(t("cf.totalFinancing"), sections.financing.total);
      ws.addRow({});

      addTotal(t("cf.netChange"), netCashChange);

      ws.getColumn(3).numFmt = '#,##0.00';
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${language === "en" ? "cash_flow" : "flujo_efectivo"}_${startDate}_${endDate}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(t("acctReport.excelSuccess"));
    } catch (e) { console.error(e); toast.error(t("acctReport.excelError")); }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(t("cf.title"), 14, 20);
    doc.setFontSize(10); doc.text(`${t("pl.period")}: ${startDate} — ${endDate}`, 14, 28);

    const headers = [t("acctReport.col.account"), t("acctReport.col.description"), "RD$"];
    const body: string[][] = [];
    const sectionIndices: number[] = [];
    const totalIndices: number[] = [];

    const addSectionRows = (sectionKey: string, lines: CFLine[], total: number, extras?: { label: string; amount: number }[]) => {
      sectionIndices.push(body.length);
      body.push([t(sectionKey), "", ""]);
      if (extras) extras.forEach(e => body.push(["", e.label, formatCurrency(e.amount, "DOP")]));
      lines.forEach(l => body.push([l.code, `  ${l.name}`, formatCurrency(l.amount, "DOP")]));
      totalIndices.push(body.length);
      body.push(["", t(`cf.total${sectionKey.split(".")[1].charAt(0).toUpperCase() + sectionKey.split(".")[1].slice(1)}`), formatCurrency(total, "DOP")]);
      body.push(["", "", ""]);
    };

    const opExtras = [{ label: t("cf.netIncome"), amount: netIncome }];
    if (depreciation !== 0) opExtras.push({ label: t("cf.depreciationAddBack"), amount: depreciation });
    addSectionRows("cf.operating", sections.operating.lines, sections.operating.total, opExtras);
    addSectionRows("cf.investing", sections.investing.lines, sections.investing.total);
    addSectionRows("cf.financing", sections.financing.lines, sections.financing.total);

    totalIndices.push(body.length);
    body.push(["", t("cf.netChange"), formatCurrency(netCashChange, "DOP")]);

    autoTable(doc, {
      head: [headers], body, startY: 34, styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
      didParseCell: (data: any) => {
        if (data.section === "body") {
          if (sectionIndices.includes(data.row.index)) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [232, 238, 244];
          }
          if (totalIndices.includes(data.row.index)) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    doc.save(`${language === "en" ? "cash_flow" : "flujo_efectivo"}_${startDate}_${endDate}.pdf`);
    toast.success(t("acctReport.pdfSuccess"));
  };

  const renderSection = (titleKey: string, lines: CFLine[], total: number, extras?: JSX.Element) => (
    <>
      <TableRow className="bg-primary/10">
        <TableCell colSpan={3} className="font-bold text-base py-3">{t(titleKey)}</TableCell>
      </TableRow>
      {extras}
      {lines.map((l, i) => (
        <TableRow key={`${titleKey}-${i}`}>
          <TableCell className="pl-8 text-muted-foreground">{l.code}</TableCell>
          <TableCell className="pl-8">{l.name}</TableCell>
          <TableCell className={`text-right ${l.amount < 0 ? "text-destructive" : ""}`}>
            {formatCurrency(l.amount, "DOP")}
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="border-t-2 border-primary/20">
        <TableCell />
        <TableCell className="font-bold">{t(`cf.total${titleKey.split(".")[1].charAt(0).toUpperCase() + titleKey.split(".")[1].slice(1)}`)}</TableCell>
        <TableCell className={`text-right font-bold ${total < 0 ? "text-destructive" : ""}`}>
          {formatCurrency(total, "DOP")}
        </TableCell>
      </TableRow>
      <TableRow className="h-2 border-0"><TableCell colSpan={3} className="p-0" /></TableRow>
    </>
  );

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
            onChange={e => setExchangeRate(parseFloat(e.target.value) || 1)} className="w-28" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" /> {t("acctReport.export")}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderSection("cf.operating", sections.operating.lines, sections.operating.total, (
                <>
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-medium">{t("cf.netIncome")}</TableCell>
                    <TableCell className={`text-right font-medium ${netIncome < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(netIncome, "DOP")}
                    </TableCell>
                  </TableRow>
                  {depreciation !== 0 && (
                    <TableRow>
                      <TableCell />
                      <TableCell className="italic">{t("cf.depreciationAddBack")}</TableCell>
                      <TableCell className="text-right italic">{formatCurrency(depreciation, "DOP")}</TableCell>
                    </TableRow>
                  )}
                  {sections.operating.lines.length > 0 && (
                    <TableRow className="bg-muted/30">
                      <TableCell />
                      <TableCell className="font-semibold italic text-sm" colSpan={2}>
                        {t("cf.workingCapitalChanges")}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {renderSection("cf.investing", sections.investing.lines, sections.investing.total)}
              {renderSection("cf.financing", sections.financing.lines, sections.financing.total)}

              {/* Net Change */}
              <TableRow className="bg-muted border-y-4 border-primary/40">
                <TableCell />
                <TableCell className="font-bold text-lg">{t("cf.netChange")}</TableCell>
                <TableCell className={`text-right font-bold text-lg ${netCashChange >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrency(netCashChange, "DOP")}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
