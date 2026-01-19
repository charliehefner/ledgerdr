import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { mockInvoices, categories } from "@/data/mockInvoices";
import { formatCurrency } from "@/lib/formatters";
import { Download, FileText, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Calculate category totals
const categoryTotals = categories.map((category) => {
  const invoices = mockInvoices.filter((i) => i.category === category);
  const total = invoices.reduce((sum, i) => sum + i.total, 0);
  return { category, total, count: invoices.length };
}).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

// Monthly trend data
const monthlyTrend = [
  { month: "Sep", expenses: 15200, invoices: 12 },
  { month: "Oct", expenses: 18500, invoices: 15 },
  { month: "Nov", expenses: 22300, invoices: 18 },
  { month: "Dec", expenses: 19800, invoices: 14 },
  { month: "Jan", expenses: 29402, invoices: 8 },
];

// Top vendors
const vendorTotals = mockInvoices.reduce((acc, invoice) => {
  acc[invoice.vendor] = (acc[invoice.vendor] || 0) + invoice.total;
  return acc;
}, {} as Record<string, number>);

const topVendors = Object.entries(vendorTotals)
  .map(([vendor, total]) => ({ vendor, total }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 5);

const COLORS = [
  "hsl(220, 65%, 30%)",
  "hsl(38, 95%, 50%)",
  "hsl(142, 70%, 40%)",
  "hsl(200, 95%, 45%)",
  "hsl(280, 60%, 50%)",
  "hsl(15, 85%, 55%)",
];

export default function Reports() {
  const totalExpenses = mockInvoices.reduce((sum, i) => sum + i.total, 0);
  const paidExpenses = mockInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <MainLayout
      title="Reports"
      subtitle="Expense analytics and insights"
      actions={
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-semibold font-mono mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-semibold font-mono mt-1 text-success">
              {formatCurrency(paidExpenses)}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-semibold font-mono mt-1 text-warning">
              {formatCurrency(totalExpenses - paidExpenses)}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Avg per Invoice</p>
            <p className="text-2xl font-semibold font-mono mt-1">
              {formatCurrency(totalExpenses / mockInvoices.length)}
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Expense Trend */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Expense Trend</h3>
                <p className="text-sm text-muted-foreground">Monthly overview</p>
              </div>
              <Select defaultValue="6m">
                <SelectTrigger className="w-[120px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">3 Months</SelectItem>
                  <SelectItem value="6m">6 Months</SelectItem>
                  <SelectItem value="1y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
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
                  formatter={(value: number) => [formatCurrency(value), "Expenses"]}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By Category */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="font-semibold">Expenses by Category</h3>
              <p className="text-sm text-muted-foreground">Distribution breakdown</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="total"
                  nameKey="category"
                  label={({ category, percent }) => 
                    `${category.split(" ")[0]} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {categoryTotals.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Total"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Vendors */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-semibold">Top Vendors</h3>
            <p className="text-sm text-muted-foreground">Highest expense suppliers</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topVendors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <YAxis
                type="category"
                dataKey="vendor"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [formatCurrency(value), "Total"]}
              />
              <Bar 
                dataKey="total" 
                fill="hsl(var(--accent))" 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </MainLayout>
  );
}
