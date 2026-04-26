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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FileBarChart, Download, FileSpreadsheet, FileText, Filter, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, TrendingUp, ClipboardList, Scale, Banknote, Clock, Receipt, ArrowRight } from "lucide-react";
import { ProfitLossView } from "./ProfitLossView";
import { BalanceSheetView } from "./BalanceSheetView";
import { PowerBIExportButton } from "./PowerBIExportButton";
import { TrialBalanceView } from "./TrialBalanceView";
import { AgingReportView } from "./AgingReportView";
import { CashFlowView } from "./CashFlowView";
import { toast } from "sonner";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Filters = {
  startDate: string;
  endDate: string;
  costCenter: string;
  accountCode: string;
  projectCode: string;
  cbsCode: string;
  supplierName: string;
  payMethod: string;
};

const emptyFilters: Filters = {
  startDate: "",
  endDate: "",
  costCenter: "all",
  accountCode: "all",
  projectCode: "all",
  cbsCode: "all",
  supplierName: "",
  payMethod: "all",
};

type SortKey = "legacy_id" | "transaction_date" | "master_acct_code" | "project_code" | "cbs_code" | "cost_center" | "name" | "description" | "currency" | "amount" | "itbis" | "pay_method";

const usePayMethodLabels = (t: (key: string) => string): Record<string, string> => ({
  transfer_bdi: "Transfer BDI",
  transfer_bhd: "Transfer BHD",
  cash: t("payMethod.cash"),
  cc_management: "CC Management",
  cc_agricultural: t("payMethod.ccAgricultural"),
  cc_industrial: t("payMethod.ccIndustrial"),
});

type SortDir = "asc" | "desc" | null;

const COST_CENTER_LABELS: Record<string, Record<string, string>> = {
  es: { general: "General", agricultural: "Agrícola", industrial: "Industrial" },
  en: { general: "General", agricultural: "Agricultural", industrial: "Industrial" },
};

type ReportType = "detail" | "pl" | "bs" | "tb" | "aging" | "cf" | null;

export function AccountingReportsView() {
  const { t, language } = useLanguage();
  const PAY_METHOD_LABELS = usePayMethodLabels(t);
  const [reportType, setReportType] = useState<ReportType>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeFilters, setActiveFilters] = useState<Filters | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const ccLabels = COST_CENTER_LABELS[language] || COST_CENTER_LABELS.es;

  // Fetch dropdown options
  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-report-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("account_code, account_name")
        .is("deleted_at", null)
        .eq("allow_posting", true)
        .order("account_code");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["project-codes-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("code, spanish_description, english_description")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: cbsCodes = [] } = useQuery({
    queryKey: ["cbs-codes-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cbs_codes")
        .select("code, spanish_description, english_description")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL transactions using recursive paginated fetch to bypass 1,000-row limit
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["accounting-report", activeFilters],
    queryFn: async () => {
      if (!activeFilters) return [];

      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let offset = 0;
      let keepFetching = true;

      while (keepFetching) {
        let query = supabase
          .from("transactions")
          .select("*")
          .eq("is_void", false)
          .order("transaction_date", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (activeFilters.startDate) query = query.gte("transaction_date", activeFilters.startDate);
        if (activeFilters.endDate) query = query.lte("transaction_date", activeFilters.endDate);
        if (activeFilters.accountCode !== "all") query = query.eq("master_acct_code", activeFilters.accountCode);
        if (activeFilters.projectCode !== "all") query = query.eq("project_code", activeFilters.projectCode);
        if (activeFilters.cbsCode !== "all") query = query.eq("cbs_code", activeFilters.cbsCode);
        if (activeFilters.supplierName) query = query.ilike("name", `%${activeFilters.supplierName}%`);
        if (activeFilters.payMethod !== "all") query = query.eq("pay_method", activeFilters.payMethod);

        const { data, error } = await query;
        if (error) throw error;

        allRows = allRows.concat(data || []);
        if (!data || data.length < PAGE_SIZE) {
          keepFetching = false;
        } else {
          offset += PAGE_SIZE;
        }
      }

      return allRows;
    },
    enabled: !!activeFilters,
  });

  // Client-side cost center filter
  const transactions = useMemo(() => {
    if (!activeFilters || activeFilters.costCenter === "all") return rawData;
    return rawData.filter((tx: any) => (tx.cost_center || "general") === activeFilters.costCenter);
  }, [rawData, activeFilters]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return transactions;
    return [...transactions].sort((a: any, b: any) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (sortKey === "amount" || sortKey === "itbis") {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }
      if (sortKey === "cost_center") {
        av = av || "general";
        bv = bv || "general";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir(null); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    if (sortDir === "asc") return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Totals
  const totalsByCurrency = useMemo(() => {
    return sorted.reduce((acc: Record<string, number>, tx: any) => {
      acc[tx.currency] = (acc[tx.currency] || 0) + (parseFloat(tx.amount) || 0);
      return acc;
    }, {});
  }, [sorted]);

  const applyFilters = () => {
    setActiveFilters({ ...filters });
    setFiltersOpen(false);
  };

  const formatExcelDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()}`;
  };

  const activeFilterLabels = useMemo(() => {
    if (!activeFilters) return [];
    const parts: string[] = [];
    if (activeFilters.startDate) parts.push(`${t("acctReport.from")}: ${formatExcelDate(activeFilters.startDate)}`);
    if (activeFilters.endDate) parts.push(`${t("acctReport.to")}: ${formatExcelDate(activeFilters.endDate)}`);
    if (activeFilters.costCenter !== "all") parts.push(`${t("acctReport.center")}: ${ccLabels[activeFilters.costCenter] || activeFilters.costCenter}`);
    if (activeFilters.accountCode !== "all") parts.push(`${t("acctReport.account")}: ${activeFilters.accountCode}`);
    if (activeFilters.projectCode !== "all") parts.push(`${t("acctReport.project")}: ${activeFilters.projectCode}`);
    if (activeFilters.cbsCode !== "all") parts.push(`CBS: ${activeFilters.cbsCode}`);
    if (activeFilters.supplierName) parts.push(`${t("acctReport.supplier").split(" /")[0]}: ${activeFilters.supplierName}`);
    if (activeFilters.payMethod !== "all") parts.push(`${t("acctReport.col.payMethod")}: ${PAY_METHOD_LABELS[activeFilters.payMethod] || activeFilters.payMethod}`);
    return parts;
  }, [activeFilters, t, ccLabels]);

  const colHeaders: [SortKey, string][] = [
    ["legacy_id", "ID"],
    ["transaction_date", t("acctReport.col.date")],
    ["master_acct_code", t("acctReport.col.account")],
    ["project_code", t("acctReport.col.project")],
    ["cbs_code", "CBS"],
    ["cost_center", t("acctReport.col.center")],
    ["name", t("acctReport.col.name")],
    ["description", t("acctReport.col.description")],
    ["currency", t("acctReport.col.currency")],
    ["amount", t("acctReport.col.amount")],
    ["itbis", "ITBIS"],
    ["pay_method", t("acctReport.col.payMethod")],
  ];

  const exportToExcel = async () => {
    if (sorted.length === 0) { toast.error(t("acctReport.noDataExport")); return; }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t("acctReport.reportTitle"));
      ws.columns = [
        { header: "ID", key: "legacy_id", width: 8 },
        { header: t("acctReport.col.date"), key: "date", width: 14 },
        { header: t("acctReport.col.account"), key: "account", width: 14 },
        { header: t("acctReport.col.project"), key: "project", width: 12 },
        { header: "CBS", key: "cbs", width: 12 },
        { header: t("acctReport.costCenter"), key: "cc", width: 14 },
        { header: t("acctReport.col.name"), key: "name", width: 22 },
        { header: t("acctReport.col.description"), key: "desc", width: 30 },
        { header: t("acctReport.col.currency"), key: "currency", width: 10 },
        { header: t("acctReport.col.amount"), key: "amount", width: 14 },
        { header: "ITBIS", key: "itbis", width: 12 },
        { header: t("acctReport.col.payMethod"), key: "pay_method", width: 16 },
      ];
      sorted.forEach((tx: any) => {
        ws.addRow({
          legacy_id: tx.legacy_id || "-",
          date: formatExcelDate(tx.transaction_date),
          account: tx.master_acct_code || "-",
          project: tx.project_code || "-",
          cbs: tx.cbs_code || "-",
          cc: ccLabels[tx.cost_center || "general"] || "General",
          name: tx.name || "-",
          desc: tx.description || "-",
          currency: tx.currency,
          amount: parseFloat(tx.amount) || 0,
          itbis: tx.itbis ? parseFloat(tx.itbis) : "",
          pay_method: PAY_METHOD_LABELS[tx.pay_method] || tx.pay_method || "-",
        });
      });
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ds = [activeFilters?.startDate, activeFilters?.endDate].filter(Boolean).join("_to_");
      a.download = `${language === "en" ? "accounting_report" : "informe_contable"}_${ds || format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("acctReport.excelSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("acctReport.excelError"));
    }
  };

  const exportToPDF = () => {
    if (sorted.length === 0) { toast.error(t("acctReport.noDataExport")); return; }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.text(t("acctReport.reportTitle"), 14, 22);
    doc.setFontSize(10);
    doc.text(`${t("acctReport.generated")}: ${new Date().toLocaleDateString()}`, 14, 30);
    let y = 36;
    if (activeFilterLabels.length) {
      doc.text(`${t("acctReport.filters")}: ${activeFilterLabels.join(" | ")}`, 14, y);
      y += 6;
    }
    doc.text(`${t("acctReport.totalTransactions")}: ${sorted.length}`, 14, y);
    y += 6;
    Object.entries(totalsByCurrency).forEach(([cur, total]) => {
      doc.text(`${t("common.total")} ${cur}: ${formatCurrency(total as number, cur)}`, 14, y);
      y += 6;
    });

    const headers = colHeaders.map(([, label]) => label);
    const body = sorted.map((tx: any) => [
      tx.legacy_id || "-",
      formatExcelDate(tx.transaction_date),
      tx.master_acct_code || "-",
      tx.project_code || "-",
      tx.cbs_code || "-",
      ccLabels[tx.cost_center || "general"] || "General",
      tx.name || "-",
      tx.description || "-",
      tx.currency,
      formatCurrency(parseFloat(tx.amount) || 0, tx.currency),
      tx.itbis ? formatCurrency(parseFloat(tx.itbis), tx.currency) : "-",
      PAY_METHOD_LABELS[tx.pay_method] || tx.pay_method || "-",
    ]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: y + 4,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    const ds = [activeFilters?.startDate, activeFilters?.endDate].filter(Boolean).join("_to_");
    doc.save(`${language === "en" ? "accounting_report" : "informe_contable"}_${ds || format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success(t("acctReport.pdfSuccess"));
  };

  const getDesc = (item: { spanish_description: string; english_description: string }) =>
    language === "en" ? item.english_description : item.spanish_description;

  const reportCards = [
    { key: "pl" as const, icon: TrendingUp, title: t("pl.title"), desc: t("acctReport.plDesc") },
    { key: "bs" as const, icon: ClipboardList, title: t("bs.title"), desc: t("acctReport.bsDesc") },
    { key: "tb" as const, icon: Scale, title: t("accounting.tb.title"), desc: t("acctReport.tbDesc") },
    { key: "cf" as const, icon: Banknote, title: t("cf.title"), desc: t("acctReport.cfDesc") },
    { key: "aging" as const, icon: Clock, title: t("aging.title"), desc: t("acctReport.agingDesc") },
    { key: "detail" as const, icon: Receipt, title: t("acctReport.transactionReports"), desc: t("acctReport.transactionReportsDesc") },
  ];

  const BackButton = () => (
    <Button variant="ghost" size="sm" onClick={() => { setReportType(null); setActiveFilters(null); }} className="mb-2">
      <ArrowLeft className="h-4 w-4 mr-1" />
      {t("acctReport.backToReports")}
    </Button>
  );

  return (
    <div className="space-y-4">
      {reportType === null ? (
        /* ===== Card Grid Landing ===== */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t("acctReport.title")}</h2>
            <PowerBIExportButton />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportCards.map((card) => (
              <button
                key={card.key}
                onClick={() => setReportType(card.key)}
                className="group relative text-left rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-primary/0 transition-colors group-hover:bg-primary" />
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">{card.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : reportType === "pl" ? (
        <><BackButton /><ProfitLossView /></>
      ) : reportType === "bs" ? (
        <><BackButton /><BalanceSheetView /></>
      ) : reportType === "tb" ? (
        <><BackButton /><TrialBalanceView /></>
      ) : reportType === "aging" ? (
        <><BackButton /><AgingReportView /></>
      ) : reportType === "cf" ? (
        <><BackButton /><CashFlowView /></>
      ) : (
      <>
      <BackButton />
      {!activeFilters ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-gradient-to-br from-muted/40 to-transparent p-2">
          <EmptyState
            icon={FileBarChart}
            title={t("acctReport.transactionReports")}
            description={t("acctReport.description")}
            className="[&_svg]:text-primary [&_.rounded-full]:bg-primary/10"
            action={
              <Button onClick={() => { setFilters(emptyFilters); setFiltersOpen(true); }}>
                <Filter className="h-4 w-4 mr-1" />
                {t("acctReport.generateReport")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setFilters(activeFilters); setFiltersOpen(true); }}>
                <Filter className="h-4 w-4 mr-1" />
                {t("acctReport.modifyFilters")}
              </Button>
              {activeFilterLabels.map((l, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{l}</Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {sorted.length} {t("acctReport.transactions")}
                {Object.entries(totalsByCurrency).map(([c, t]) => ` | ${c}: ${formatCurrency(t as number, c)}`).join("")}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    {t("acctReport.export")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Results Table */}
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("acctReport.loading")}</div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t("acctReport.noResults")}</div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {colHeaders.map(([key, label]) => (
                      <TableHead key={key} className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(key)}>
                        <span className="inline-flex items-center">{label}<SortIcon col={key} /></span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tx.legacy_id || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell>{tx.master_acct_code || "-"}</TableCell>
                      <TableCell>{tx.project_code || "-"}</TableCell>
                      <TableCell>{tx.cbs_code || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          (tx.cost_center || "general") === "agricultural" ? "bg-green-100 text-green-800 border-green-200" :
                          (tx.cost_center || "general") === "industrial" ? "bg-blue-100 text-blue-800 border-blue-200" :
                          "bg-muted text-muted-foreground"
                        }>
                          {ccLabels[tx.cost_center || "general"] || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate max-w-[150px]">{tx.name || "-"}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{tx.description || "-"}</TableCell>
                      <TableCell>{tx.currency}</TableCell>
                      <TableCell className="text-right">{formatCurrency(parseFloat(tx.amount) || 0, tx.currency)}</TableCell>
                      <TableCell className="text-right">{tx.itbis ? formatCurrency(parseFloat(tx.itbis), tx.currency) : "-"}</TableCell>
                      <TableCell>{PAY_METHOD_LABELS[tx.pay_method] || tx.pay_method || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Filter Dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("acctReport.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("acctReport.startDate")}</Label>
                <Input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("acctReport.endDate")}</Label>
                <Input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {/* 4-col grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>{t("acctReport.costCenter")}</Label>
                <Select value={filters.costCenter} onValueChange={v => setFilters(f => ({ ...f, costCenter: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="agricultural">{ccLabels.agricultural}</SelectItem>
                    <SelectItem value="industrial">{ccLabels.industrial}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("acctReport.account")}</Label>
                <Select value={filters.accountCode} onValueChange={v => setFilters(f => ({ ...f, accountCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.account_code} value={a.account_code}>
                        {a.account_code} – {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("acctReport.project")}</Label>
                <Select value={filters.projectCode} onValueChange={v => setFilters(f => ({ ...f, projectCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} – {getDesc(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CBS</Label>
                <Select value={filters.cbsCode} onValueChange={v => setFilters(f => ({ ...f, cbsCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {cbsCodes.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} – {getDesc(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pay Method */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>{t("acctReport.payMethod")}</Label>
                <Select value={filters.payMethod} onValueChange={v => setFilters(f => ({ ...f, payMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {Object.entries(PAY_METHOD_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supplier */}
            <div className="space-y-1">
              <Label>{t("acctReport.supplier")}</Label>
              <Input
                value={filters.supplierName}
                onChange={e => setFilters(f => ({ ...f, supplierName: e.target.value }))}
                placeholder={t("acctReport.supplierPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFiltersOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={applyFilters}>
              <FileBarChart className="h-4 w-4 mr-1" />
              {t("acctReport.viewReport")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
