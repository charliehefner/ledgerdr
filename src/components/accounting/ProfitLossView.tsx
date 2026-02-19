import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
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

interface AccountRow {
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id: string | null;
  id: string;
  english_description: string | null;
  spanish_description: string | null;
}

interface GroupedAccount {
  code: string;
  name: string;
  rdTotal: number;
  usTotal: number;
  isParent?: boolean;
  children?: GroupedAccount[];
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
        .select("id, account_code, account_name, account_type, parent_id, english_description, spanish_description")
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

  // Build account totals: RD$ includes converted USD, US$ shows raw USD
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

  const buildRows = (type: string): GroupedAccount[] => {
    const typeAccounts = accounts.filter(a => a.account_type === type);
    const parentIds = new Set(typeAccounts.map(a => a.parent_id).filter(Boolean));
    const parents = typeAccounts.filter(a => parentIds.has(a.id));
    const children = typeAccounts.filter(a => !parentIds.has(a.id));

    const parentMap = new Map<string, GroupedAccount>();
    parents.forEach(p => {
      parentMap.set(p.id, {
        code: p.account_code,
        name: language === "en" ? (p.english_description || p.account_name) : (p.spanish_description || p.account_name),
        rdTotal: 0, usTotal: 0,
        isParent: true,
        children: [],
      });
    });

    const orphans: GroupedAccount[] = [];
    children.forEach(c => {
      const t = accountTotals[c.account_code] || { rd: 0, us: 0 };
      const row: GroupedAccount = {
        code: c.account_code,
        name: language === "en" ? (c.english_description || c.account_name) : (c.spanish_description || c.account_name),
        rdTotal: t.rd, usTotal: t.us,
      };
      if (c.parent_id && parentMap.has(c.parent_id)) {
        const parent = parentMap.get(c.parent_id)!;
        parent.children!.push(row);
        parent.rdTotal += row.rdTotal;
        parent.usTotal += row.usTotal;
      } else {
        orphans.push(row);
      }
    });

    const result: GroupedAccount[] = [];
    [...parentMap.values()].forEach(p => {
      const hasData = p.rdTotal !== 0 || p.usTotal !== 0 || p.children!.some(c => c.rdTotal !== 0 || c.usTotal !== 0);
      if (hasData) {
        p.children = p.children!.filter(c => c.rdTotal !== 0 || c.usTotal !== 0);
        result.push(p);
      }
    });
    orphans.filter(o => o.rdTotal !== 0 || o.usTotal !== 0).forEach(o => result.push(o));
    return result.sort((a, b) => a.code.localeCompare(b.code));
  };

  const { incomeRows, expenseRows, totalIncomeRd, totalIncomeUs, totalExpensesRd, totalExpensesUs } = useMemo(() => {
    const incomeRows = buildRows("INCOME");
    const expenseRows = buildRows("EXPENSE");
    return {
      incomeRows, expenseRows,
      totalIncomeRd: incomeRows.reduce((s, r) => s + r.rdTotal, 0),
      totalIncomeUs: incomeRows.reduce((s, r) => s + r.usTotal, 0),
      totalExpensesRd: expenseRows.reduce((s, r) => s + r.rdTotal, 0),
      totalExpensesUs: expenseRows.reduce((s, r) => s + r.usTotal, 0),
    };
  }, [accounts, accountTotals, language]);

  const netRd = totalIncomeRd - totalExpensesRd;
  const netUs = totalIncomeUs - totalExpensesUs;
  const hasUsd = totalIncomeUs !== 0 || totalExpensesUs !== 0;

  const renderRows = (rows: GroupedAccount[]) => {
    const result: JSX.Element[] = [];
    rows.forEach(row => {
      const renderCells = (r: GroupedAccount, indent = false) => (
        <>
          <TableCell className={indent ? "pl-8" : ""}>{r.code}</TableCell>
          <TableCell className={indent ? "pl-8" : ""}>{r.name}</TableCell>
          <TableCell className="text-right">{formatCurrency(r.rdTotal, "DOP")}</TableCell>
          {hasUsd && <TableCell className="text-right">{r.usTotal !== 0 ? formatCurrency(r.usTotal, "USD") : "—"}</TableCell>}
        </>
      );

      if (row.isParent && row.children && row.children.length > 0) {
        result.push(
          <TableRow key={row.code} className="bg-muted/50 font-semibold">
            {renderCells(row)}
          </TableRow>
        );
        row.children.forEach(child => {
          result.push(
            <TableRow key={child.code}>
              {renderCells(child, true)}
            </TableRow>
          );
        });
      } else {
        result.push(
          <TableRow key={row.code}>
            {renderCells(row)}
          </TableRow>
        );
      }
    });
    return result;
  };

  const colCount = hasUsd ? 4 : 3;

  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("pl.title"));
      const cols: any[] = [
        { header: t("acctReport.col.account"), key: "code", width: 14 },
        { header: t("acctReport.col.description"), key: "name", width: 40 },
        { header: "RD$", key: "rd", width: 16 },
      ];
      if (hasUsd) cols.push({ header: "US$", key: "us", width: 16 });
      ws.columns = cols;

      const addSection = (title: string, rows: GroupedAccount[], totalRd: number, totalUs: number) => {
        ws.addRow({ code: "", name: title }).font = { bold: true, size: 12 };
        rows.forEach(r => {
          const addR = (g: GroupedAccount, indent = false) => {
            const row: any = { code: indent ? `  ${g.code}` : g.code, name: indent ? `  ${g.name}` : g.name, rd: g.rdTotal };
            if (hasUsd) row.us = g.usTotal;
            const wsRow = ws.addRow(row);
            if (!indent && r.isParent) wsRow.font = { bold: true };
          };
          if (r.isParent && r.children) {
            addR(r);
            r.children.forEach(c => addR(c, true));
          } else {
            addR(r);
          }
        });
        const totalRow: any = { code: "", name: `Total ${title}`, rd: totalRd };
        if (hasUsd) totalRow.us = totalUs;
        ws.addRow(totalRow).font = { bold: true };
        ws.addRow({});
      };

      addSection(t("pl.income"), incomeRows, totalIncomeRd, totalIncomeUs);
      addSection(t("pl.expenses"), expenseRows, totalExpensesRd, totalExpensesUs);
      const netRow: any = { code: "", name: t("pl.netIncome"), rd: netRd };
      if (hasUsd) netRow.us = netUs;
      ws.addRow(netRow).font = { bold: true, size: 14 };

      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${language === "en" ? "profit_loss" : "estado_resultados"}_${startDate}_${endDate}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(t("acctReport.excelSuccess"));
    } catch (e) { console.error(e); toast.error(t("acctReport.excelError")); }
  };

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

    const rows: string[][] = [];
    const addSection = (title: string, items: GroupedAccount[], totalRd: number, totalUs: number) => {
      const r: string[] = [title, "", ""];
      if (hasUsd) r.push("");
      rows.push(r);
      items.forEach(g => {
        const addR = (a: GroupedAccount, indent = false) => {
          const r = [indent ? `  ${a.code}` : a.code, indent ? `  ${a.name}` : a.name, formatCurrency(a.rdTotal, "DOP")];
          if (hasUsd) r.push(a.usTotal ? formatCurrency(a.usTotal, "USD") : "—");
          rows.push(r);
        };
        if (g.isParent && g.children) { addR(g); g.children.forEach(c => addR(c, true)); }
        else addR(g);
      });
      const tr = ["", `Total ${title}`, formatCurrency(totalRd, "DOP")];
      if (hasUsd) tr.push(formatCurrency(totalUs, "USD"));
      rows.push(tr);
      rows.push(Array(headers.length).fill(""));
    };

    addSection(t("pl.income"), incomeRows, totalIncomeRd, totalIncomeUs);
    addSection(t("pl.expenses"), expenseRows, totalExpensesRd, totalExpensesUs);
    const nr = ["", t("pl.netIncome"), formatCurrency(netRd, "DOP")];
    if (hasUsd) nr.push(formatCurrency(netUs, "USD"));
    rows.push(nr);

    autoTable(doc, { head: [headers], body: rows, startY: y, styles: { fontSize: 8 }, headStyles: { fillColor: [30, 58, 138] } });
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
              {/* INCOME */}
              <TableRow className="bg-primary/5">
                <TableCell colSpan={colCount} className="font-bold text-base">{t("pl.income")}</TableCell>
              </TableRow>
              {renderRows(incomeRows)}
              <TableRow className="border-t-2 border-primary/20">
                <TableCell />
                <TableCell className="font-bold">{t("pl.totalIncome")}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalIncomeRd, "DOP")}</TableCell>
                {hasUsd && <TableCell className="text-right font-bold">{formatCurrency(totalIncomeUs, "USD")}</TableCell>}
              </TableRow>

              {/* EXPENSES */}
              <TableRow className="bg-destructive/5">
                <TableCell colSpan={colCount} className="font-bold text-base">{t("pl.expenses")}</TableCell>
              </TableRow>
              {renderRows(expenseRows)}
              <TableRow className="border-t-2 border-destructive/20">
                <TableCell />
                <TableCell className="font-bold">{t("pl.totalExpenses")}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalExpensesRd, "DOP")}</TableCell>
                {hasUsd && <TableCell className="text-right font-bold">{formatCurrency(totalExpensesUs, "USD")}</TableCell>}
              </TableRow>

              {/* NET INCOME */}
              <TableRow className="bg-muted border-t-4">
                <TableCell />
                <TableCell className="font-bold text-lg">{t("pl.netIncome")}</TableCell>
                <TableCell className={`text-right font-bold text-lg ${netRd >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrency(netRd, "DOP")}
                </TableCell>
                {hasUsd && (
                  <TableCell className={`text-right font-bold text-lg ${netUs >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrency(netUs, "USD")}
                  </TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
