import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { fetchRecentTransactions, Transaction } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, FileSpreadsheet, FileText, Calendar } from "lucide-react";
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

const COLORS = [
  "hsl(220, 65%, 30%)",
  "hsl(38, 95%, 50%)",
  "hsl(142, 70%, 40%)",
  "hsl(200, 95%, 45%)",
  "hsl(280, 60%, 50%)",
  "hsl(15, 85%, 55%)",
];

export default function Reports() {
  const [limit, setLimit] = useState("50");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['reportTransactions', limit],
    queryFn: () => fetchRecentTransactions(parseInt(limit)),
  });

  // Calculate totals by currency
  const totalsByCurrency = transactions.reduce((acc, tx) => {
    acc[tx.currency] = (acc[tx.currency] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  // Calculate totals by account
  const totalsByAccount = transactions.reduce((acc, tx) => {
    acc[tx.master_acct_code] = (acc[tx.master_acct_code] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const accountChartData = Object.entries(totalsByAccount)
    .map(([account, total]) => ({ account, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Calculate totals by payment method
  const totalsByPayMethod = transactions.reduce((acc, tx) => {
    const method = tx.pay_method || 'Unknown';
    acc[method] = (acc[method] || 0) + tx.amount;
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
      pair.accounts.includes(tx.master_acct_code) && 
      tx.cbs_code?.startsWith(pair.cbs)
    );
    const totalDOP = matchingTx
      .filter(tx => tx.currency === "DOP")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalUSD = matchingTx
      .filter(tx => tx.currency === "USD")
      .reduce((sum, tx) => sum + tx.amount, 0);
    return {
      label: pair.label,
      count: matchingTx.length,
      totalDOP,
      totalUSD,
    };
  });

  const exportToExcel = () => {
    if (transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const exportData = transactions.map(tx => ({
      "Date": tx.transaction_date,
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
    if (transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(18);
    doc.text("Transaction Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Transactions: ${transactions.length}`, 14, 36);

    // Summary by currency
    let yPos = 44;
    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      doc.text(`Total ${currency}: ${formatCurrency(total, currency)}`, 14, yPos);
      yPos += 6;
    });

    // Table
    const tableData = transactions.map(tx => [
      tx.transaction_date,
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
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="20">Last 20</SelectItem>
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="100">Last 100</SelectItem>
              <SelectItem value="500">Last 500</SelectItem>
            </SelectContent>
          </Select>
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

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">ITBIS</TableHead>
                    <TableHead>Pay Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Loading transactions...
                      </TableCell>
                    </TableRow>
                  ) : transactions.length > 0 ? (
                    transactions.map((tx, index) => (
                      <TableRow key={tx.id || index}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(tx.transaction_date)}
                        </TableCell>
                        <TableCell className="font-mono">{tx.master_acct_code}</TableCell>
                        <TableCell className="font-mono">{tx.project_code || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell>{tx.currency}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {tx.itbis ? formatCurrency(tx.itbis, tx.currency) : "-"}
                        </TableCell>
                        <TableCell>{tx.pay_method || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
