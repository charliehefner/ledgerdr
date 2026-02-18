import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Copy } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { calculateMonthlyISR, TSS_EMPLOYEE_RATE } from "@/lib/payrollCalculations";

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export function IR3ReportView() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  // Fetch active employees with benefits
  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ["employees-ir3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, cedula, salary, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: benefits = [] } = useQuery({
    queryKey: ["employee-benefits-ir3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_benefits")
        .select("employee_id, benefit_type, amount");
      if (error) throw error;
      return data;
    },
  });

  const reportData = useMemo(() => {
    return employees.map((emp) => {
      const empBenefits = benefits.filter((b) => b.employee_id === emp.id);
      const monthlyBenefits = empBenefits.reduce((sum, b) => sum + b.amount, 0) * 2; // bi-weekly to monthly
      const monthlyISR = calculateMonthlyISR(emp.salary, monthlyBenefits);
      const monthlyTSS = emp.salary * TSS_EMPLOYEE_RATE;

      return {
        id: emp.id,
        name: emp.name,
        cedula: emp.cedula,
        salary: emp.salary,
        tss: monthlyTSS,
        isr: monthlyISR,
      };
    }).filter((r) => r.isr > 0);
  }, [employees, benefits]);

  const totalISR = reportData.reduce((sum, r) => sum + r.isr, 0);

  const handleCopyTotal = () => {
    navigator.clipboard.writeText(totalISR.toFixed(2));
    toast.success("Total ISR copiado al portapapeles");
  };

  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("IR-3");

    ws.columns = [
      { header: "Cédula", key: "cedula", width: 15 },
      { header: "Nombre", key: "name", width: 30 },
      { header: "Salario Mensual", key: "salary", width: 18 },
      { header: "TSS Empleado", key: "tss", width: 15 },
      { header: "ISR Retenido", key: "isr", width: 15 },
    ];

    reportData.forEach((r) => ws.addRow(r));
    ws.addRow({ cedula: "", name: "TOTAL", salary: 0, tss: 0, isr: totalISR });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const fileName = `IR3_${selectedMonth}_${selectedYear}.xlsx`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success("Exportado exitosamente");
        return;
      } catch { /* cancelled */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado exitosamente");
  };

  const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>IR-3 — Retenciones de Asalariados</CardTitle>
        <CardDescription>
          ISR retenido mensual a empleados. Usa este total para completar la casilla correspondiente en el formulario IR-3 de la DGII.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Mes</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Año</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handleCopyTotal} disabled={totalISR === 0}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Total
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={reportData.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {loadingEmps ? "Cargando..." : `${reportData.length} empleados con retención ISR`}
        </div>

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cédula</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Salario Mensual</TableHead>
                <TableHead className="text-right">TSS Empleado</TableHead>
                <TableHead className="text-right">ISR Retenido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.cedula}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.salary)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.tss)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.isr)}</TableCell>
                </TableRow>
              ))}
              {reportData.length === 0 && !loadingEmps && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay empleados con retención ISR para este período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {reportData.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">Total ISR a declarar en IR-3</TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg">{fmt(totalISR)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
