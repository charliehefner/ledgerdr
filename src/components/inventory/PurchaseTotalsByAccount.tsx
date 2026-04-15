import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { useEntityFilter } from "@/hooks/useEntityFilter";

type FunctionCategory = "agrochemicals" | "diesel" | "fertilizer" | "oil_grease";

const FUNCTION_TO_CATEGORY: Record<string, FunctionCategory> = {
  fuel: "diesel",
  fertilizer: "fertilizer",
  pre_emergent_herbicide: "agrochemicals",
  post_emergent_herbicide: "agrochemicals",
  adherente: "agrochemicals",
  condicionador: "agrochemicals",
};

const CATEGORY_LABELS: Record<FunctionCategory, string> = {
  agrochemicals: "Agrochemicals",
  diesel: "Diesel",
  fertilizer: "Fertilizer",
  oil_grease: "Oil and Grease",
};

const CATEGORY_ORDER: FunctionCategory[] = ["agrochemicals", "diesel", "fertilizer", "oil_grease"];

export function PurchaseTotalsByAccount() {
  const [period, setPeriod] = useState("current_month");
  const { entityId } = useEntityFilter();

  const dateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    switch (period) {
      case "past_month": {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
      }
      case "ytd":
        return { start: `${year}-01-01`, end: now.toISOString().slice(0, 10) };
      case "prior_year":
        return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
      case "current_month":
      default: {
        const start = new Date(year, month, 1);
        return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
      }
    }
  }, [period]);

  const { data: purchases = [] } = useQuery({
    queryKey: ["inventoryPurchaseTotals", dateRange, entityId],
    queryFn: async () => {
      let query = supabase
        .from("inventory_purchases")
        .select("total_price, item_id, inventory_items!inner(function)")
        .gte("purchase_date", dateRange.start)
        .lte("purchase_date", dateRange.end);

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const categoryMap: Record<FunctionCategory, { count: number; totalDOP: number }> = {
      agrochemicals: { count: 0, totalDOP: 0 },
      diesel: { count: 0, totalDOP: 0 },
      fertilizer: { count: 0, totalDOP: 0 },
      oil_grease: { count: 0, totalDOP: 0 },
    };

    for (const p of purchases) {
      const fn = (p.inventory_items as any)?.function as string;
      const cat = FUNCTION_TO_CATEGORY[fn];
      if (!cat) continue;
      categoryMap[cat].count += 1;
      categoryMap[cat].totalDOP += Number(p.total_price) || 0;
    }

    return CATEGORY_ORDER.map((cat) => ({
      label: CATEGORY_LABELS[cat],
      count: categoryMap[cat].count,
      totalDOP: categoryMap[cat].totalDOP,
    }));
  }, [purchases]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Purchase Totals by Category</CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="current_month">Mes Actual</SelectItem>
            <SelectItem value="past_month">Mes Anterior</SelectItem>
            <SelectItem value="ytd">Año en Curso</SelectItem>
            <SelectItem value="prior_year">Año Anterior</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Purchases</TableHead>
              <TableHead className="text-right">Total DOP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right font-mono">{row.count}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.totalDOP, "DOP")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
