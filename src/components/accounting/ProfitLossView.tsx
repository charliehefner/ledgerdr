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
  amount: number;
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

  // Fetch chart of accounts
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

  // Fetch transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["pl-transactions", startDate, endDate, costCenter],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("master_acct_code, amount, currency, transaction_direction, cost_center")
        .eq("is_void", false)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredTx = useMemo(() => {
    if (costCenter === "all") return transactions;
    return transactions.filter((tx: any) => (tx.cost_center || "general") === costCenter);
  }, [transactions, costCenter]);

  // Build account totals
  const accountTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredTx.forEach((tx: any) => {
      const code = tx.master_acct_code;
      if (!code) return;
      // For P&L: sales are credits (income), purchases are debits (expense)
      const amount = parseFloat(tx.amount) || 0;
      totals[code] = (totals[code] || 0) + amount;
    });
    return totals;
  }, [filteredTx]);

  // Build hierarchical structure
  const { incomeRows, expenseRows, totalIncome, totalExpenses } = useMemo(() => {
    const buildRows = (type: string): GroupedAccount[] => {
      const typeAccounts = accounts.filter(a => a.account_type === type);
      // Find parent accounts (those with children)
      const parentIds = new Set(typeAccounts.map(a => a.parent_id).filter(Boolean));
      const parents = typeAccounts.filter(a => parentIds.has(a.id));
      const children = typeAccounts.filter(a => !parentIds.has(a.id));

      // Group children under parents
      const parentMap = new Map<string, GroupedAccount>();
      parents.forEach(p => {
        parentMap.set(p.id, {
          code: p.account_code,
          name: language === "en" ? (p.english_description || p.account_name) : (p.spanish_description || p.account_name),
          amount: 0,
          isParent: true,
          children: [],
        });
      });

      const orphans: GroupedAccount[] = [];

      children.forEach(c => {
        const row: GroupedAccount = {
          code: c.account_code,
          name: language === "en" ? (c.english_description || c.account_name) : (c.spanish_description || c.account_name),
          amount: accountTotals[c.account_code] || 0,
        };

        if (c.parent_id && parentMap.has(c.parent_id)) {
          const parent = parentMap.get(c.parent_id)!;
          parent.children!.push(row);
          parent.amount += row.amount;
        } else {
          orphans.push(row);
        }
      });

      // Combine: parents with children + orphans, filter out zero-balance
      const result: GroupedAccount[] = [];
      [...parentMap.values()].forEach(p => {
        if (p.amount !== 0 || p.children!.some(c => c.amount !== 0)) {
          p.children = p.children!.filter(c => c.amount !== 0);
          result.push(p);
        }
      });
      orphans.filter(o => o.amount !== 0).forEach(o => result.push(o));

      return result.sort((a, b) => a.code.localeCompare(b.code));
    };

    const incomeRows = buildRows("INCOME");
    const expenseRows = buildRows("EXPENSE");
    const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);

    return { incomeRows, expenseRows, totalIncome, totalExpenses };
  }, [accounts, accountTotals, language]);

  const netIncome = totalIncome - totalExpenses;

  const getDesc = (key: string) => t(key);

  const renderRows = (rows: GroupedAccount[]) => {
    const result: JSX.Element[] = [];
    rows.forEach(row => {
      if (row.isParent && row.children && row.children.length > 0) {
        // Parent header
        result.push(
          <TableRow key={row.code} className="bg-muted/50">
            <TableCell className="font-semibold">{row.code}</TableCell>
            <TableCell className="font-semibold">{row.name}</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(row.amount, "DOP")}</TableCell>
          </TableRow>
        );
        row.children.forEach(child => {
          result.push(
            <TableRow key={child.code}>
              <TableCell className="pl-8">{child.code}</TableCell>
              <TableCell className="pl-8">{child.name}</TableCell>
              <TableCell className="text-right">{formatCurrency(child.amount, "DOP")}</TableCell>
            </TableRow>
          );
        });
      } else {
        result.push(
          <TableRow key={row.code}>
            <TableCell>{row.code}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.amount, "DOP")}</TableCell>
          </TableRow>
        );
      }
    });
    return result;
  };

  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("pl.title"));
      ws.columns = [
        { header: t("acctReport.col.account"), key: "code", width: 14 },
        { header: t("acctReport.col.description"), key: "name", width: 40 },
        { header: t("acctReport.col.amount"), key: "amount", width: 18 },
      ];

      const addSection = (title: string, rows: GroupedAccount[], total: number) => {
        ws.addRow({ code: "", name: title, amount: "" }).font = { bold: true, size: 12 };
        rows.forEach(r => {
          if (r.isParent && r.children) {
            ws.addRow({ code: r.code, name: r.name, amount: r.amount }).font = { bold: true };
            r.children.forEach(c => ws.addRow({ code: `  ${c.code}`, name: `  ${c.name}`, amount: c.amount }));
          } else {
            ws.addRow({ code: r.code, name: r.name, amount: r.amount });
          }
        });
        ws.addRow({ code: "", name: `Total ${title}`, amount: total }).font = { bold: true };
        ws.addRow({});
      };

      addSection(t("pl.income"), incomeRows, totalIncome);
      addSection(t("pl.expenses"), expenseRows, totalExpenses);
      ws.addRow({ code: "", name: t("pl.netIncome"), amount: netIncome }).font = { bold: true, size: 14 };

      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${language === "en" ? "profit_loss" : "estado_resultados"}_${startDate}_${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("acctReport.excelSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("acctReport.excelError"));
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(t("pl.title"), 14, 20);
    doc.setFontSize(10);
    doc.text(`${t("pl.period")}: ${startDate} — ${endDate}`, 14, 28);
    if (costCenter !== "all") doc.text(`${t("acctReport.costCenter")}: ${ccLabels[costCenter]}`, 14, 34);

    const rows: string[][] = [];
    const addSection = (title: string, items: GroupedAccount[], total: number) => {
      rows.push([title, "", ""]);
      items.forEach(r => {
        if (r.isParent && r.children) {
          rows.push([r.code, r.name, formatCurrency(r.amount, "DOP")]);
          r.children.forEach(c => rows.push([`  ${c.code}`, `  ${c.name}`, formatCurrency(c.amount, "DOP")]));
        } else {
          rows.push([r.code, r.name, formatCurrency(r.amount, "DOP")]);
        }
      });
      rows.push(["", `Total ${title}`, formatCurrency(total, "DOP")]);
      rows.push(["", "", ""]);
    };

    addSection(t("pl.income"), incomeRows, totalIncome);
    addSection(t("pl.expenses"), expenseRows, totalExpenses);
    rows.push(["", t("pl.netIncome"), formatCurrency(netIncome, "DOP")]);

    autoTable(doc, {
      head: [[t("acctReport.col.account"), t("acctReport.col.description"), t("acctReport.col.amount")]],
      body: rows,
      startY: costCenter !== "all" ? 40 : 34,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(`${language === "en" ? "profit_loss" : "estado_resultados"}_${startDate}_${endDate}.pdf`);
    toast.success(t("acctReport.pdfSuccess"));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
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
                <TableHead className="text-right w-40">{t("acctReport.col.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* INCOME */}
              <TableRow className="bg-primary/5">
                <TableCell colSpan={3} className="font-bold text-base">{t("pl.income")}</TableCell>
              </TableRow>
              {renderRows(incomeRows)}
              <TableRow className="border-t-2 border-primary/20">
                <TableCell />
                <TableCell className="font-bold">{t("pl.totalIncome")}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalIncome, "DOP")}</TableCell>
              </TableRow>

              {/* EXPENSES */}
              <TableRow className="bg-destructive/5">
                <TableCell colSpan={3} className="font-bold text-base">{t("pl.expenses")}</TableCell>
              </TableRow>
              {renderRows(expenseRows)}
              <TableRow className="border-t-2 border-destructive/20">
                <TableCell />
                <TableCell className="font-bold">{t("pl.totalExpenses")}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalExpenses, "DOP")}</TableCell>
              </TableRow>

              {/* NET INCOME */}
              <TableRow className="bg-muted border-t-4">
                <TableCell />
                <TableCell className="font-bold text-lg">{t("pl.netIncome")}</TableCell>
                <TableCell className={`text-right font-bold text-lg ${netIncome >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrency(netIncome, "DOP")}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
