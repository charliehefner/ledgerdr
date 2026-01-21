import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fetchRecentTransactions, fetchAccounts } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  FileText, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  ArrowRight 
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { mockInvoices } from "@/data/mockInvoices";

// Calculate stats from mock data (keeping for now as per deferred update)
const totalInvoices = mockInvoices.length;
const totalAmount = mockInvoices.reduce((sum, inv) => sum + inv.total, 0);
const pendingAmount = mockInvoices
  .filter((inv) => inv.status === "pending" || inv.status === "approved")
  .reduce((sum, inv) => sum + inv.total, 0);
const overdueCount = mockInvoices.filter((inv) => inv.status === "overdue").length;

// Monthly data for chart
const monthlyData = [
  { month: "Oct", amount: 18500 },
  { month: "Nov", amount: 22300 },
  { month: "Dec", amount: 19800 },
  { month: "Jan", amount: 29402 },
];

// Status distribution for pie chart
const statusData = [
  { name: "Paid", value: mockInvoices.filter((i) => i.status === "paid").length, color: "hsl(142, 70%, 40%)" },
  { name: "Pending", value: mockInvoices.filter((i) => i.status === "pending").length, color: "hsl(38, 92%, 50%)" },
  { name: "Approved", value: mockInvoices.filter((i) => i.status === "approved").length, color: "hsl(200, 95%, 45%)" },
  { name: "Overdue", value: mockInvoices.filter((i) => i.status === "overdue").length, color: "hsl(0, 72%, 51%)" },
  { name: "Draft", value: mockInvoices.filter((i) => i.status === "draft").length, color: "hsl(215, 15%, 60%)" },
];

export default function Dashboard() {
  const { getDescription } = useLanguage();

  // Fetch transactions without documents
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: () => fetchRecentTransactions(50),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  // Filter: non-voided transactions without a document
  const transactionsWithoutDocument = allTransactions
    .filter(tx => !tx.is_void && (!tx.document || tx.document.trim() === ''));

  const getAccountDescription = (code: string) => {
    const account = accounts.find(a => a.code === code);
    if (!account) return code;
    return getDescription(account);
  };

  return (
    <MainLayout title="Dashboard" subtitle="Overview of your expense invoices">
      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Invoices"
            value={totalInvoices}
            subtitle="All time"
            icon={FileText}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Total Amount"
            value={formatCurrency(totalAmount)}
            subtitle="This month"
            icon={DollarSign}
            trend={{ value: 8.2, isPositive: true }}
          />
          <StatCard
            title="Pending Payment"
            value={formatCurrency(pendingAmount)}
            subtitle="Awaiting approval/payment"
            icon={Clock}
          />
          <StatCard
            title="Overdue"
            value={overdueCount}
            subtitle="Requires attention"
            icon={AlertTriangle}
            className={overdueCount > 0 ? "border-destructive/50" : ""}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Monthly Expenses Chart */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Monthly Expenses</h3>
                <p className="text-sm text-muted-foreground">Last 4 months trend</p>
              </div>
              <div className="flex items-center gap-2 text-success">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+12.5%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Amount"]}
                />
                <Bar 
                  dataKey="amount" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Invoice Status</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.name} ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions Without Document */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="font-semibold">Transactions Without Document</h3>
              <p className="text-sm text-muted-foreground">Pending document attachment</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/transactions">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : transactionsWithoutDocument.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    All transactions have documents attached
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithoutDocument.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell>{getAccountDescription(tx.master_acct_code)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.amount, tx.currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
