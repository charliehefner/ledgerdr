import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/formatters";
import { Scale } from "lucide-react";
import { ExportDropdown } from "./ExportDropdown";
import { format } from "date-fns";

interface Props {
  entityId: string | null;
  isAllEntities: boolean;
}

export function TrialBalanceTab({ entityId, isAllEntities }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["v_trial_balance", entityId, isAllEntities],
    queryFn: async () => {
      let query = supabase.from("v_trial_balance").select("*").order("account_code");
      if (!isAllEntities && entityId) {
        query = query.eq("entity_id", entityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.length) return <EmptyState icon={Scale} title="No trial balance data" description="No posted journal entries found." />;

  // In consolidated mode, sum across entities by account_code
  type Row = { account_code: string; account_name: string; account_type: string; total_debits: number; total_credits: number; balance: number; entity_name?: string };
  let rows: Row[];

  if (isAllEntities) {
    const map = new Map<string, Row>();
    data.forEach((r) => {
      const key = r.account_code ?? "";
      const existing = map.get(key);
      if (existing) {
        existing.total_debits += r.total_debits ?? 0;
        existing.total_credits += r.total_credits ?? 0;
        existing.balance += r.balance ?? 0;
      } else {
        map.set(key, {
          account_code: r.account_code ?? "",
          account_name: r.account_name ?? "",
          account_type: r.account_type ?? "OTHER",
          total_debits: r.total_debits ?? 0,
          total_credits: r.total_credits ?? 0,
          balance: r.balance ?? 0,
        });
      }
    });
    rows = Array.from(map.values());
  } else {
    rows = data.map((r) => ({
      account_code: r.account_code ?? "",
      account_name: r.account_name ?? "",
      account_type: r.account_type ?? "OTHER",
      total_debits: r.total_debits ?? 0,
      total_credits: r.total_credits ?? 0,
      balance: r.balance ?? 0,
    }));
  }

  const grouped: Record<string, Row[]> = {};
  rows.forEach((r) => {
    const type = r.account_type;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  });

  const totalDebits = rows.reduce((s, r) => s + r.total_debits, 0);
  const totalCredits = rows.reduce((s, r) => s + r.total_credits, 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportDropdown
          config={{ filename: `TrialBalance_${format(new Date(), "yyyyMM")}`, title: "Trial Balance", subtitle: isAllEntities ? "Consolidated" : undefined, orientation: "landscape" }}
          getData={() => ({
            columns: [
              { key: "account_code", header: "Account Code", width: 14 },
              { key: "account_name", header: "Account Name", width: 30 },
              { key: "type", header: "Type", width: 12 },
              { key: "total_debits", header: "Total Debits", width: 16 },
              { key: "total_credits", header: "Total Credits", width: 16 },
              { key: "balance", header: "Balance", width: 16 },
            ],
            rows: rows.map((r) => ({
              account_code: r.account_code,
              account_name: r.account_name,
              type: r.account_type,
              total_debits: formatCurrency(r.total_debits, "DOP"),
              total_credits: formatCurrency(r.total_credits, "DOP"),
              balance: formatCurrency(r.balance, "DOP"),
            })),
            totalsRow: {
              account_code: "TOTALS",
              account_name: "",
              type: "",
              total_debits: formatCurrency(totalDebits, "DOP"),
              total_credits: formatCurrency(totalCredits, "DOP"),
              balance: balanced ? "✓ Balanced" : formatCurrency(totalDebits - totalCredits, "DOP"),
            },
          })}
        />
      </div>
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
        {Object.entries(grouped).map(([type, typeRows]) => (
          <>
            <TableRow key={`header-${type}`} className="bg-muted/30">
              <TableCell colSpan={6} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                {type}{isAllEntities ? " (Consolidated)" : ""}
              </TableCell>
            </TableRow>
            {typeRows.map((r) => (
              <TableRow key={r.account_code}>
                <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                <TableCell>{r.account_name}</TableCell>
                <TableCell>{r.account_type}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_debits, "DOP")}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total_credits, "DOP")}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(r.balance, "DOP")}</TableCell>
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
    </div>
  );
}
