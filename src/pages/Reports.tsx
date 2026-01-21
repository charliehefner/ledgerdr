import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
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
import { fetchRecentTransactions, Transaction } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, FileSpreadsheet, FileText, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { AttachmentCell } from "@/components/transactions/AttachmentCell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const COLORS = [
  "hsl(220, 65%, 30%)",
  "hsl(38, 95%, 50%)",
  "hsl(142, 70%, 40%)",
  "hsl(200, 95%, 45%)",
  "hsl(280, 60%, 50%)",
  "hsl(15, 85%, 55%)",
];

type SortKey = "transaction_date" | "master_acct_code" | "project_code" | "cbs_code" | "description" | "currency" | "amount" | "itbis" | "pay_method" | "document" | "name" | "exchange_rate" | "is_internal";
type SortDirection = "asc" | "desc" | null;

export default function Reports() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState("150");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleAttachmentUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['reportTransactions'] });
  };

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['reportTransactions', limit],
    queryFn: () => fetchRecentTransactions(parseInt(limit)),
  });

  // Exclude voided transactions from reports
  const nonVoidedTransactions = allTransactions.filter((tx) => !tx.is_void);

  // Filter by date range
  const transactions = useMemo(() => {
    let filtered = nonVoidedTransactions;
    
    if (startDate) {
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        return txDate >= startDate;
      });
    }
    
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        return txDate <= endOfDay;
      });
    }
    
    return filtered;
  }, [nonVoidedTransactions, startDate, endDate]);

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

  // Calculate totals by currency (parse amount as it comes as string from API)
  const totalsByCurrency = transactions.reduce((acc, tx) => {
    const amount = parseFloat(String(tx.amount)) || 0;
    acc[tx.currency] = (acc[tx.currency] || 0) + amount;
    return acc;
  }, {} as Record<string, number>);

  // Calculate totals by account (skip null accounts)
  const totalsByAccount = transactions.reduce((acc, tx) => {
    if (!tx.master_acct_code) return acc;
    const amount = parseFloat(String(tx.amount)) || 0;
    acc[tx.master_acct_code] = (acc[tx.master_acct_code] || 0) + amount;
    return acc;
  }, {} as Record<string, number>);

  const accountChartData = Object.entries(totalsByAccount)
    .map(([account, total]) => ({ account, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Calculate totals by payment method (skip null/empty methods)
  const totalsByPayMethod = transactions.reduce((acc, tx) => {
    if (!tx.pay_method) return acc;
    const amount = parseFloat(String(tx.amount)) || 0;
    acc[tx.pay_method] = (acc[tx.pay_method] || 0) + amount;
    return acc;
  }, {} as Record<string, number>);

  const payMethodChartData = Object.entries(totalsByPayMethod)
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => b.total - a.total);

  // Account/CBS pair totals
  const accountCbsPairs = [
    { label: "Agrochemicals", accounts: ["4030"], cbs: "13" },
    { label: "Diesel", accounts: ["4040"], cbs: "14" },
    { label: "Fertilizer", accounts: ["4080", "4082"], cbs: "12" },
    { label: "Oil and Grease", accounts: ["4050", "4060"], cbs: "15" },
  ];

  const accountCbsTotals = accountCbsPairs.map(pair => {
    const matchingTx = transactions.filter(tx => 
      tx.master_acct_code && 
      pair.accounts.includes(tx.master_acct_code) && 
      tx.cbs_code?.startsWith(pair.cbs)
    );
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

  const exportToExcel = () => {
    if (sortedTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const exportData = sortedTransactions.map(tx => ({
      "Date": formatExcelDate(tx.transaction_date),
      "Account": tx.master_acct_code,
      "Project": tx.project_code || "",
      "CBS Code": tx.cbs_code || "",
      "Description": tx.description,
      "Currency": tx.currency,
      "Amount": tx.amount,
      "ITBIS": tx.itbis || "",
      "Payment Method": tx.pay_method || "",
      "Document": tx.document || "",
      "Name": tx.name || "",
      "Exchange Rate": tx.exchange_rate || "",
      "Internal": tx.is_internal ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `transactions_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel report exported successfully");
  };

  const exportToPDF = () => {
    if (sortedTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(18);
    doc.text("Transaction Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Transactions: ${sortedTransactions.length}`, 14, 36);

    // Summary by currency
    let yPos = 44;
    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      doc.text(`Total ${currency}: ${formatCurrency(total, currency)}`, 14, yPos);
      yPos += 6;
    });

    // Table
    const tableData = sortedTransactions.map(tx => [
      formatExcelDate(tx.transaction_date),
      tx.master_acct_code,
      tx.description?.substring(0, 30) || "",
      tx.currency,
      tx.amount.toFixed(2),
      tx.itbis?.toFixed(2) || "-",
      tx.pay_method || "-",
    ]);

    autoTable(doc, {
      head: [["Date", "Account", "Description", "Currency", "Amount", "ITBIS", "Pay Method"]],
      body: tableData,
      startY: yPos + 4,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(`transactions_report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF report exported successfully");
  };

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
              <DropdownMenuItem onClick={exportToExcel}>
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
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-semibold font-mono mt-1">
                {transactions.length}
              </p>
            </CardContent>
          </Card>
          {Object.entries(totalsByCurrency).map(([currency, total]) => (
            <Card key={currency}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total {currency}</p>
                <p className="text-2xl font-semibold font-mono mt-1">
                  {formatCurrency(total, currency)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Account/CBS Pair Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Totals by Account & CBS</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account / CBS Pair</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Total DOP</TableHead>
                  <TableHead className="text-right">Total USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountCbsTotals.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right font-mono">{row.count}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totalDOP, "DOP")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totalUSD, "USD")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* By Account */}
          <Card>
            <CardHeader>
              <CardTitle>By Account</CardTitle>
            </CardHeader>
            <CardContent>
              {accountChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={accountChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="account"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [value.toFixed(2), "Total"]}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>By Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              {payMethodChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={payMethodChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="total"
                      nameKey="method"
                      label={({ method, percent }) => 
                        `${method} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {payMethodChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [value.toFixed(2), "Total"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Date Range Filter Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Filter by Date:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Start Date"}
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
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "End Date"}
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
                  Clear Dates
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Limit:</span>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                    <SelectItem value="350">350</SelectItem>
                    <SelectItem value="450">450</SelectItem>
                    <SelectItem value="550">550</SelectItem>
                    <SelectItem value="650">650</SelectItem>
                    <SelectItem value="750">750</SelectItem>
                    <SelectItem value="850">850</SelectItem>
                    <SelectItem value="950">950</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Showing {sortedTransactions.length} transactions
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("transaction_date")}>
                      <div className="flex items-center">Date<SortIcon columnKey="transaction_date" /></div>
                    </TableHead>
                    <TableHead className="w-20 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("master_acct_code")}>
                      <div className="flex items-center">Account<SortIcon columnKey="master_acct_code" /></div>
                    </TableHead>
                    <TableHead className="w-20 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project_code")}>
                      <div className="flex items-center">Project<SortIcon columnKey="project_code" /></div>
                    </TableHead>
                    <TableHead className="w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("cbs_code")}>
                      <div className="flex items-center">CBS Code<SortIcon columnKey="cbs_code" /></div>
                    </TableHead>
                    <TableHead className="min-w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("description")}>
                      <div className="flex items-center">Description<SortIcon columnKey="description" /></div>
                    </TableHead>
                    <TableHead className="w-20 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("currency")}>
                      <div className="flex items-center">Currency<SortIcon columnKey="currency" /></div>
                    </TableHead>
                    <TableHead className="w-28 text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                      <div className="flex items-center justify-end">Amount<SortIcon columnKey="amount" /></div>
                    </TableHead>
                    <TableHead className="w-24 text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("itbis")}>
                      <div className="flex items-center justify-end">ITBIS<SortIcon columnKey="itbis" /></div>
                    </TableHead>
                    <TableHead className="w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("pay_method")}>
                      <div className="flex items-center">Pay Method<SortIcon columnKey="pay_method" /></div>
                    </TableHead>
                    <TableHead className="w-28 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("document")}>
                      <div className="flex items-center">Document<SortIcon columnKey="document" /></div>
                    </TableHead>
                    <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
                      <div className="flex items-center">Name<SortIcon columnKey="name" /></div>
                    </TableHead>
                    <TableHead className="w-20 text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("exchange_rate")}>
                      <div className="flex items-center justify-end">Ex. Rate<SortIcon columnKey="exchange_rate" /></div>
                    </TableHead>
                    <TableHead className="w-16 text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort("is_internal")}>
                      <div className="flex items-center justify-center">Internal<SortIcon columnKey="is_internal" /></div>
                    </TableHead>
                    <TableHead className="w-16 text-center">Attach</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                        Loading transactions...
                      </TableCell>
                    </TableRow>
                  ) : sortedTransactions.length > 0 ? (
                    sortedTransactions.map((tx, index) => (
                      <TableRow key={tx.id || index}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">
                          {formatDate(tx.transaction_date)}
                        </TableCell>
                        <TableCell className="font-mono">{tx.master_acct_code || "-"}</TableCell>
                        <TableCell className="font-mono">{tx.project_code || "-"}</TableCell>
                        <TableCell className="font-mono">{tx.cbs_code || "-"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell>{tx.currency}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {tx.itbis ? formatCurrency(tx.itbis, tx.currency) : "-"}
                        </TableCell>
                        <TableCell>{tx.pay_method || "-"}</TableCell>
                        <TableCell className="truncate max-w-[100px]">{tx.document || "-"}</TableCell>
                        <TableCell className="truncate max-w-[120px]">{tx.name || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {tx.exchange_rate || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {tx.is_internal ? "Yes" : "No"}
                        </TableCell>
                        <TableCell className="text-center">
                          {tx.id ? (
                            <AttachmentCell
                              transactionId={tx.id}
                              attachmentUrl={tx.attachment_url}
                              onUpdate={handleAttachmentUpdate}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
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
    </MainLayout>
  );
}
