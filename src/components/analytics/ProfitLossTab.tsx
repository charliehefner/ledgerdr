import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { TrendingUp } from "lucide-react";
import { format, startOfYear } from "date-fns";

export function ProfitLossTab() {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [costCenter, setCostCenter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["rpc_get_profit_loss", startDate, endDate, costCenter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profit_loss", {
        p_start_date: startDate,
        p_end_date: endDate,
        ...(costCenter ? { p_cost_center: costCenter } : {}),
      });
      if (error) throw error;
      return data;
    },
  });

  const income = data?.filter((r) => r.category === "INCOME") ?? [];
  const expense = data?.filter((r) => r.category === "EXPENSE") ?? [];
  const totalIncome = income.reduce((s, r) => s + (r.total_amount_dop ?? 0), 0);
  const totalExpense = expense.reduce((s, r) => s + (r.total_amount_dop ?? 0), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">Cost Center</Label>
          <Input placeholder="All" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className="w-40" />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data?.length ? (
        <EmptyState icon={TrendingUp} title="No P&L data" description="No transactions found for the selected period." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">Amount (DOP)</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* INCOME */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Income</TableCell>
            </TableRow>
            {income.map((r) => (
              <TableRow key={r.account_code}>
                <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                <TableCell>{r.account_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_amount_dop, "DOP")}</TableCell>
                <TableCell className="text-right">{r.transaction_count}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell colSpan={2} className="font-bold">Total Income</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(totalIncome, "DOP")}</TableCell>
              <TableCell />
            </TableRow>

            {/* EXPENSE */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Expenses</TableCell>
            </TableRow>
            {expense.map((r) => (
              <TableRow key={r.account_code}>
                <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                <TableCell>{r.account_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_amount_dop, "DOP")}</TableCell>
                <TableCell className="text-right">{r.transaction_count}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell colSpan={2} className="font-bold">Total Expenses</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(totalExpense, "DOP")}</TableCell>
              <TableCell />
            </TableRow>

            {/* NET */}
            <TableRow className="bg-primary/5 border-t-4">
              <TableCell colSpan={2} className="font-bold text-lg">Net Profit / Loss</TableCell>
              <TableCell className={`text-right font-bold text-lg ${net >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(net, "DOP")}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
