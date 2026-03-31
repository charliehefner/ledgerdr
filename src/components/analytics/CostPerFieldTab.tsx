import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { MapPin } from "lucide-react";
import { format, startOfYear } from "date-fns";

export function CostPerFieldTab() {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["rpc_get_cost_per_field", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cost_per_field", { p_start_date: startDate, p_end_date: endDate });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  // Group by farm
  const farms: Record<string, typeof data> = {};
  (data ?? []).forEach((r) => {
    if (!farms[r.farm_name]) farms[r.farm_name] = [];
    farms[r.farm_name]!.push(r);
  });

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
      </div>

      {!data?.length ? (
        <EmptyState icon={MapPin} title="No field cost data" description="No operations found for the selected period." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Farm</TableHead>
              <TableHead>Field</TableHead>
              <TableHead className="text-right">Operations</TableHead>
              <TableHead className="text-right">Hectares</TableHead>
              <TableHead className="text-right">Input Cost (DOP)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(farms).map(([farm, rows]) => {
              const farmOps = rows!.reduce((s, r) => s + r.operation_count, 0);
              const farmHa = rows!.reduce((s, r) => s + r.hectares_worked, 0);
              const farmCost = rows!.reduce((s, r) => s + r.input_cost_dop, 0);
              return (
                <>
                  <TableRow key={`h-${farm}`} className="bg-muted/30">
                    <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{farm}</TableCell>
                  </TableRow>
                  {rows!.map((r) => (
                    <TableRow key={r.field_id}>
                      <TableCell />
                      <TableCell>{r.field_name}</TableCell>
                      <TableCell className="text-right">{r.operation_count}</TableCell>
                      <TableCell className="text-right">{r.hectares_worked.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.input_cost_dop, "DOP")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t">
                    <TableCell colSpan={2} className="font-bold text-sm">Subtotal {farm}</TableCell>
                    <TableCell className="text-right font-bold">{farmOps}</TableCell>
                    <TableCell className="text-right font-bold">{farmHa.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(farmCost, "DOP")}</TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
