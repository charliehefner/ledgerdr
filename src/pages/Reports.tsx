import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchRecentTransactions, fetchAccounts, Transaction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { getAllAttachmentUrls, AttachmentCategory } from "@/lib/attachments";
import { EditTransactionDialog } from "@/components/invoices/EditTransactionDialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, FileSpreadsheet, FileText, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from "lucide-react";
import { MultiAttachmentCell } from "@/components/transactions/MultiAttachmentCell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColumnSelector } from "@/components/ui/column-selector";
import { getDescription } from "@/lib/getDescription";
import { REPORT_COLUMNS } from "@/components/transactions/columnConfig";

type SortKey = "id" | "transaction_date" | "master_acct_code" | "project_code" | "cbs_code" | "description" | "currency" | "amount" | "itbis" | "pay_method" | "document" | "name" | "exchange_rate" | "is_internal";
type SortDirection = "asc" | "desc" | null;

export default function Reports() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState("10000");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [payMethodFilter, setPayMethodFilter] = useState<string>("all");
  const [purchaseTotalsPeriod, setPurchaseTotalsPeriod] = useState("current_month"); // kept for accountCbsTotals reference
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const columnVisibility = useColumnVisibility("reports-table", REPORT_COLUMNS);

  const handleAttachmentUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['reportTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['reportAttachments'] });
  };

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['reportTransactions', limit],
    queryFn: () => fetchRecentTransactions(parseInt(limit)),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, account_name, account_type, currency')
        .order('account_name');
      if (error) throw error;
      return data;
    },
  });

  const LEGACY_PAY_METHOD_LABELS: Record<string, string> = {
    transfer_bdi: 'Transfer BDI',
    transfer_bhd: 'Transfer BHD',
    cash: 'Efectivo',
    petty_cash: 'Caja Chica',
    cc_management: 'CC Management',
    cc_agri: 'CC Agrícola',
    cc_industry: 'CC Industrial',
    credit: 'Crédito',
  };

  const getPayMethodLabel = (payMethod: string | null): string => {
    if (!payMethod) return '-';
    if (LEGACY_PAY_METHOD_LABELS[payMethod]) return LEGACY_PAY_METHOD_LABELS[payMethod];
    const bankAcct = bankAccounts.find(b => b.id === payMethod);
    if (bankAcct) return `${bankAcct.account_name} (${bankAcct.currency})`;
    return payMethod;
  };

  // Exclude voided transactions from reports
  const nonVoidedTransactions = allTransactions.filter((tx) => !tx.is_void);

  // Get unique accounts for filter dropdown
  const usedAccounts = [...new Set(nonVoidedTransactions.map((t) => t.master_acct_code).filter(Boolean))];

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    return account ? getDescription(account) : code;
  };

  // Filter by date range, search, account, and currency
  const transactions = useMemo(() => {
    let filtered = nonVoidedTransactions;
    
    // Date range filters
    if (startDate) {
      filtered = filtered.filter(tx => {
        const txDate = parseDateLocal(tx.transaction_date);
        return txDate >= startDate;
      });
    }
    
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(tx => {
        const txDate = parseDateLocal(tx.transaction_date);
        return txDate <= endOfDay;
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tx =>
        String(tx.legacy_id || '').includes(term) ||
        tx.description?.toLowerCase().includes(term) ||
        tx.name?.toLowerCase().includes(term) ||
        tx.master_acct_code?.toLowerCase().includes(term) ||
        tx.document?.toLowerCase().includes(term)
      );
    }

    // Account filter
    if (accountFilter !== "all") {
      filtered = filtered.filter(tx => tx.master_acct_code === accountFilter);
    }

    // Currency filter
    if (currencyFilter !== "all") {
      filtered = filtered.filter(tx => tx.currency === currencyFilter);
    }

    // Pay method filter
    if (payMethodFilter !== "all") {
      filtered = filtered.filter(tx => tx.pay_method === payMethodFilter);
    }
    
    return filtered;
  }, [nonVoidedTransactions, startDate, endDate, searchTerm, accountFilter, currencyFilter, payMethodFilter]);

  // Get transaction IDs to fetch attachments
  const transactionIds = transactions.map(tx => tx.id).filter(Boolean) as string[];

  // Fetch all attachments with categories from local database
  const { data: allAttachments = {} } = useQuery({
    queryKey: ['reportAttachments', transactionIds],
    queryFn: () => getAllAttachmentUrls(transactionIds),
    enabled: transactionIds.length > 0,
  });

  const getAttachmentsForTransaction = (txId: string): Record<AttachmentCategory, string | null> => {
    return allAttachments[txId] || { ncf: null, payment_receipt: null, quote: null };
  };

  // Check if transaction has any attachment (for row highlighting)
  const hasAnyAttachment = (txId: string): boolean => {
    const attachs = allAttachments[txId];
    return !!(attachs?.ncf || attachs?.payment_receipt || attachs?.quote);
  };

  // Sorted transactions
  const sortedTransactions = useMemo(() => {
    if (!sortKey || !sortDirection) return transactions;
    
    return [...transactions].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      
      // Handle nulls
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      
      // Handle numbers
      if (sortKey === "amount" || sortKey === "itbis" || sortKey === "exchange_rate") {
        aVal = parseFloat(String(aVal)) || 0;
        bVal = parseFloat(String(bVal)) || 0;
      }
      
      // Handle booleans
      if (sortKey === "is_internal") {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      }
      
      // Handle dates
      if (sortKey === "transaction_date") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    if (sortDirection === "asc") return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Calculate totals by currency for PDF export
  const totalsByCurrency = transactions.reduce((acc, tx) => {
    const amount = parseFloat(String(tx.amount)) || 0;
    acc[tx.currency] = (acc[tx.currency] || 0) + amount;
    return acc;
  }, {} as Record<string, number>);

  // Account/CBS pair totals
  const accountCbsPairs = [
    { label: "Agrochemicals", accounts: ["4030"], cbs: "13" },
    { label: "Diesel", accounts: ["4040"], cbs: "14" },
    { label: "Fertilizer", accounts: ["4080", "4082"], cbs: "12" },
    { label: "Oil and Grease", accounts: ["4050", "4060"], cbs: "15" },
  ];

  const purchaseTotalsDates = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    switch (purchaseTotalsPeriod) {
      case "past_month": {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        return { start, end };
      }
      case "ytd":
        return { start: new Date(year, 0, 1), end: now };
      case "prior_year":
        return { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31, 23, 59, 59, 999) };
      case "current_month":
      default:
        return { start: new Date(year, month, 1), end: now };
    }
  }, [purchaseTotalsPeriod]);

  const accountCbsTotals = accountCbsPairs.map(pair => {
    const matchingTx = nonVoidedTransactions.filter(tx => {
      const txDate = parseDateLocal(tx.transaction_date);
      if (txDate < purchaseTotalsDates.start || txDate > purchaseTotalsDates.end) return false;
      return (tx.master_acct_code && pair.accounts.includes(tx.master_acct_code)) ||
        (tx.cbs_code?.startsWith(pair.cbs));
    });
    const totalDOP = matchingTx
      .filter(tx => tx.currency === "DOP")
      .reduce((sum, tx) => sum + (parseFloat(String(tx.amount)) || 0), 0);
    const totalUSD = matchingTx
      .filter(tx => tx.currency === "USD")
      .reduce((sum, tx) => sum + (parseFloat(String(tx.amount)) || 0), 0);
    return {
      label: pair.label,
      count: matchingTx.length,
      totalDOP,
      totalUSD,
    };
  });

  const formatExcelDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Column export config: maps column keys to header labels, widths, and data extractors
  const columnExportMap: Record<string, { header: string; width: number; getValue: (tx: Transaction) => string | number }> = {
    id: { header: "ID", width: 12, getValue: (tx) => tx.legacy_id || "-" },
    date: { header: "Date", width: 15, getValue: (tx) => formatExcelDate(tx.transaction_date) },
    account: { header: "Account", width: 15, getValue: (tx) => tx.master_acct_code || "-" },
    project: { header: "Project", width: 15, getValue: (tx) => tx.project_code || "-" },
    cbsCode: { header: "CBS Code", width: 15, getValue: (tx) => tx.cbs_code || "-" },
    description: { header: "Description", width: 30, getValue: (tx) => tx.description || "-" },
    currency: { header: "Currency", width: 10, getValue: (tx) => tx.currency },
    amount: { header: "Amount", width: 15, getValue: (tx) => tx.amount },
    itbis: { header: "ITBIS", width: 12, getValue: (tx) => tx.itbis || "" },
    payMethod: { header: "Pay Method", width: 18, getValue: (tx) => getPayMethodLabel(tx.pay_method) },
    document: { header: "Document", width: 15, getValue: (tx) => tx.document || "-" },
    name: { header: "Name", width: 20, getValue: (tx) => tx.name || "-" },
    exchangeRate: { header: "Exchange Rate", width: 15, getValue: (tx) => tx.exchange_rate || "-" },
  };

  // Get exportable visible columns (exclude "attach" which can't be exported)
  const getExportColumns = () => {
    return columnVisibility.visibleColumns
      .filter(col => col.key !== "attach" && col.key !== "purchaseDate")
      .map(col => ({ key: col.key, ...columnExportMap[col.key] }))
      .filter(col => col.header); // only those with a mapping
  };

  const exportToExcel = async () => {
    if (sortedTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    try {
      const exportCols = getExportColumns();
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Transactions");

      // Define columns matching visible column order
      worksheet.columns = exportCols.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width,
      }));

      // Add data rows
      sortedTransactions.forEach(tx => {
        const row: Record<string, string | number> = {};
        exportCols.forEach(col => {
          row[col.key] = col.getValue(tx);
        });
        worksheet.addRow(row);
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Generate file and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateSuffix = [
        startDate ? format(startDate, "yyyy-MM-dd") : null,
        endDate ? format(endDate, "yyyy-MM-dd") : null,
      ].filter(Boolean).join("_to_");
      link.download = `transactions_report_${dateSuffix || format(new Date(), "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success("Excel report exported successfully");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel report");
    }
  };

  const exportToPDF = () => {
    if (sortedTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const exportCols = getExportColumns();
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(18);
    doc.text("Transaction Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    let yPos = 36;
    // Show active filters
    const filterParts: string[] = [];
    if (startDate) filterParts.push(`From: ${format(startDate, "dd/MM/yyyy")}`);
    if (endDate) filterParts.push(`To: ${format(endDate, "dd/MM/yyyy")}`);
    if (accountFilter !== "all") filterParts.push(`Account: ${accountFilter}`);
    if (currencyFilter !== "all") filterParts.push(`Currency: ${currencyFilter}`);
    if (payMethodFilter !== "all") filterParts.push(`Pay Method: ${payMethodFilter}`);
    if (filterParts.length > 0) {
      doc.text(`Filters: ${filterParts.join(" | ")}`, 14, yPos);
      yPos += 6;
    }
    
    doc.text(`Total Transactions: ${sortedTransactions.length}`, 14, yPos);
    yPos += 6;

    // Summary by currency
    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      doc.text(`Total ${currency}: ${formatCurrency(total, currency)}`, 14, yPos);
      yPos += 6;
    });

    // Table using visible columns in order
    const headers = exportCols.map(col => col.header);
    const tableData = sortedTransactions.map(tx =>
      exportCols.map(col => String(col.getValue(tx)))
    );

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: yPos + 4,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    const dateSuffix = [
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
    ].filter(Boolean).join("_to_");
    doc.save(`transactions_report_${dateSuffix || format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF report exported successfully");
  };

  const visibleCount = columnVisibility.visibleColumns.length;

  return (
    <MainLayout
      title="Reports"
      subtitle="Transaction analytics and exports"
      actions={
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover">
              <DropdownMenuItem onClick={exportToExcel} className="text-excel">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-6 animate-fade-in">

        {/* Filters Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descripción, nombre, cuenta o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Account Filter */}
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Cuenta" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  <SelectItem value="all">Todas las Cuentas</SelectItem>
                  {usedAccounts.map((code) => (
                    <SelectItem key={code} value={code!}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Currency Filter */}
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="DOP">DOP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>

              {/* Pay Method Filter */}
              <Select value={payMethodFilter} onValueChange={setPayMethodFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Método Pago" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todos los Métodos</SelectItem>
                  <SelectItem value="transfer_bdi">Transfer BDI</SelectItem>
                  <SelectItem value="transfer_bhd">Transfer BHD</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="cc_management">CC Management</SelectItem>
                  <SelectItem value="cc_agricultural">CC Agrícola</SelectItem>
                  <SelectItem value="cc_industrial">CC Industrial</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Desde"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Hasta"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                  Limpiar Fechas
                </Button>
              )}

              {/* Limit & Count */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Límite:</span>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1,000</SelectItem>
                    <SelectItem value="10000">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {sortedTransactions.length} transacciones
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Transaction Details</CardTitle>
            <ColumnSelector
              columns={columnVisibility.allColumns}
              visibility={columnVisibility.visibility}
              onToggle={columnVisibility.toggleColumn}
              onReset={columnVisibility.resetToDefaults}
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    {columnVisibility.isVisible("id") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("id")}>
                        <div className="flex items-center">ID<SortIcon columnKey="id" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("date") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("transaction_date")}>
                        <div className="flex items-center">Date<SortIcon columnKey="transaction_date" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("account") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("master_acct_code")}>
                        <div className="flex items-center">Account<SortIcon columnKey="master_acct_code" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("project") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project_code")}>
                        <div className="flex items-center">Project<SortIcon columnKey="project_code" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("cbsCode") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("cbs_code")}>
                        <div className="flex items-center">CBS Code<SortIcon columnKey="cbs_code" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("description") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("description")}>
                        <div className="flex items-center">Description<SortIcon columnKey="description" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("currency") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("currency")}>
                        <div className="flex items-center">Currency<SortIcon columnKey="currency" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("amount") && (
                      <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                        <div className="flex items-center justify-end">Amount<SortIcon columnKey="amount" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("itbis") && (
                      <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("itbis")}>
                        <div className="flex items-center justify-end">ITBIS<SortIcon columnKey="itbis" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("payMethod") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("pay_method")}>
                        <div className="flex items-center">Pay Method<SortIcon columnKey="pay_method" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("document") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("document")}>
                        <div className="flex items-center">Document<SortIcon columnKey="document" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("name") && (
                      <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
                        <div className="flex items-center">Name<SortIcon columnKey="name" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("exchangeRate") && (
                      <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("exchange_rate")}>
                        <div className="flex items-center justify-end">Ex. Rate<SortIcon columnKey="exchange_rate" /></div>
                      </TableHead>
                    )}
                    {columnVisibility.isVisible("attach") && (
                      <TableHead className="text-center">Attach</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">
                        Loading transactions...
                      </TableCell>
                    </TableRow>
                  ) : sortedTransactions.length > 0 ? (
                    sortedTransactions.map((tx, index) => {
                      // Internal transactions (0000) and Nomina (7010) are exempt from documentation requirements
                      const isExempt = tx.is_internal || tx.master_acct_code === '0000' || tx.master_acct_code === '7010' || tx.master_acct_code === '7690';
                      const missingDocument = !isExempt && (!tx.document || tx.document.trim() === '');
                      const missingAttachment = !isExempt && tx.id && !hasAnyAttachment(String(tx.id));
                      
                      // Amber for missing NCF, Rose for missing attachment (amber takes priority if both)
                      const rowClass = missingDocument 
                        ? "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                        : missingAttachment 
                          ? "bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                          : "";

                      return (
                        <TableRow key={tx.id || index} className={cn(rowClass, "cursor-pointer")} onClick={() => { setSelectedTransaction(tx); setEditDialogOpen(true); }}>
                          {columnVisibility.isVisible("id") && (
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {tx.legacy_id || "-"}
                            </TableCell>
                          )}
                          {columnVisibility.isVisible("date") && (
                            <TableCell className="font-mono text-sm whitespace-nowrap">
                              {formatDate(tx.transaction_date)}
                            </TableCell>
                          )}
                          {columnVisibility.isVisible("account") && (
                            <TableCell className="font-mono">{tx.master_acct_code || "-"}</TableCell>
                          )}
                          {columnVisibility.isVisible("project") && (
                            <TableCell className="font-mono">{tx.project_code || "-"}</TableCell>
                          )}
                          {columnVisibility.isVisible("cbsCode") && (
                            <TableCell className="font-mono">{tx.cbs_code || "-"}</TableCell>
                          )}
                          {columnVisibility.isVisible("description") && (
                            <TableCell className="max-w-[180px] truncate">
                              {tx.description || "-"}
                            </TableCell>
                          )}
                          {columnVisibility.isVisible("currency") && <TableCell>{tx.currency}</TableCell>}
                          {columnVisibility.isVisible("amount") && (
                            <TableCell className="text-right font-mono font-medium">
                              {formatCurrency(tx.amount, tx.currency)}
                            </TableCell>
                          )}
                          {columnVisibility.isVisible("itbis") && (
                            <TableCell className="text-right font-mono">
                              {tx.itbis ? formatCurrency(tx.itbis, tx.currency) : "-"}
                            </TableCell>
                          )}
                          {columnVisibility.isVisible("payMethod") && <TableCell>{tx.pay_method || "-"}</TableCell>}
                          {columnVisibility.isVisible("document") && (
                            <TableCell className="truncate max-w-[100px]">{tx.document || "-"}</TableCell>
                          )}
                          {columnVisibility.isVisible("name") && (
                            <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>
                          )}
                          {columnVisibility.isVisible("exchangeRate") && (
                            <TableCell className="text-right font-mono">
                              {tx.exchange_rate || "-"}
                            </TableCell>
                          )}
                          {columnVisibility.isVisible("attach") && (
                            <TableCell className="text-center">
                              {tx.id ? (
                                <MultiAttachmentCell
                                  transactionId={tx.id}
                                  attachments={getAttachmentsForTransaction(String(tx.id))}
                                  onUpdate={handleAttachmentUpdate}
                                />
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditTransactionDialog
        transaction={selectedTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </MainLayout>
  );
}
