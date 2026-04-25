import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/formatters";
import { MapPin, ChevronDown } from "lucide-react";
import { format, startOfYear } from "date-fns";
import { ExportDropdown } from "./ExportDropdown";

interface Props {
  entityId: string | null;
  isAllEntities: boolean;
}

export function CostPerFieldTab({ entityId, isAllEntities }: Props) {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["rpc_get_cost_per_field", startDate, endDate, entityId, isAllEntities],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_cost_per_field", {
        p_start_date: startDate,
        p_end_date: endDate,
        ...(entityId && !isAllEntities ? { p_entity_id: entityId } : {}),
      });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!data?.length) return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
        <div><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
      </div>
      <EmptyState icon={MapPin} title="No field cost data" description="No operations found for the selected period." />
    </div>
  );

  // Group by entity_name (consolidated) or by farm
  if (isAllEntities) {
    const byEntity: Record<string, typeof data> = {};
    data.forEach((r: any) => {
      const eName = r.entity_name ?? "Unknown";
      if (!byEntity[eName]) byEntity[eName] = [];
      byEntity[eName].push(r);
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
          <ExportDropdown
            config={{ filename: `CostPerField_${format(new Date(), "yyyyMM")}`, title: "Cost per Field", subtitle: `${startDate} to ${endDate}`, orientation: "landscape" }}
            getData={() => ({
              columns: [
                { key: "entity", header: "Entity", width: 18 },
                { key: "farm", header: "Farm", width: 18 },
                { key: "field", header: "Field", width: 18 },
                { key: "operations", header: "Operations", width: 12 },
                { key: "hectares", header: "Hectares", width: 12 },
                { key: "cost", header: "Input Cost (DOP)", width: 18 },
              ],
              rows: data.map((r: any) => ({
                entity: r.entity_name ?? "-",
                farm: r.farm_name,
                field: r.field_name,
                operations: Number(r.operation_count) || 0,
                hectares: (Number(r.hectares_worked) || 0).toFixed(2),
                cost: formatCurrency(Number(r.input_cost_dop) || 0, "DOP"),
              })),
            })}
          />
        </div>
        {Object.entries(byEntity).map(([entityName, rows]) => {
          const totalOps = rows!.reduce((s, r: any) => s + (Number(r.operation_count) || 0), 0);
          const totalHa = rows!.reduce((s, r: any) => s + (Number(r.hectares_worked) || 0), 0);
          const totalCost = rows!.reduce((s, r: any) => s + (Number(r.input_cost_dop) || 0), 0);
          // Group by farm within entity
          const farms: Record<string, any[]> = {};
          rows!.forEach((r: any) => {
            if (!farms[r.farm_name]) farms[r.farm_name] = [];
            farms[r.farm_name].push(r);
          });

          return (
            <Collapsible key={entityName} defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                <ChevronDown className="h-4 w-4" />
                <span className="font-semibold">{entityName}</span>
                <span className="ml-auto text-sm text-muted-foreground">
                  {totalOps} ops · {totalHa.toFixed(0)} ha · {formatCurrency(totalCost, "DOP")}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
                    {Object.entries(farms).map(([farm, farmRows]) => (
                      <>
                        <TableRow key={`h-${farm}`} className="bg-muted/30">
                          <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{farm}</TableCell>
                        </TableRow>
                        {farmRows.map((r: any) => (
                          <TableRow key={r.field_id}>
                            <TableCell />
                            <TableCell>{r.field_name}</TableCell>
                            <TableCell className="text-right">{Number(r.operation_count) || 0}</TableCell>
                            <TableCell className="text-right">{(Number(r.hectares_worked) || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(r.input_cost_dop) || 0, "DOP")}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  }

  // Single entity: group by farm
  const farms: Record<string, typeof data> = {};
  data.forEach((r: any) => {
    if (!farms[r.farm_name]) farms[r.farm_name] = [];
    farms[r.farm_name]!.push(r);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
        <div><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
        <ExportDropdown
          config={{ filename: `CostPerField_${format(new Date(), "yyyyMM")}`, title: "Cost per Field", subtitle: `${startDate} to ${endDate}`, orientation: "landscape" }}
          getData={() => ({
            columns: [
              { key: "farm", header: "Farm", width: 18 },
              { key: "field", header: "Field", width: 18 },
              { key: "operations", header: "Operations", width: 12 },
              { key: "hectares", header: "Hectares", width: 12 },
              { key: "cost", header: "Input Cost (DOP)", width: 18 },
            ],
            rows: data.map((r: any) => ({
              farm: r.farm_name,
              field: r.field_name,
              operations: Number(r.operation_count) || 0,
              hectares: (Number(r.hectares_worked) || 0).toFixed(2),
              cost: formatCurrency(Number(r.input_cost_dop) || 0, "DOP"),
            })),
          })}
        />
      </div>
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
            const farmOps = rows!.reduce((s, r: any) => s + r.operation_count, 0);
            const farmHa = rows!.reduce((s, r: any) => s + r.hectares_worked, 0);
            const farmCost = rows!.reduce((s, r: any) => s + r.input_cost_dop, 0);
            return (
              <>
                <TableRow key={`h-${farm}`} className="bg-muted/30">
                  <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{farm}</TableCell>
                </TableRow>
                {rows!.map((r: any) => (
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
    </div>
  );
}
