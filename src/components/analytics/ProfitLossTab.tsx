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
import { useEntity } from "@/contexts/EntityContext";

interface Props {
  entityId: string | null;
  isAllEntities: boolean;
}

export function ProfitLossTab({ entityId, isAllEntities }: Props) {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [costCenter, setCostCenter] = useState("");
  const { entities } = useEntity();

  // In consolidated mode, fetch per entity + consolidated
  const { data, isLoading } = useQuery({
    queryKey: ["rpc_get_profit_loss", startDate, endDate, costCenter, entityId, isAllEntities],
    queryFn: async () => {
      const params: Record<string, any> = {
        p_start_date: startDate,
        p_end_date: endDate,
        ...(costCenter ? { p_cost_center: costCenter } : {}),
      };

      if (isAllEntities) {
        const results: { entityName: string; entityId: string | null; data: any[] }[] = [];
        const { data: consData, error: consErr } = await (supabase.rpc as any)("get_profit_loss", { ...params });
        if (consErr) throw consErr;
        results.push({ entityName: "Consolidated", entityId: null, data: (consData ?? []) as any[] });
        for (const ent of entities) {
          const { data: entData, error: entErr } = await (supabase.rpc as any)("get_profit_loss", { ...params, p_entity_id: ent.id });
          if (entErr) throw entErr;
          results.push({ entityName: ent.name, entityId: ent.id, data: (entData as any[]) ?? [] });
        }
        return results;
      } else {
        const rpcParams = { ...params, ...(entityId ? { p_entity_id: entityId } : {}) };
        const { data: d, error } = await supabase.rpc("get_profit_loss" as any, rpcParams);
        if (error) throw error;
        return [{ entityName: "Current", entityId, data: d ?? [] }];
      }
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.length || !data[0].data.length) return <EmptyState icon={TrendingUp} title="No P&L data" description="No transactions found for the selected period." />;

  // Side-by-side in consolidated mode
  if (isAllEntities && data.length > 1) {
    // Collect all unique account rows
    const accountMap = new Map<string, { account_code: string; account_name: string; category: string }>();
    data.forEach((d) => d.data.forEach((r: any) => {
      if (!accountMap.has(r.account_code)) accountMap.set(r.account_code, { account_code: r.account_code, account_name: r.account_name, category: r.category });
    }));
    const accounts = Array.from(accountMap.values()).sort((a, b) => a.account_code.localeCompare(b.account_code));
    const incomeAccounts = accounts.filter((a) => a.category === "INCOME");
    const expenseAccounts = accounts.filter((a) => a.category === "EXPENSE");

    const getAmount = (entityData: any[], code: string) => {
      const row = entityData.find((r: any) => r.account_code === code);
      return row?.total_amount_dop ?? 0;
    };

    const entityTotals = (entityData: any[], category: string) =>
      entityData.filter((r: any) => r.category === category).reduce((s: number, r: any) => s + (r.total_amount_dop ?? 0), 0);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Cost Center</Label><Input placeholder="All" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className="w-40" /></div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                {data.map((d) => (
                  <TableHead key={d.entityId ?? "cons"} className="text-right">{d.entityName}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30"><TableCell colSpan={2 + data.length} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Income</TableCell></TableRow>
              {incomeAccounts.map((a) => (
                <TableRow key={a.account_code}>
                  <TableCell className="font-mono text-sm">{a.account_code}</TableCell>
                  <TableCell>{a.account_name}</TableCell>
                  {data.map((d) => (
                    <TableCell key={d.entityId ?? "cons"} className="text-right">{formatCurrency(getAmount(d.data, a.account_code), "DOP")}</TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell colSpan={2} className="font-bold">Total Income</TableCell>
                {data.map((d) => (
                  <TableCell key={d.entityId ?? "cons"} className="text-right font-bold">{formatCurrency(entityTotals(d.data, "INCOME"), "DOP")}</TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-muted/30"><TableCell colSpan={2 + data.length} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Expenses</TableCell></TableRow>
              {expenseAccounts.map((a) => (
                <TableRow key={a.account_code}>
                  <TableCell className="font-mono text-sm">{a.account_code}</TableCell>
                  <TableCell>{a.account_name}</TableCell>
                  {data.map((d) => (
                    <TableCell key={d.entityId ?? "cons"} className="text-right">{formatCurrency(getAmount(d.data, a.account_code), "DOP")}</TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell colSpan={2} className="font-bold">Total Expenses</TableCell>
                {data.map((d) => (
                  <TableCell key={d.entityId ?? "cons"} className="text-right font-bold">{formatCurrency(entityTotals(d.data, "EXPENSE"), "DOP")}</TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-primary/5 border-t-4">
                <TableCell colSpan={2} className="font-bold text-lg">Net Profit / Loss</TableCell>
                {data.map((d) => {
                  const net = entityTotals(d.data, "INCOME") - entityTotals(d.data, "EXPENSE");
                  return (
                    <TableCell key={d.entityId ?? "cons"} className={`text-right font-bold text-lg ${net >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {formatCurrency(net, "DOP")}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Single entity view
  const singleData = data[0].data;
  const income = singleData.filter((r: any) => r.category === "INCOME");
  const expense = singleData.filter((r: any) => r.category === "EXPENSE");
  const totalIncome = income.reduce((s: number, r: any) => s + (r.total_amount_dop ?? 0), 0);
  const totalExpense = expense.reduce((s: number, r: any) => s + (r.total_amount_dop ?? 0), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
        <div><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
        <div><Label className="text-xs">Cost Center</Label><Input placeholder="All" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className="w-40" /></div>
      </div>
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
          <TableRow className="bg-muted/30"><TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Income</TableCell></TableRow>
          {income.map((r: any) => (
            <TableRow key={r.account_code}><TableCell className="font-mono text-sm">{r.account_code}</TableCell><TableCell>{r.account_name}</TableCell><TableCell className="text-right">{formatCurrency(r.total_amount_dop, "DOP")}</TableCell><TableCell className="text-right">{r.transaction_count}</TableCell></TableRow>
          ))}
          <TableRow className="border-t-2"><TableCell colSpan={2} className="font-bold">Total Income</TableCell><TableCell className="text-right font-bold">{formatCurrency(totalIncome, "DOP")}</TableCell><TableCell /></TableRow>
          <TableRow className="bg-muted/30"><TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Expenses</TableCell></TableRow>
          {expense.map((r: any) => (
            <TableRow key={r.account_code}><TableCell className="font-mono text-sm">{r.account_code}</TableCell><TableCell>{r.account_name}</TableCell><TableCell className="text-right">{formatCurrency(r.total_amount_dop, "DOP")}</TableCell><TableCell className="text-right">{r.transaction_count}</TableCell></TableRow>
          ))}
          <TableRow className="border-t-2"><TableCell colSpan={2} className="font-bold">Total Expenses</TableCell><TableCell className="text-right font-bold">{formatCurrency(totalExpense, "DOP")}</TableCell><TableCell /></TableRow>
          <TableRow className="bg-primary/5 border-t-4">
            <TableCell colSpan={2} className="font-bold text-lg">Net Profit / Loss</TableCell>
            <TableCell className={`text-right font-bold text-lg ${net >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(net, "DOP")}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
