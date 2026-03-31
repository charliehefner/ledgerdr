import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Fuel } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths } from "date-fns";

export function FuelConsumptionTab() {
  const months = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < 12; i++) {
      list.push(format(subMonths(new Date(), i), "yyyy-MM"));
    }
    return list;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["v_fuel_consumption"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_fuel_consumption").select("*");
      if (error) throw error;
      return data;
    },
  });

  const monthData = data?.filter((r) => r.month === selectedMonth) ?? [];

  // Chart: aggregate by month across all equipment
  const chartData = useMemo(() => {
    if (!data) return [];
    const byMonth: Record<string, number> = {};
    data.forEach((r) => {
      const m = r.month ?? "unknown";
      byMonth[m] = (byMonth[m] ?? 0) + (r.total_gallons ?? 0);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, gallons]) => ({ month, gallons: Math.round(gallons * 100) / 100 }));
  }, [data]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.length) return <EmptyState icon={Fuel} title="No fuel data" description="No fuel consumption records found." />;

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div>
          <Label className="text-xs">Month</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Detail table for selected month */}
      {monthData.length === 0 ? (
        <EmptyState icon={Fuel} title="No data for this month" description="Select a different month." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total Gallons</TableHead>
              <TableHead className="text-right">Avg Gal/Hr</TableHead>
              <TableHead className="text-right">Dispenses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthData.map((r) => (
              <TableRow key={r.equipment_id}>
                <TableCell>{r.equipment_name}</TableCell>
                <TableCell className="capitalize">{r.equipment_type}</TableCell>
                <TableCell className="text-right">{(r.total_gallons ?? 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{(r.avg_gallons_per_hour ?? 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{r.dispense_count ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="gallons" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
