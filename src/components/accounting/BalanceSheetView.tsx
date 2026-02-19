import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Download, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
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
  dop: number;
  usd: number;
  isParent?: boolean;
  children?: GroupedAccount[];
}

export function BalanceSheetView() {
  const { t, language } = useLanguage();
  const ccLabels = CC_LABELS[language] || CC_LABELS.es;

  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [costCenter, setCostCenter] = useState("all");
  const [exchangeRate, setExchangeRate] = useState(60);

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-bs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, parent_id, english_description, spanish_description")
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data as AccountRow[];
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["bs-transactions", asOfDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("master_acct_code, amount, currency, transaction_direction, cost_center")
        .eq("is_void", false)
        .lte("transaction_date", asOfDate);
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredTx = useMemo(() => {
    if (costCenter === "all") return transactions;
    return transactions.filter((tx: any) => (tx.cost_center || "general") === costCenter);
  }, [transactions, costCenter]);

  const accountTotals = useMemo(() => {
    const totals: Record<string, { dop: number; usd: number }> = {};
    filteredTx.forEach((tx: any) => {
      const code = tx.master_acct_code;
      if (!code) return;
      const amount = parseFloat(tx.amount) || 0;
      if (!totals[code]) totals[code] = { dop: 0, usd: 0 };
      if (tx.currency === "USD") {
        totals[code].usd += amount;
      } else {
        totals[code].dop += amount;
      }
    });
    return totals;
  }, [filteredTx]);

  const equiv = (dop: number, usd: number) => dop + usd * exchangeRate;

  const buildRows = (types: string[]): GroupedAccount[] => {
    const typeAccounts = accounts.filter(a => types.includes(a.account_type));
    const parentIds = new Set(typeAccounts.map(a => a.parent_id).filter(Boolean));
    const parents = typeAccounts.filter(a => parentIds.has(a.id));
    const children = typeAccounts.filter(a => !parentIds.has(a.id));

    const parentMap = new Map<string, GroupedAccount>();
    parents.forEach(p => {
      parentMap.set(p.id, {
        code: p.account_code,
        name: language === "en" ? (p.english_description || p.account_name) : (p.spanish_description || p.account_name),
        dop: 0, usd: 0,
        isParent: true,
        children: [],
      });
    });

    const orphans: GroupedAccount[] = [];
    children.forEach(c => {
      const tt = accountTotals[c.account_code] || { dop: 0, usd: 0 };
      const row: GroupedAccount = {
        code: c.account_code,
        name: language === "en" ? (c.english_description || c.account_name) : (c.spanish_description || c.account_name),
        dop: tt.dop, usd: tt.usd,
      };
      if (c.parent_id && parentMap.has(c.parent_id)) {
        const parent = parentMap.get(c.parent_id)!;
        parent.children!.push(row);
        parent.dop += row.dop;
        parent.usd += row.usd;
      } else {
        orphans.push(row);
      }
    });

    const result: GroupedAccount[] = [];
    [...parentMap.values()].forEach(p => {
      if (p.dop !== 0 || p.usd !== 0 || p.children!.some(c => c.dop !== 0 || c.usd !== 0)) {
        p.children = p.children!.filter(c => c.dop !== 0 || c.usd !== 0);
        result.push(p);
      }
    });
    orphans.filter(o => o.dop !== 0 || o.usd !== 0).forEach(o => result.push(o));
    return result.sort((a, b) => a.code.localeCompare(b.code));
  };

  const assetRows = useMemo(() => buildRows(["ASSET"]), [accounts, accountTotals, language]);
  const liabilityRows = useMemo(() => buildRows(["LIABILITY"]), [accounts, accountTotals, language]);
  const equityRows = useMemo(() => buildRows(["EQUITY"]), [accounts, accountTotals, language]);

  const sumDop = (rows: GroupedAccount[]) => rows.reduce((s, r) => s + r.dop, 0);
  const sumUsd = (rows: GroupedAccount[]) => rows.reduce((s, r) => s + r.usd, 0);

  const totalAssetsDop = sumDop(assetRows);
  const totalAssetsUsd = sumUsd(assetRows);
  const totalLiabDop = sumDop(liabilityRows);
  const totalLiabUsd = sumUsd(liabilityRows);
  const equityDop = sumDop(equityRows);
  const equityUsd = sumUsd(equityRows);

  // Retained earnings
  const { retainedDop, retainedUsd } = useMemo(() => {
    const incomeAccounts = accounts.filter(a => a.account_type === "INCOME");
    const expenseAccounts = accounts.filter(a => a.account_type === "EXPENSE");
    const incomeDop = incomeAccounts.reduce((s, a) => s + (accountTotals[a.account_code]?.dop || 0), 0);
    const incomeUsd = incomeAccounts.reduce((s, a) => s + (accountTotals[a.account_code]?.usd || 0), 0);
    const expenseDop = expenseAccounts.reduce((s, a) => s + (accountTotals[a.account_code]?.dop || 0), 0);
    const expenseUsd = expenseAccounts.reduce((s, a) => s + (accountTotals[a.account_code]?.usd || 0), 0);
    return { retainedDop: incomeDop - expenseDop, retainedUsd: incomeUsd - expenseUsd };
  }, [accounts, accountTotals]);

  const totalEquityDop = equityDop + retainedDop;
  const totalEquityUsd = equityUsd + retainedUsd;
  const totalLEDop = totalLiabDop + totalEquityDop;
  const totalLEUsd = totalLiabUsd + totalEquityUsd;

  const isBalanced = Math.abs(equiv(totalAssetsDop, totalAssetsUsd) - equiv(totalLEDop, totalLEUsd)) < 0.01;
  const hasUsd = totalAssetsUsd !== 0 || totalLiabUsd !== 0 || totalEquityUsd !== 0 || retainedUsd !== 0;
  const colCount = hasUsd ? 5 : 3;

  const renderRows = (rows: GroupedAccount[]) => {
    const result: JSX.Element[] = [];
    rows.forEach(row => {
      const renderCells = (r: GroupedAccount, indent = false) => (
        <>
          <TableCell className={indent ? "pl-8" : ""}>{r.code}</TableCell>
          <TableCell className={indent ? "pl-8" : ""}>{r.name}</TableCell>
          <TableCell className="text-right">{formatCurrency(r.dop, "DOP")}</TableCell>
          {hasUsd && <TableCell className="text-right">{r.usd !== 0 ? formatCurrency(r.usd, "USD") : "—"}</TableCell>}
          {hasUsd && <TableCell className="text-right">{formatCurrency(equiv(r.dop, r.usd), "DOP")}</TableCell>}
        </>
      );

      if (row.isParent && row.children && row.children.length > 0) {
        result.push(<TableRow key={row.code} className="bg-muted/50 font-semibold">{renderCells(row)}</TableRow>);
        row.children.forEach(child => {
          result.push(<TableRow key={child.code}>{renderCells(child, true)}</TableRow>);
        });
      } else {
        result.push(<TableRow key={row.code}>{renderCells(row)}</TableRow>);
      }
    });
    return result;
  };

  const TotalRow = ({ label, dop, usd, className = "" }: { label: string; dop: number; usd: number; className?: string }) => (
    <TableRow className={className}>
      <TableCell />
      <TableCell className="font-bold">{label}</TableCell>
      <TableCell className="text-right font-bold">{formatCurrency(dop, "DOP")}</TableCell>
      {hasUsd && <TableCell className="text-right font-bold">{formatCurrency(usd, "USD")}</TableCell>}
      {hasUsd && <TableCell className="text-right font-bold">{formatCurrency(equiv(dop, usd), "DOP")}</TableCell>}
    </TableRow>
  );

  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("bs.title"));
      const cols: any[] = [
        { header: t("acctReport.col.account"), key: "code", width: 14 },
        { header: t("acctReport.col.description"), key: "name", width: 40 },
        { header: "DOP", key: "dop", width: 16 },
      ];
      if (hasUsd) {
        cols.push({ header: "USD", key: "usd", width: 16 });
        cols.push({ header: `${t("pl.dopEquiv")} (${exchangeRate})`, key: "equiv", width: 18 });
      }
      ws.columns = cols;

      const addSection = (title: string, rows: GroupedAccount[], totalDop: number, totalUsd: number) => {
        ws.addRow({ code: "", name: title }).font = { bold: true, size: 12 };
        rows.forEach(r => {
          const add = (g: GroupedAccount, indent = false) => {
            const row: any = { code: indent ? `  ${g.code}` : g.code, name: indent ? `  ${g.name}` : g.name, dop: g.dop };
            if (hasUsd) { row.usd = g.usd; row.equiv = equiv(g.dop, g.usd); }
            ws.addRow(row);
          };
          if (r.isParent && r.children) { add(r); r.children.forEach(c => add(c, true)); }
          else add(r);
        });
        const tr: any = { code: "", name: `Total ${title}`, dop: totalDop };
        if (hasUsd) { tr.usd = totalUsd; tr.equiv = equiv(totalDop, totalUsd); }
        ws.addRow(tr).font = { bold: true };
        ws.addRow({});
      };

      addSection(t("bs.assets"), assetRows, totalAssetsDop, totalAssetsUsd);
      addSection(t("bs.liabilities"), liabilityRows, totalLiabDop, totalLiabUsd);
      // Equity
      ws.addRow({ code: "", name: t("bs.equity") }).font = { bold: true, size: 12 };
      equityRows.forEach(r => {
        const row: any = { code: r.code, name: r.name, dop: r.dop };
        if (hasUsd) { row.usd = r.usd; row.equiv = equiv(r.dop, r.usd); }
        ws.addRow(row);
      });
      const reRow: any = { code: "", name: t("bs.retainedEarnings"), dop: retainedDop };
      if (hasUsd) { reRow.usd = retainedUsd; reRow.equiv = equiv(retainedDop, retainedUsd); }
      ws.addRow(reRow);
      const teRow: any = { code: "", name: `Total ${t("bs.equity")}`, dop: totalEquityDop };
      if (hasUsd) { teRow.usd = totalEquityUsd; teRow.equiv = equiv(totalEquityDop, totalEquityUsd); }
      ws.addRow(teRow).font = { bold: true };
      ws.addRow({});
      const leRow: any = { code: "", name: t("bs.liabilitiesAndEquity"), dop: totalLEDop };
      if (hasUsd) { leRow.usd = totalLEUsd; leRow.equiv = equiv(totalLEDop, totalLEUsd); }
      ws.addRow(leRow).font = { bold: true, size: 14 };

      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${language === "en" ? "balance_sheet" : "balance_general"}_${asOfDate}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(t("acctReport.excelSuccess"));
    } catch (e) { console.error(e); toast.error(t("acctReport.excelError")); }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: hasUsd ? "landscape" : "portrait" });
    doc.setFontSize(16); doc.text(t("bs.title"), 14, 20);
    doc.setFontSize(10); doc.text(`${t("bs.asOf")}: ${asOfDate}`, 14, 28);
    let y = 34;
    if (costCenter !== "all") { doc.text(`${t("acctReport.costCenter")}: ${ccLabels[costCenter]}`, 14, y); y += 6; }
    if (hasUsd) { doc.text(`${t("pl.exchangeRate")}: ${exchangeRate}`, 14, y); y += 6; }

    const headers = [t("acctReport.col.account"), t("acctReport.col.description"), "DOP"];
    if (hasUsd) headers.push("USD", t("pl.dopEquiv"));

    const rows: string[][] = [];
    const fmtRow = (label: string, dop: number, usd: number) => {
      const r = ["", label, formatCurrency(dop, "DOP")];
      if (hasUsd) r.push(formatCurrency(usd, "USD"), formatCurrency(equiv(dop, usd), "DOP"));
      return r;
    };
    const addSection = (title: string, items: GroupedAccount[], tDop: number, tUsd: number) => {
      rows.push([title, "", "", ...(hasUsd ? ["", ""] : [])]);
      items.forEach(g => {
        const add = (a: GroupedAccount, indent = false) => {
          const r = [indent ? `  ${a.code}` : a.code, indent ? `  ${a.name}` : a.name, formatCurrency(a.dop, "DOP")];
          if (hasUsd) r.push(a.usd ? formatCurrency(a.usd, "USD") : "—", formatCurrency(equiv(a.dop, a.usd), "DOP"));
          rows.push(r);
        };
        if (g.isParent && g.children) { add(g); g.children.forEach(c => add(c, true)); } else add(g);
      });
      rows.push(fmtRow(`Total ${title}`, tDop, tUsd));
      rows.push(Array(headers.length).fill(""));
    };

    addSection(t("bs.assets"), assetRows, totalAssetsDop, totalAssetsUsd);
    addSection(t("bs.liabilities"), liabilityRows, totalLiabDop, totalLiabUsd);
    rows.push([t("bs.equity"), "", "", ...(hasUsd ? ["", ""] : [])]);
    equityRows.forEach(r => {
      const row = [r.code, r.name, formatCurrency(r.dop, "DOP")];
      if (hasUsd) row.push(formatCurrency(r.usd, "USD"), formatCurrency(equiv(r.dop, r.usd), "DOP"));
      rows.push(row);
    });
    rows.push(fmtRow(t("bs.retainedEarnings"), retainedDop, retainedUsd));
    rows.push(fmtRow(`Total ${t("bs.equity")}`, totalEquityDop, totalEquityUsd));
    rows.push(Array(headers.length).fill(""));
    rows.push(fmtRow(t("bs.liabilitiesAndEquity"), totalLEDop, totalLEUsd));

    autoTable(doc, { head: [headers], body: rows, startY: y, styles: { fontSize: 8 }, headStyles: { fillColor: [30, 58, 138] } });
    doc.save(`${language === "en" ? "balance_sheet" : "balance_general"}_${asOfDate}.pdf`);
    toast.success(t("acctReport.pdfSuccess"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>{t("bs.asOf")}</Label>
          <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="w-40" />
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

        {!isLoading && (
          <Badge variant={isBalanced ? "default" : "destructive"} className="ml-auto flex items-center gap-1">
            {isBalanced ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {isBalanced ? t("bs.balanced") : t("bs.unbalanced")}
          </Badge>
        )}
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
                <TableHead className="text-right w-36">DOP</TableHead>
                {hasUsd && <TableHead className="text-right w-36">USD</TableHead>}
                {hasUsd && <TableHead className="text-right w-36">{t("pl.dopEquiv")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* ASSETS */}
              <TableRow className="bg-primary/5">
                <TableCell colSpan={colCount} className="font-bold text-base">{t("bs.assets")}</TableCell>
              </TableRow>
              {renderRows(assetRows)}
              <TotalRow label={t("bs.totalAssets")} dop={totalAssetsDop} usd={totalAssetsUsd} className="border-t-2 border-primary/20" />

              {/* LIABILITIES */}
              <TableRow className="bg-destructive/5">
                <TableCell colSpan={colCount} className="font-bold text-base">{t("bs.liabilities")}</TableCell>
              </TableRow>
              {renderRows(liabilityRows)}
              <TotalRow label={t("bs.totalLiabilities")} dop={totalLiabDop} usd={totalLiabUsd} className="border-t-2 border-destructive/20" />

              {/* EQUITY */}
              <TableRow className="bg-accent/50">
                <TableCell colSpan={colCount} className="font-bold text-base">{t("bs.equity")}</TableCell>
              </TableRow>
              {renderRows(equityRows)}
              <TableRow>
                <TableCell />
                <TableCell className="italic">{t("bs.retainedEarnings")}</TableCell>
                <TableCell className={`text-right italic ${retainedDop >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrency(retainedDop, "DOP")}
                </TableCell>
                {hasUsd && (
                  <TableCell className={`text-right italic ${retainedUsd >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrency(retainedUsd, "USD")}
                  </TableCell>
                )}
                {hasUsd && (
                  <TableCell className="text-right italic">
                    {formatCurrency(equiv(retainedDop, retainedUsd), "DOP")}
                  </TableCell>
                )}
              </TableRow>
              <TotalRow label={t("bs.totalEquity")} dop={totalEquityDop} usd={totalEquityUsd} className="border-t-2 border-accent-foreground/20" />

              {/* TOTAL L+E */}
              <TableRow className="bg-muted border-t-4">
                <TableCell />
                <TableCell className="font-bold text-lg">{t("bs.liabilitiesAndEquity")}</TableCell>
                <TableCell className="text-right font-bold text-lg">{formatCurrency(totalLEDop, "DOP")}</TableCell>
                {hasUsd && <TableCell className="text-right font-bold text-lg">{formatCurrency(totalLEUsd, "USD")}</TableCell>}
                {hasUsd && <TableCell className="text-right font-bold text-lg">{formatCurrency(equiv(totalLEDop, totalLEUsd), "DOP")}</TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
