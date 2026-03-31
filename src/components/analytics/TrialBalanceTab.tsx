import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/formatters";
import { Scale } from "lucide-react";

export function TrialBalanceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["v_trial_balance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_trial_balance").select("*").order("account_code");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.length) return <EmptyState icon={Scale} title="No trial balance data" description="No posted journal entries found." />;

  // Group by account_type
  const grouped: Record<string, typeof data> = {};
  data.forEach((r) => {
    const type = r.account_type ?? "OTHER";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  });

  const totalDebits = data.reduce((s, r) => s + (r.total_debits ?? 0), 0);
  const totalCredits = data.reduce((s, r) => s + (r.total_credits ?? 0), 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account Code</TableHead>
          <TableHead>Account Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Total Debits</TableHead>
          <TableHead className="text-right">Total Credits</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(grouped).map(([type, rows]) => (
          <>
            <TableRow key={`header-${type}`} className="bg-muted/30">
              <TableCell colSpan={6} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                {type}
              </TableCell>
            </TableRow>
            {rows.map((r) => (
              <TableRow key={r.account_code}>
                <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                <TableCell>{r.account_name}</TableCell>
                <TableCell>{r.account_type}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_debits ?? 0, "DOP")}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_credits ?? 0, "DOP")}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(r.balance ?? 0, "DOP")}</TableCell>
              </TableRow>
            ))}
          </>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3} className="font-bold">Totals</TableCell>
          <TableCell className="text-right font-bold">{formatCurrency(totalDebits, "DOP")}</TableCell>
          <TableCell className="text-right font-bold">{formatCurrency(totalCredits, "DOP")}</TableCell>
          <TableCell className={`text-right font-bold ${balanced ? "text-green-600" : "text-destructive"}`}>
            {balanced ? "✓ Balanced" : `Difference: ${formatCurrency(totalDebits - totalCredits, "DOP")}`}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
