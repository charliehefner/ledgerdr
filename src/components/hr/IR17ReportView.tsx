import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, FileSpreadsheet } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { calculateComplementaryTax, loadTssParameters } from "@/lib/payrollCalculations";

const MONTHS = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" }, { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" }, { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" }, { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
];

export function IR17ReportView() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  const monthInt = parseInt(selectedMonth);
  const yearInt = parseInt(selectedYear);
  const startDate = `${selectedYear}-${selectedMonth}-01`;
  const lastDay = new Date(yearInt, monthInt, 0).getDate();
  const endDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

  // Section I: Transactions with ISR or ITBIS retentions
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions-ir17", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, name, description, amount, isr_retenido, itbis_retenido, rnc, dgii_tipo_bienes_servicios")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_void", false)
        .or("isr_retenido.gt.0,itbis_retenido.gt.0");
      if (error) throw error;
      return data;
    },
  });

  // Employees for identity info
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-ir17"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, cedula, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Payroll snapshots for the selected month (benefits from closed payroll)
  const { data: snapshotBenefits = [], isLoading: loadingSnap } = useQuery({
    queryKey: ["ir17-snapshots", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data: periods, error: pErr } = await supabase
        .from("payroll_periods")
        .select("id, status")
        .lte("start_date", endDate)
        .gte("end_date", startDate);
      if (pErr) throw pErr;
      if (!periods || periods.length === 0) return [];

      const closedIds = periods.filter((p) => p.status === "closed").map((p) => p.id);
      if (closedIds.length === 0) return [];

      const { data: snapshots, error: sErr } = await supabase
        .from("payroll_snapshots")
        .select("employee_id, total_benefits")
        .in("period_id", closedIds);
      if (sErr) throw sErr;
      return snapshots || [];
    },
  });

  // Fallback: live employee_benefits (when no snapshots)
  const { data: liveBenefits = [] } = useQuery({
    queryKey: ["employee-benefits-ir17"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_benefits")
        .select("employee_id, benefit_type, amount");
      if (error) throw error;
      return data;
    },
  });

  // Section I calculations
  const sectionI = useMemo(() => {
    const isrTransactions = transactions.filter((t) => (t.isr_retenido || 0) > 0);
    const totalISR = isrTransactions.reduce((sum, t) => sum + (t.isr_retenido || 0), 0);
    return { transactions: isrTransactions, totalISR };
  }, [transactions]);

  // Section II: Retribuciones Complementarias — prefer snapshots
  const sectionII = useMemo(() => {
    // Build snapshot map: employee_id → total monthly benefits
    const snapMap = new Map<string, number>();
    for (const s of snapshotBenefits) {
      snapMap.set(s.employee_id, (snapMap.get(s.employee_id) || 0) + (s.total_benefits || 0));
    }
    const hasSnapshots = snapMap.size > 0;

    const rows = employees
      .map((emp) => {
        let monthlyBenefits: number;
        let source: "snapshot" | "estimate";

        if (hasSnapshots && snapMap.has(emp.id)) {
          monthlyBenefits = snapMap.get(emp.id)!;
          source = "snapshot";
        } else {
          // Fallback: live benefits
          const empBenefits = liveBenefits.filter((b) => b.employee_id === emp.id);
          if (empBenefits.length === 0) return null;
          monthlyBenefits = empBenefits.reduce((sum, b) => sum + b.amount, 0) * 2; // bi-weekly to monthly
          source = "estimate";
        }

        if (monthlyBenefits <= 0) return null;

        const tax = calculateComplementaryTax(monthlyBenefits);
        return { id: emp.id, name: emp.name, cedula: emp.cedula, monthlyAmount: monthlyBenefits, tax, source };
      })
      .filter(Boolean) as { id: string; name: string; cedula: string; monthlyAmount: number; tax: number; source: "snapshot" | "estimate" }[];

    const totalTax = rows.reduce((sum, r) => sum + r.tax, 0);
    const hasAnySnapshot = rows.some((r) => r.source === "snapshot");
    return { rows, totalTax, hasAnySnapshot };
  }, [employees, snapshotBenefits, liveBenefits]);

  // Section III: ITBIS retenido
  const sectionIII = useMemo(() => {
    const itbisTransactions = transactions.filter((t) => (t.itbis_retenido || 0) > 0);
    const totalITBIS = itbisTransactions.reduce((sum, t) => sum + (t.itbis_retenido || 0), 0);
    return { transactions: itbisTransactions, totalITBIS };
  }, [transactions]);

  const grandTotal = sectionI.totalISR + sectionII.totalTax + sectionIII.totalITBIS;

  const handleCopyTotal = () => {
    navigator.clipboard.writeText(grandTotal.toFixed(2));
    toast.success("Total IR-17 copiado al portapapeles");
  };

  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();

    const ws1 = wb.addWorksheet("I - ISR Terceros");
    ws1.columns = [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Nombre/Razón Social", key: "name", width: 30 },
      { header: "RNC/Cédula", key: "rnc", width: 15 },
      { header: "Monto Transacción", key: "amount", width: 18 },
      { header: "ISR Retenido", key: "isr", width: 15 },
    ];
    sectionI.transactions.forEach((t) =>
      ws1.addRow({ date: t.transaction_date, name: t.name || t.description, rnc: t.rnc || "", amount: t.amount, isr: t.isr_retenido })
    );
    ws1.addRow({ date: "", name: "TOTAL", rnc: "", amount: 0, isr: sectionI.totalISR });

    const ws2 = wb.addWorksheet("II - Retrib. Complementarias");
    ws2.columns = [
      { header: "Cédula", key: "cedula", width: 15 },
      { header: "Nombre", key: "name", width: 30 },
      { header: "Monto Mensual", key: "amount", width: 18 },
      { header: "Impuesto 27%", key: "tax", width: 15 },
      { header: "Fuente", key: "source", width: 12 },
    ];
    sectionII.rows.forEach((r) =>
      ws2.addRow({ cedula: r.cedula, name: r.name, amount: r.monthlyAmount, tax: r.tax, source: r.source === "snapshot" ? "Nómina" : "Estimado" })
    );
    ws2.addRow({ cedula: "", name: "TOTAL", amount: 0, tax: sectionII.totalTax, source: "" });

    const ws3 = wb.addWorksheet("III - ITBIS Retenido");
    ws3.columns = [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Nombre/Razón Social", key: "name", width: 30 },
      { header: "Monto", key: "amount", width: 18 },
      { header: "ITBIS Retenido", key: "itbis", width: 15 },
    ];
    sectionIII.transactions.forEach((t) =>
      ws3.addRow({ date: t.transaction_date, name: t.name || t.description, amount: t.amount, itbis: t.itbis_retenido })
    );
    ws3.addRow({ date: "", name: "TOTAL", amount: 0, itbis: sectionIII.totalITBIS });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const fileName = `IR17_${selectedMonth}_${selectedYear}.xlsx`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker!({
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
        <CardTitle className="flex items-center gap-2">IR-17 — Otras Retenciones y Retribuciones Complementarias <InfoTooltip translationKey="help.ir17" /></CardTitle>
        <CardDescription>
          Resumen mensual de ISR retenido a terceros, retribuciones complementarias e ITBIS retenido para completar el formulario IR-17 de la DGII.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

          <Button variant="outline" size="sm" onClick={handleCopyTotal} disabled={grandTotal === 0}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Total
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={grandTotal === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        {/* Section I - ISR retenido a terceros */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Sección I — ISR Retenido a Terceros</h3>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre / Razón Social</TableHead>
                  <TableHead>RNC/Cédula</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">ISR Retenido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionI.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{t.transaction_date}</TableCell>
                    <TableCell>{t.name || t.description}</TableCell>
                    <TableCell className="font-mono text-xs">{t.rnc || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(t.amount)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(t.isr_retenido || 0)}</TableCell>
                  </TableRow>
                ))}
                {sectionI.transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Sin retenciones ISR a terceros en este período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {sectionI.transactions.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Subtotal ISR terceros</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(sectionI.totalISR)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        {/* Section II - Retribuciones complementarias */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Sección II — Retribuciones Complementarias (27%)</h3>
            {sectionII.hasAnySnapshot ? (
              <Badge variant="default" className="text-xs">Nómina cerrada</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Estimado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Fórmula: monto beneficio ÷ 0.73 × 0.27</p>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Monto Mensual</TableHead>
                  <TableHead className="text-right">Impuesto 27%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionII.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.cedula}</TableCell>
                    <TableCell>
                      {r.name}
                      {r.source === "estimate" && <span className="ml-1 text-xs text-muted-foreground" title="Estimado">~</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.monthlyAmount)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.tax)}</TableCell>
                  </TableRow>
                ))}
                {sectionII.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      Sin retribuciones complementarias
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {sectionII.rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Subtotal retribuciones complementarias</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(sectionII.totalTax)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        {/* Section III - ITBIS retenido */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Sección III — ITBIS Retenido</h3>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre / Razón Social</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">ITBIS Retenido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionIII.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{t.transaction_date}</TableCell>
                    <TableCell>{t.name || t.description}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(t.amount)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(t.itbis_retenido || 0)}</TableCell>
                  </TableRow>
                ))}
                {sectionIII.transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      Sin retenciones ITBIS en este período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {sectionIII.transactions.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Subtotal ITBIS retenido</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(sectionIII.totalITBIS)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        {/* Grand Total */}
        {grandTotal > 0 && (
          <div className="rounded-md border bg-muted/50 p-4 flex items-center justify-between">
            <span className="font-semibold text-lg">Total a pagar IR-17</span>
            <span className="font-mono font-bold text-xl">{fmt(grandTotal)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
