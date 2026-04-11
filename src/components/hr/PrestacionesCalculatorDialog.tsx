import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Calculator, Printer, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type PrestacionesScenario = "desahucio" | "dimision";

interface SalarySegment {
  startDate: string;
  endDate: string;
  salary: number;
  days: number;
  months: number;
}

interface CalculationResult {
  employee: {
    id: string;
    name: string;
    date_of_hire: string;
    date_of_termination?: string | null;
  };
  scenario: PrestacionesScenario;
  termination_date: string;
  worked_notice: boolean;
  salary_basis: {
    average_monthly: number;
    daily_divisor: number;
    daily_salary: number;
  };
  service_time: {
    years: number;
    months: number;
    days: number;
    total_months: number;
    total_days: number;
  };
  line_items: {
    preaviso_days: number;
    preaviso_amount: number;
    cesantia_days: number;
    cesantia_amount: number;
    pending_vacation_days: number;
    vacation_amount: number;
    regalia_amount: number;
    loan_deductions: number;
    manual_adjustments: number;
    manual_deductions: number;
    total_amount: number;
  };
  salary_segments: Array<{
    start_date: string;
    end_date: string;
    salary: number;
    days: number;
    months: number;
  }>;
}

interface PrestacionesCalculatorDialogProps {
  employee: {
    id: string;
    name: string;
    position?: string | null;
    date_of_hire: string;
    date_of_termination?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salarySegments: SalarySegment[];
  canSave: boolean;
  userId?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(amount || 0);

export function PrestacionesCalculatorDialog({
  employee,
  open,
  onOpenChange,
  salarySegments,
  canSave,
  userId,
}: PrestacionesCalculatorDialogProps) {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const dateFnsLocale = language === "en" ? enUS : es;
  const [scenario, setScenario] = useState<PrestacionesScenario>("desahucio");
  const [terminationDate, setTerminationDate] = useState(employee.date_of_termination || format(new Date(), "yyyy-MM-dd"));
  const [workedNotice, setWorkedNotice] = useState(false);
  const [pendingVacationDays, setPendingVacationDays] = useState("");
  const [includeLoans, setIncludeLoans] = useState(true);
  const [manualAdjustments, setManualAdjustments] = useState("0");
  const [manualDeductions, setManualDeductions] = useState("0");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CalculationResult | null>(null);

  const averageSalaryPreview = useMemo(() => {
    if (salarySegments.length === 0) return 0;
    const weightedTotal = salarySegments.reduce((sum, segment) => sum + segment.salary * segment.days, 0);
    const totalDays = salarySegments.reduce((sum, segment) => sum + segment.days, 0);
    return totalDays > 0 ? weightedTotal / totalDays : 0;
  }, [salarySegments]);

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("calculate_prestaciones" as any, {
        p_employee_id: employee.id,
        p_termination_date: terminationDate,
        p_scenario: scenario,
        p_worked_notice: workedNotice,
        p_pending_vacation_days: pendingVacationDays === "" ? null : Number(pendingVacationDays),
        p_include_loans: includeLoans,
        p_manual_adjustments: Number(manualAdjustments || 0),
        p_manual_deductions: Number(manualDeductions || 0),
      });

      if (error) throw error;
      return data as unknown as CalculationResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t("prestaciones.calculated"));
    },
    onError: (error) => {
      console.error("Error calculating prestaciones:", error);
      toast.error(t("prestaciones.calcError"));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No calculation result");

      const payload = {
        employee_id: employee.id,
        scenario,
        case_status: "final",
        termination_date: terminationDate,
        worked_notice: workedNotice,
        pending_vacation_days:
          pendingVacationDays === "" ? result.line_items.pending_vacation_days : Number(pendingVacationDays),
        include_loans: includeLoans,
        manual_adjustments: Number(manualAdjustments || 0),
        manual_deductions: Number(manualDeductions || 0),
        notes: notes || null,
        salary_basis_monthly: result.salary_basis.average_monthly,
        salary_basis_daily: result.salary_basis.daily_salary,
        service_years: result.service_time.years,
        service_months: result.service_time.months,
        service_days: result.service_time.days,
        preaviso_amount: result.line_items.preaviso_amount,
        cesantia_amount: result.line_items.cesantia_amount,
        vacation_amount: result.line_items.vacation_amount,
        "regalía_amount": result.line_items.regalia_amount,
        loan_deductions: result.line_items.loan_deductions,
        total_amount: result.line_items.total_amount,
        calculation_payload: result,
        created_by: userId ?? null,
      };

      const { error } = await supabase.from("liquidation_cases" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("prestaciones.saved"));
      queryClient.invalidateQueries({ queryKey: ["employee-liquidation-cases", employee.id] });
    },
    onError: (error) => {
      console.error("Error saving liquidation case:", error);
      toast.error(t("prestaciones.saveError"));
    },
  });

  const handlePrint = () => {
    if (!result) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Resumen de Prestaciones Laborales", 14, 18);
    doc.setFontSize(10);
    doc.text(`Empleado: ${employee.name}`, 14, 28);
    doc.text(`Cargo: ${employee.position || "—"}`, 14, 34);
    doc.text(`Ingreso: ${format(new Date(`${employee.date_of_hire}T00:00:00`), "dd/MM/yyyy")}`, 14, 40);
    doc.text(`Salida efectiva: ${format(new Date(`${terminationDate}T00:00:00`), "dd/MM/yyyy")}`, 110, 40);
    doc.text(`Escenario: ${scenario === "desahucio" ? "Desahucio" : "Dimisión"}`, 110, 28);
    doc.text(
      `Antigüedad: ${result.service_time.years} años, ${result.service_time.months} meses, ${result.service_time.days} días`,
      14,
      46,
    );

    autoTable(doc, {
      startY: 54,
      head: [["Concepto", "Base / días", "Monto"]],
      body: [
        ["Salario promedio mensual", "", formatCurrency(result.salary_basis.average_monthly)],
        ["Salario diario", result.salary_basis.daily_divisor.toFixed(2), formatCurrency(result.salary_basis.daily_salary)],
        ["Preaviso", `${result.line_items.preaviso_days} días`, formatCurrency(result.line_items.preaviso_amount)],
        ["Cesantía", `${result.line_items.cesantia_days} días`, formatCurrency(result.line_items.cesantia_amount)],
        ["Vacaciones pendientes", `${result.line_items.pending_vacation_days} días`, formatCurrency(result.line_items.vacation_amount)],
        ["Regalía proporcional", "", formatCurrency(result.line_items.regalia_amount)],
        ["Ajustes manuales", "", formatCurrency(result.line_items.manual_adjustments)],
        ["Deducción préstamos", "", formatCurrency(-result.line_items.loan_deductions)],
        ["Otras deducciones", "", formatCurrency(-result.line_items.manual_deductions)],
        ["TOTAL", "", formatCurrency(result.line_items.total_amount)],
      ],
      theme: "grid",
      headStyles: { fillColor: [28, 116, 92] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Tramo salarial", "Hasta", "Salario", "Meses"]],
      body: result.salary_segments.map((segment) => [
        format(new Date(`${segment.start_date}T00:00:00`), "dd/MM/yyyy"),
        format(new Date(`${segment.end_date}T00:00:00`), "dd/MM/yyyy"),
        formatCurrency(segment.salary),
        Number(segment.months).toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: [28, 116, 92] },
    });

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prestaciones_${employee.name.replace(/\s+/g, "_")}_${terminationDate}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t("prestaciones.title").replace("{name}", employee.name)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("prestaciones.inputs")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("prestaciones.scenario")}</Label>
                  <Select value={scenario} onValueChange={(value: PrestacionesScenario) => setScenario(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desahucio">{t("prestaciones.desahucio")}</SelectItem>
                      <SelectItem value="dimision">{t("prestaciones.dimision")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("prestaciones.effectiveDate")}</Label>
                  <Input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t("prestaciones.pendingVacation")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pendingVacationDays}
                    onChange={(e) => setPendingVacationDays(e.target.value)}
                    placeholder="Auto"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("prestaciones.manualAdjustments")}</Label>
                  <Input type="number" step="0.01" value={manualAdjustments} onChange={(e) => setManualAdjustments(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t("prestaciones.otherDeductions")}</Label>
                  <Input type="number" step="0.01" value={manualDeductions} onChange={(e) => setManualDeductions(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  <Checkbox checked={workedNotice} onCheckedChange={(checked) => setWorkedNotice(checked === true)} />
                  {t("prestaciones.workedNotice")}
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  <Checkbox checked={includeLoans} onCheckedChange={(checked) => setIncludeLoans(checked === true)} />
                  {t("prestaciones.includeLoans")}
                </label>
              </div>

              <div className="space-y-2">
                <Label>{t("prestaciones.caseNotes")}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("prestaciones.notesPlaceholder")} />
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1">
                <p className="font-medium">{t("prestaciones.avgSalaryPreview")}</p>
                <p className="text-muted-foreground">{t("prestaciones.avgSalaryDesc")}</p>
                <p className="text-lg font-semibold">{formatCurrency(averageSalaryPreview)}</p>
              </div>

              <Button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending || !terminationDate}>
                <Calculator className="mr-2 h-4 w-4" />
                {calculateMutation.isPending ? t("prestaciones.calculating") : t("prestaciones.calculateBtn")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("prestaciones.breakdown")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {t("prestaciones.emptyState")}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{result.service_time.total_months.toFixed(2)} {t("prestaciones.months")}</Badge>
                    <Badge variant="secondary">{t("prestaciones.dailySalary")} {formatCurrency(result.salary_basis.daily_salary)}</Badge>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span>{t("prestaciones.preaviso")}</span><span className="font-medium">{formatCurrency(result.line_items.preaviso_amount)}</span></div>
                    <div className="flex items-center justify-between"><span>{t("prestaciones.cesantia")}</span><span className="font-medium">{formatCurrency(result.line_items.cesantia_amount)}</span></div>
                    <div className="flex items-center justify-between"><span>{t("prestaciones.pendingVacations")}</span><span className="font-medium">{formatCurrency(result.line_items.vacation_amount)}</span></div>
                    <div className="flex items-center justify-between"><span>{t("prestaciones.regalía")}</span><span className="font-medium">{formatCurrency(result.line_items.regalia_amount)}</span></div>
                    <div className="flex items-center justify-between"><span>{t("prestaciones.adjustments")}</span><span className="font-medium">{formatCurrency(result.line_items.manual_adjustments)}</span></div>
                    <div className="flex items-center justify-between"><span>{t("prestaciones.loansDed")}</span><span className="font-medium">-{formatCurrency(result.line_items.loan_deductions)}</span></div>
                    <div className="flex items-center justify-between"><span>{t("prestaciones.otherDed")}</span><span className="font-medium">-{formatCurrency(result.line_items.manual_deductions)}</span></div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>{t("prestaciones.totalEstimated")}</span>
                    <span>{formatCurrency(result.line_items.total_amount)}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canSave && (
                      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        <Save className="mr-2 h-4 w-4" />
                        {t("prestaciones.saveCase")}
                      </Button>
                    )}
                    <Button variant="outline" onClick={handlePrint}>
                      <Printer className="mr-2 h-4 w-4" />
                      {t("prestaciones.downloadPdf")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {salarySegments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("prestaciones.salarySegments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {salarySegments.map((segment, index) => (
                  <div key={`${segment.startDate}-${segment.endDate}-${index}`} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">
                        {format(new Date(`${segment.startDate}T00:00:00`), "d MMM yyyy", { locale: dateFnsLocale })} — {format(new Date(`${segment.endDate}T00:00:00`), "d MMM yyyy", { locale: dateFnsLocale })}
                      </p>
                      <p className="text-muted-foreground">{segment.days} días · {segment.months.toFixed(2)} meses</p>
                    </div>
                    <div className="font-semibold">{formatCurrency(segment.salary)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}