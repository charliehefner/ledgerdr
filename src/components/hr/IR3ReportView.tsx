import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Copy, RefreshCw, Loader2 } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { calculateMonthlyISR, calculateAnnualISR, fetchTssEmployeeRate, fetchIsrBrackets } from "@/lib/payrollCalculations";
import { useLanguage } from "@/contexts/LanguageContext";

interface PayrollPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Snapshot {
  period_id: string;
  employee_id: string;
  isr: number;
  base_pay: number;
  gross_pay: number;
}

export function IR3ReportView() {
  const now = new Date();
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const queryClient = useQueryClient();

  const months = Array.from({ length: 12 }, (_, i) => {
    const val = String(i + 1).padStart(2, "0");
    return { value: val, label: t(`month.${val}`) };
  });

  const { data: tssRate = 0.0591 } = useQuery({
    queryKey: ["tss-employee-rate"],
    queryFn: fetchTssEmployeeRate,
    staleTime: 1000 * 60 * 30,
  });
  const { data: isrBrackets } = useQuery({
    queryKey: ["isr-brackets", selectedYear],
    queryFn: () => fetchIsrBrackets(Number(selectedYear)),
    staleTime: 1000 * 60 * 30,
  });
  const brackets = isrBrackets ?? [
    { min: 0, max: 416220, rate: 0, baseTax: 0 },
    { min: 416220, max: 624329, rate: 0.15, baseTax: 0 },
    { min: 624329, max: 867123, rate: 0.20, baseTax: 31216 },
    { min: 867123, max: Infinity, rate: 0.25, baseTax: 79776 },
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  const monthInt = parseInt(selectedMonth);
  const yearInt = parseInt(selectedYear);
  const monthStart = `${selectedYear}-${selectedMonth}-01`;
  const lastDay = new Date(yearInt, monthInt, 0).getDate();
  const monthEnd = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

  const { data: periods = [] } = useQuery({
    queryKey: ["ir3-periods", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("id, start_date, end_date, status")
        .gte("start_date", monthStart)
        .lte("end_date", monthEnd)
        .order("start_date");
      if (error) throw error;
      return data as PayrollPeriod[];
    },
  });

  const periodIds = periods.map((p) => p.id);
  const closedPeriodIds = periods.filter((p) => p.status === "closed").map((p) => p.id);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["ir3-snapshots", closedPeriodIds],
    queryFn: async () => {
      if (closedPeriodIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("payroll_snapshots")
        .select("period_id, employee_id, isr, base_pay, gross_pay")
        .in("period_id", closedPeriodIds);
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
    enabled: closedPeriodIds.length > 0,
  });

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

  const q1Period = periods.find((p) => {
    const startDay = parseInt(p.start_date.split("-")[2]);
    return startDay <= 5;
  });
  const q2Period = periods.find((p) => {
    const startDay = parseInt(p.start_date.split("-")[2]);
    return startDay > 5;
  });

  const reportData = useMemo(() => {
    return employees.map((emp) => {
      let isrQ1 = 0;
      let q1Source: "snapshot" | "estimated" | "none" = "none";
      if (q1Period) {
        const snap = snapshots.find((s) => s.period_id === q1Period.id && s.employee_id === emp.id);
        if (snap && q1Period.status === "closed") {
          isrQ1 = snap.isr;
          q1Source = "snapshot";
        } else {
          const empBenefits = benefits.filter((b) => b.employee_id === emp.id);
          const monthlyBenefits = empBenefits.reduce((sum, b) => sum + b.amount, 0) * 2;
          isrQ1 = calculateMonthlyISR(emp.salary, tssRate, brackets, monthlyBenefits) / 2;
          q1Source = "estimated";
        }
      }

      let isrQ2 = 0;
      let q2Source: "snapshot" | "estimated" | "none" = "none";
      if (q2Period) {
        const snap = snapshots.find((s) => s.period_id === q2Period.id && s.employee_id === emp.id);
        if (snap && q2Period.status === "closed") {
          isrQ2 = snap.isr;
          q2Source = "snapshot";
        } else {
          const empBenefits = benefits.filter((b) => b.employee_id === emp.id);
          const monthlyBenefits = empBenefits.reduce((sum, b) => sum + b.amount, 0) * 2;
          isrQ2 = calculateMonthlyISR(emp.salary, tssRate, brackets, monthlyBenefits) / 2;
          q2Source = "estimated";
        }
      }

      const isrTotal = isrQ1 + isrQ2;
      return { id: emp.id, name: emp.name, cedula: emp.cedula, salary: emp.salary, isrQ1, isrQ2, isrTotal, q1Source, q2Source };
    }).filter((r) => r.isrTotal > 0);
  }, [employees, benefits, snapshots, q1Period, q2Period, periods, tssRate, brackets]);

  const totalISR = reportData.reduce((sum, r) => sum + r.isrTotal, 0);

  const backfill = useMutation({
    mutationFn: async () => {
      for (const period of periods.filter((p) => p.status === "closed")) {
        const existingSnaps = snapshots.filter((s) => s.period_id === period.id);
        if (existingSnaps.length > 0) continue;

        const rows = employees.map((emp) => {
          const empBenefits = benefits.filter((b) => b.employee_id === emp.id);
          const totalBenefitsPerPeriod = empBenefits.reduce((sum, b) => sum + b.amount, 0);
          const monthlyBenefits = totalBenefitsPerPeriod * 2;
          const biweeklySalary = emp.salary / 2;
          const monthlyTSS = emp.salary * tssRate;
          const monthlyTaxable = emp.salary - monthlyTSS + monthlyBenefits;
          const annualTaxable = monthlyTaxable * 12;
          const annualISR = calculateAnnualISR(annualTaxable, brackets);
          const isrAmount = annualISR / 24;
          const tss = biweeklySalary * tssRate;

          return {
            period_id: period.id,
            employee_id: emp.id,
            base_pay: biweeklySalary,
            overtime_pay: 0, holiday_pay: 0, sunday_pay: 0,
            total_benefits: totalBenefitsPerPeriod,
            tss, isr: isrAmount,
            loan_deduction: 0, absence_deduction: 0, vacation_deduction: 0,
            gross_pay: biweeklySalary + totalBenefitsPerPeriod,
            net_pay: biweeklySalary + totalBenefitsPerPeriod - tss - isrAmount,
          };
        });

        if (rows.length > 0) {
          const { error } = await (supabase as any)
            .from("payroll_snapshots")
            .upsert(rows, { onConflict: "period_id,employee_id" });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ir3-snapshots"] });
      toast.success(t("ir3.snapshotsGenerated"));
    },
    onError: (err) => {
      toast.error(t("ir3.snapshotError") + ": " + (err as Error).message);
    },
  });

  const hasClosedPeriodsWithoutSnapshots = periods
    .filter((p) => p.status === "closed")
    .some((p) => !snapshots.some((s) => s.period_id === p.id));

  const handleCopyTotal = () => {
    navigator.clipboard.writeText(fmt(totalISR));
    toast.success(t("ir3.totalCopied"));
  };

  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("IR-3");
    ws.columns = [
      { header: t("ir3.cedula"), key: "cedula", width: 15 },
      { header: t("common.name"), key: "name", width: 30 },
      { header: t("ir3.monthlySalary"), key: "salary", width: 18 },
      { header: `ISR Q1`, key: "isrQ1", width: 15 },
      { header: `ISR Q2`, key: "isrQ2", width: 15 },
      { header: t("ir3.isrMonth"), key: "isrTotal", width: 15 },
    ];
    reportData.forEach((r) => ws.addRow({ cedula: r.cedula, name: r.name, salary: r.salary, isrQ1: r.isrQ1, isrQ2: r.isrQ2, isrTotal: r.isrTotal }));
    ws.addRow({ cedula: "", name: "TOTAL", salary: 0, isrQ1: 0, isrQ2: 0, isrTotal: totalISR });

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
        toast.success(t("ir3.exportSuccess"));
        return;
      } catch { /* cancelled */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("ir3.exportSuccess"));
  };

  const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const q1Label = q1Period ? `${q1Period.start_date.slice(8)}-${q1Period.end_date.slice(8)}` : "Q1";
  const q2Label = q2Period ? `${q2Period.start_date.slice(8)}-${q2Period.end_date.slice(8)}` : "Q2";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{t("ir3.title")} <InfoTooltip translationKey="help.ir3" /></CardTitle>
        <CardDescription>{t("ir3.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">{t("ir3.month")}</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">{t("ir3.year")}</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handleCopyTotal} disabled={totalISR === 0}>
            <Copy className="h-4 w-4 mr-2" />
            {t("ir3.copyTotal")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={reportData.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {t("ir3.exportExcel")}
          </Button>

          {hasClosedPeriodsWithoutSnapshots && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => backfill.mutate()}
              disabled={backfill.isPending}
            >
              {backfill.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {t("ir3.generateSnapshots")}
            </Button>
          )}
        </div>

        {periods.length > 0 && (
          <div className="flex gap-2 flex-wrap text-xs">
            {periods.map((p) => (
              <Badge key={p.id} variant={p.status === "closed" ? "default" : "secondary"}>
                {p.start_date.slice(5)} → {p.end_date.slice(5)} ({p.status === "closed" ? t("ir3.closed") : t("ir3.open")})
              </Badge>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          {loadingEmps ? t("common.loading") : t("ir3.employeesWithISR").replace("{count}", String(reportData.length))}
        </div>

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ir3.cedula")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("ir3.monthlySalary")}</TableHead>
                <TableHead className="text-right">ISR {q1Label}</TableHead>
                <TableHead className="text-right">ISR {q2Label}</TableHead>
                <TableHead className="text-right">{t("ir3.isrMonth")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.cedula}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.salary)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {fmt(r.isrQ1)}
                    {r.q1Source === "estimated" && <span className="text-muted-foreground text-[10px] ml-1">~</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmt(r.isrQ2)}
                    {r.q2Source === "estimated" && <span className="text-muted-foreground text-[10px] ml-1">~</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmt(r.isrTotal)}</TableCell>
                </TableRow>
              ))}
              {reportData.length === 0 && !loadingEmps && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("ir3.noEmployees")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {reportData.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">{t("ir3.totalISR")}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg">{fmt(totalISR)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="text-muted-foreground">~</span> = {t("ir3.estimated")}
        </p>
      </CardContent>
    </Card>
  );
}
