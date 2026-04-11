import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { Users } from "lucide-react";
import { format, startOfYear } from "date-fns";
import { ExportDropdown } from "./ExportDropdown";

import { fmtDate } from "@/lib/dateUtils";

interface Props {
  entityId: string | null;
  isAllEntities: boolean;
}

export function PayrollSummaryTab({ entityId, isAllEntities }: Props) {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["v_payroll_summary", startDate, endDate, entityId, isAllEntities],
    queryFn: async () => {
      let query = supabase
        .from("v_payroll_summary")
        .select("*")
        .gte("start_date", startDate)
        .lte("end_date", endDate)
        .order("start_date", { ascending: false });

      if (!isAllEntities && entityId) {
        query = query.eq("entity_id", entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.length) return <EmptyState icon={Users} title="No hay datos de nómina" description="No hay datos para el período seleccionado." />;

  const totals = data.reduce(
    (acc, r) => ({
      employees: acc.employees + (r.employee_count ?? 0),
      gross: acc.gross + (r.total_gross ?? 0),
      net: acc.net + (r.total_net ?? 0),
      tss: acc.tss + (r.total_tss ?? 0),
      isr: acc.isr + (r.total_isr ?? 0),
      benefits: acc.benefits + (r.total_benefits ?? 0),
    }),
    { employees: 0, gross: 0, net: 0, tss: 0, isr: 0, benefits: 0 }
  );

  const periodLabel = (r: typeof data[0]) => {
    const s = r.start_date ? fmtDate(new Date(r.start_date + "T12:00:00")) : "";
    const e = r.end_date ? fmtDate(new Date(r.end_date + "T12:00:00")) : "";
    return `${s} – ${e}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs">Fecha Inicio</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">Fecha Fin</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <ExportDropdown
          config={{
            filename: `PayrollSummary_${format(new Date(), "yyyyMM")}`,
            title: "Resumen de Nómina",
            subtitle: `${startDate} a ${endDate}`,
            orientation: "landscape",
          }}
          getData={() => ({
            columns: [
              { key: "period", header: "Período", width: 24 },
              { key: "status", header: "Estado", width: 12 },
              ...(isAllEntities ? [{ key: "entity", header: "Entidad", width: 20 }] : []),
              { key: "employees", header: "Empleados", width: 12 },
              { key: "gross", header: "Bruto (DOP)", width: 16 },
              { key: "tss", header: "TSS (DOP)", width: 16 },
              { key: "isr", header: "ISR (DOP)", width: 16 },
              { key: "benefits", header: "Beneficios (DOP)", width: 16 },
              { key: "net", header: "Neto (DOP)", width: 16 },
            ],
            rows: data.map((r) => ({
              period: periodLabel(r),
              status: r.status ?? "",
              ...(isAllEntities ? { entity: r.entity_name ?? "-" } : {}),
              employees: r.employee_count ?? 0,
              gross: formatCurrency(r.total_gross ?? 0, "DOP"),
              tss: formatCurrency(r.total_tss ?? 0, "DOP"),
              isr: formatCurrency(r.total_isr ?? 0, "DOP"),
              benefits: formatCurrency(r.total_benefits ?? 0, "DOP"),
              net: formatCurrency(r.total_net ?? 0, "DOP"),
            })),
            totalsRow: {
              period: "TOTALES",
              status: "",
              ...(isAllEntities ? { entity: "" } : {}),
              employees: totals.employees,
              gross: formatCurrency(totals.gross, "DOP"),
              tss: formatCurrency(totals.tss, "DOP"),
              isr: formatCurrency(totals.isr, "DOP"),
              benefits: formatCurrency(totals.benefits, "DOP"),
              net: formatCurrency(totals.net, "DOP"),
            },
          })}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead>Estado</TableHead>
            {isAllEntities && <TableHead>Entidad</TableHead>}
            <TableHead className="text-right">Empleados</TableHead>
            <TableHead className="text-right">Bruto (DOP)</TableHead>
            <TableHead className="text-right">TSS (DOP)</TableHead>
            <TableHead className="text-right">ISR (DOP)</TableHead>
            <TableHead className="text-right">Beneficios (DOP)</TableHead>
            <TableHead className="text-right">Neto (DOP)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={`${r.period_id}-${r.entity_id}`}>
              <TableCell className="whitespace-nowrap">{periodLabel(r)}</TableCell>
              <TableCell className="capitalize">{r.status}</TableCell>
              {isAllEntities && <TableCell>{r.entity_name ?? "-"}</TableCell>}
              <TableCell className="text-right">{r.employee_count ?? 0}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.total_gross ?? 0, "DOP")}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.total_tss ?? 0, "DOP")}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.total_isr ?? 0, "DOP")}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.total_benefits ?? 0, "DOP")}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(r.total_net ?? 0, "DOP")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="font-bold">
            <TableCell>TOTALES</TableCell>
            <TableCell />
            {isAllEntities && <TableCell />}
            <TableCell className="text-right">{totals.employees}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.gross, "DOP")}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.tss, "DOP")}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.isr, "DOP")}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.benefits, "DOP")}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.net, "DOP")}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
