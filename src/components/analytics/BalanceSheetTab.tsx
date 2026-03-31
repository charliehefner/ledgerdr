import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { Building2 } from "lucide-react";
import { format } from "date-fns";

const SECTIONS = [
  { type: "ASSET", label: "Assets", sign: 1 },
  { type: "LIABILITY", label: "Liabilities", sign: -1 },
  { type: "EQUITY", label: "Equity", sign: -1 },
] as const;

export function BalanceSheetTab() {
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["rpc_get_balance_sheet", asOfDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_balance_sheet", { p_as_of_date: asOfDate });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const sectionTotals: Record<string, number> = {};
  SECTIONS.forEach(({ type, sign }) => {
    sectionTotals[type] = (data ?? [])
      .filter((r) => r.account_type === type)
      .reduce((s, r) => s + r.balance * sign, 0);
  });

  const balanceCheck = (sectionTotals["ASSET"] ?? 0) - (sectionTotals["LIABILITY"] ?? 0) - (sectionTotals["EQUITY"] ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div>
          <Label className="text-xs">As of Date</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {!data?.length ? (
        <EmptyState icon={Building2} title="No balance sheet data" description="No posted journal entries found." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">Balance (DOP)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SECTIONS.map(({ type, label, sign }) => {
              const rows = data.filter((r) => r.account_type === type);
              if (!rows.length) return null;
              return (
                <>
                  <TableRow key={`h-${type}`} className="bg-muted/30">
                    <TableCell colSpan={3} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{label}</TableCell>
                  </TableRow>
                  {rows.map((r) => (
                    <TableRow key={r.account_code}>
                      <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                      <TableCell>{r.account_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.balance * sign, "DOP")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={2} className="font-bold">Total {label}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(sectionTotals[type], "DOP")}</TableCell>
                  </TableRow>
                </>
              );
            })}
            <TableRow className="bg-primary/5 border-t-4">
              <TableCell colSpan={2} className="font-bold text-lg">Balance Check (A − L − E)</TableCell>
              <TableCell className={`text-right font-bold text-lg ${Math.abs(balanceCheck) < 0.01 ? "text-green-600" : "text-destructive"}`}>
                {Math.abs(balanceCheck) < 0.01 ? "✓ Balanced" : formatCurrency(balanceCheck, "DOP")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
