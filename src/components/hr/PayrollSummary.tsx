import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Lock, Loader2, FileText, FileSpreadsheet, Calendar, Eye, CheckCircle, AlertTriangle, X, RotateCcw } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createTransaction } from "@/lib/api";
import { generatePayrollReceiptsZip } from "@/lib/payrollReceipts";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { fmtDate } from "@/lib/dateUtils";

interface Employee {
  id: string;
  name: string;
  salary: number;
  position: string;
  bank: string | null;
  bank_account_number: string | null;
}

interface PayrollRpcRow {
  employee_id: string;
  employee_name: string;
  salary: number;
  base_pay: number;
  overtime_pay: number;
  holiday_pay: number;
  sunday_pay: number;
  total_benefits: number;
  gross_pay: number;
  tss: number;
  isr: number;
  loan_deduction: number;
  absence_deduction: number;
  vacation_deduction: number;
  total_deductions: number;
  net_pay: number;
  days_worked: number;
  days_absent: number;
  days_holiday: number;
  overtime_hours: number;
  committed: boolean;
}

interface PayrollSummaryProps {
  periodId: string;
  periodStatus: string;
  startDate: Date;
  endDate: Date;
  nominaNumber: number;
  onPeriodClosed: () => void;
}

export function PayrollSummary({
  periodId,
  periodStatus,
  startDate,
  endDate,
  nominaNumber,
  onPeriodClosed,
}: PayrollSummaryProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();
  const { applyEntityFilter } = useEntityFilter();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingReceipts, setIsGeneratingReceipts] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [hasPreviewedOnce, setHasPreviewedOnce] = useState(false);

  const isClosed = periodStatus === "closed";
  const isOpen = periodStatus === "open";
  const isAdmin = user?.role === "admin";
  // Commit / close / re-run preview — management chain only
  const canManagePayroll = user?.role === "admin" || user?.role === "management" || user?.role === "accountant";
  // Preview an OPEN period — management chain plus office
  const canPreviewPayroll = canManagePayroll || user?.role === "office";
  // Read-only export & receipt download (Excel / PDF / Recibos PDF). Office included.
  const canExportPayroll = canManagePayroll || user?.role === "office";

  // Fetch employees with bank info (needed for exports/receipts)
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-with-bank", selectedEntityId],
    queryFn: async () => {
      let query: any = supabase
        .from("employees_safe")
        .select("id, name, salary, position, bank, bank_account_number")
        .eq("is_active", true)
        .order("name");
      query = applyEntityFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Check if snapshots already exist for this period (status guard)
  const { data: existingSnapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ["payroll-snapshots-check", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_snapshots")
        .select("id")
        .eq("period_id", periodId)
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!periodId,
  });

  const hasCommittedSnapshots = existingSnapshots.length > 0;

  // Preview payroll via RPC (commit: false)
  const { data: previewData, isLoading: isPreviewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ["payroll-preview", periodId],
    queryFn: async () => {
      setRpcError(null);
      const { data, error } = await supabase.rpc(
        "calculate_payroll_for_period",
        { p_period_id: periodId, p_commit: false, p_entity_id: selectedEntityId || undefined }
      );
      if (error) {
        setRpcError(error.message);
        return [];
      }
      setHasPreviewedOnce(true);
      return (data as any[]) as PayrollRpcRow[];
    },
    enabled: false, // Manual trigger only
  });

  // Fetch snapshots for closed periods (immutable data)
  const { data: snapshots = [] } = useQuery({
    queryKey: ["payroll-snapshots", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_snapshots")
        .select("*")
        .eq("period_id", periodId);
      if (error) throw error;
      return data;
    },
    enabled: !!periodId && isClosed,
  });

  // Fetch active loans (for receipts)
  const { data: loans = [] } = useQuery({
    queryKey: ["employee-loans-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_loans")
        .select("id, employee_id, loan_amount, payment_amount, remaining_payments, number_of_payments, is_active")
        .eq("is_active", true)
        .gt("remaining_payments", 0);
      if (error) throw error;
      return data;
    },
  });

  // Fetch persisted loan-deduction snapshots for this period (stable parcela N de M on receipts).
  const { data: loanDeductionSnapshots = [] } = useQuery({
    queryKey: ["payroll-loan-deductions", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_loan_deductions")
        .select("employee_id, loan_id, payment_number, total_payments, loan_amount, payment_amount")
        .eq("period_id", periodId);
      if (error) throw error;
      return data as {
        employee_id: string;
        loan_id: string;
        payment_number: number;
        total_payments: number;
        loan_amount: number;
        payment_amount: number;
      }[];
    },
    enabled: !!periodId,
  });

  // Fetch employee benefits (for receipts)
  const { data: employeeBenefits = [] } = useQuery({
    queryKey: ["employee-benefits-for-receipts", selectedEntityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_benefits")
        .select("employee_id, benefit_type, amount");
      if (error) throw error;
      return data as { employee_id: string; benefit_type: string; amount: number }[];
    },
  });

  // Commit payroll mutation
  const commitPayroll = useMutation({
    mutationFn: async () => {
      setRpcError(null);
      const { data, error } = await supabase.rpc(
        "calculate_payroll_for_period",
        { p_period_id: periodId, p_commit: true, p_entity_id: selectedEntityId || undefined }
      );
      if (error) throw error;
      return (data as any[]) as PayrollRpcRow[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-preview", periodId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-snapshots", periodId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-snapshots-check", periodId] });
      queryClient.invalidateQueries({ queryKey: ["employee-loans-active"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-loan-deductions", periodId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-period"] });
      toast.success(t("payrollSummary.payrollSaved"));
    },
    onError: (error) => {
      setRpcError(error.message);
    },
  });

  // Build display data: from RPC preview for open, from snapshots for closed
  const payrollData: PayrollRpcRow[] = (() => {
    if (isClosed && snapshots.length > 0) {
      return snapshots.map((s) => ({
        employee_id: s.employee_id,
        employee_name: employees.find((e) => e.id === s.employee_id)?.name ?? "?",
        salary: employees.find((e) => e.id === s.employee_id)?.salary ?? 0,
        base_pay: Number(s.base_pay),
        overtime_pay: Number(s.overtime_pay),
        holiday_pay: Number(s.holiday_pay),
        sunday_pay: Number(s.sunday_pay),
        total_benefits: Number(s.total_benefits),
        gross_pay: Number(s.gross_pay),
        tss: Number(s.tss),
        isr: Number(s.isr),
        loan_deduction: Number(s.loan_deduction),
        absence_deduction: Number(s.absence_deduction),
        vacation_deduction: Number(s.vacation_deduction),
        total_deductions: Number(s.gross_pay) - Number(s.net_pay),
        net_pay: Number(s.net_pay),
        days_worked: 0,
        days_absent: 0,
        days_holiday: 0,
        overtime_hours: 0,
        committed: true,
      }));
    }
    return previewData ?? [];
  })();

  const totals = payrollData.reduce(
    (acc, p) => ({
      salary: acc.salary + p.salary,
      base_pay: acc.base_pay + p.base_pay,
      overtime_pay: acc.overtime_pay + p.overtime_pay,
      holiday_pay: acc.holiday_pay + p.holiday_pay,
      sunday_pay: acc.sunday_pay + p.sunday_pay,
      total_benefits: acc.total_benefits + p.total_benefits,
      gross_pay: acc.gross_pay + p.gross_pay,
      tss: acc.tss + p.tss,
      isr: acc.isr + p.isr,
      loan_deduction: acc.loan_deduction + p.loan_deduction,
      absence_deduction: acc.absence_deduction + p.absence_deduction,
      total_deductions: acc.total_deductions + p.total_deductions,
      net_pay: acc.net_pay + p.net_pay,
      days_worked: acc.days_worked + p.days_worked,
      days_absent: acc.days_absent + p.days_absent,
      days_holiday: acc.days_holiday + p.days_holiday,
      overtime_hours: acc.overtime_hours + p.overtime_hours,
    }),
    {
      salary: 0, base_pay: 0, overtime_pay: 0, holiday_pay: 0, sunday_pay: 0,
      total_benefits: 0, gross_pay: 0, tss: 0, isr: 0, loan_deduction: 0,
      absence_deduction: 0, total_deductions: 0, net_pay: 0,
      days_worked: 0, days_absent: 0, days_holiday: 0, overtime_hours: 0,
    }
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);

  const fmtVal = (v: number) => (v > 0 ? formatCurrency(v) : "-");
  const fmtNum = (v: number) => (v > 0 ? v.toString() : "-");
  const fmtDec = (v: number) => (v > 0 ? v.toFixed(1) : "-");

  // Build legacy-format data for receipts and exports
  const buildLegacyData = () => {
    return payrollData.map((p) => {
      const employee = employees.find((e) => e.id === p.employee_id);
      const employeeLoans = loans.filter((l) => l.employee_id === p.employee_id);
      const loanDetails = employeeLoans.map((l) => ({
        loan_amount: l.loan_amount,
        payment_amount: l.payment_amount,
        payment_number: isClosed
          ? l.number_of_payments - l.remaining_payments
          : l.number_of_payments - l.remaining_payments + 1,
        total_payments: l.number_of_payments,
      }));
      return {
        employee: employee ?? { id: p.employee_id, name: p.employee_name, salary: p.salary, position: "", bank: null, bank_account_number: null },
        regularHours: 0,
        overtimeHours: p.overtime_hours,
        holidayHours: 0,
        sundayHours: 0,
        vacationDays: 0,
        basePay: p.base_pay,
        overtimePay: p.overtime_pay,
        holidayPay: p.holiday_pay,
        sundayPay: p.sunday_pay,
        benefits: employeeBenefits
          .filter((b) => b.employee_id === p.employee_id)
          .map((b) => ({ benefit_type: b.benefit_type, amount: b.amount })),
        totalBenefits: p.total_benefits,
        tss: p.tss,
        isr: p.isr,
        absenceDeduction: p.absence_deduction,
        vacationDeduction: p.vacation_deduction,
        loanDeduction: p.loan_deduction,
        loanDetails,
        totalDeductions: p.total_deductions,
        grossPay: p.gross_pay,
        netPay: p.net_pay,
      };
    });
  };

  // Export monthly consolidated Excel
  const handleExportMonthly = async () => {
    setIsExporting(true);
    try {
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const monthStart = format(new Date(year, month, 1), "yyyy-MM-dd");
      const monthEnd = format(new Date(year, month + 1, 0), "yyyy-MM-dd");

      const { data: monthPeriods, error: periodError } = await supabase
        .from("payroll_periods")
        .select("id, start_date, end_date")
        .gte("start_date", monthStart)
        .lte("end_date", monthEnd)
        .eq("status", "closed");

      if (periodError) throw periodError;
      if (!monthPeriods || monthPeriods.length === 0) {
        toast.error("No hay períodos cerrados en este mes para exportar.");
        return;
      }

      const periodIds = monthPeriods.map((p) => p.id);
      const { data: allSnapshots, error: snapError } = await supabase
        .from("payroll_snapshots")
        .select("*")
        .in("period_id", periodIds);

      if (snapError) throw snapError;
      if (!allSnapshots || allSnapshots.length === 0) {
        toast.error("No hay datos de nómina para este mes.");
        return;
      }

      const employeeMap = new Map<string, any>();
      for (const s of allSnapshots) {
        const emp = employees.find((e) => e.id === s.employee_id);
        if (!emp) continue;
        const existing = employeeMap.get(s.employee_id);
        if (existing) {
          existing.basePay += Number(s.base_pay);
          existing.overtimePay += Number(s.overtime_pay);
          existing.holidayPay += Number(s.holiday_pay);
          existing.sundayPay += Number(s.sunday_pay);
          existing.totalBenefits += Number(s.total_benefits);
          existing.tss += Number(s.tss);
          existing.isr += Number(s.isr);
          existing.absenceDeduction += Number(s.absence_deduction);
          existing.vacationDeduction += Number(s.vacation_deduction);
          existing.loanDeduction += Number(s.loan_deduction);
          existing.grossPay += Number(s.gross_pay);
          existing.netPay += Number(s.net_pay);
        } else {
          employeeMap.set(s.employee_id, {
            name: emp.name,
            basePay: Number(s.base_pay),
            overtimePay: Number(s.overtime_pay),
            holidayPay: Number(s.holiday_pay),
            sundayPay: Number(s.sunday_pay),
            totalBenefits: Number(s.total_benefits),
            tss: Number(s.tss),
            isr: Number(s.isr),
            absenceDeduction: Number(s.absence_deduction),
            vacationDeduction: Number(s.vacation_deduction),
            loanDeduction: Number(s.loan_deduction),
            grossPay: Number(s.gross_pay),
            netPay: Number(s.net_pay),
          });
        }
      }

      const monthName = format(startDate, "MMMM yyyy", { locale: es });
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Nómina Mensual");
      sheet.columns = [
        { header: "Nombre", key: "name", width: 25 },
        { header: "Salario Base", key: "basePay", width: 15 },
        { header: "Pago Neto", key: "netPay", width: 15 },
        { header: "Beneficios", key: "benefits", width: 15 },
        { header: "Préstamo", key: "loan", width: 12 },
        { header: "Ausencias", key: "absence", width: 12 },
        { header: "TSS", key: "tss", width: 12 },
        { header: "ISR", key: "isr", width: 12 },
        { header: "Hrs Extra", key: "otPay", width: 15 },
        { header: "Pago Fer", key: "holPay", width: 15 },
        { header: "Pago Dom", key: "sunPay", width: 15 },
        { header: "Bruto", key: "grossPay", width: 15 },
      ];
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      const fmtExcel = (v: number) => (v > 0 ? v.toFixed(2) : "-");
      const grandTotals = { basePay: 0, netPay: 0, benefits: 0, loan: 0, absence: 0, tss: 0, isr: 0, otPay: 0, holPay: 0, sunPay: 0, grossPay: 0 };
      const sortedEmployees = Array.from(employeeMap.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
      sortedEmployees.forEach((emp: any) => {
        sheet.addRow({ name: emp.name, basePay: emp.basePay.toFixed(2), netPay: emp.netPay.toFixed(2), benefits: fmtExcel(emp.totalBenefits), loan: fmtExcel(emp.loanDeduction), absence: fmtExcel(emp.absenceDeduction), tss: fmtExcel(emp.tss), isr: fmtExcel(emp.isr), otPay: fmtExcel(emp.overtimePay), holPay: fmtExcel(emp.holidayPay), sunPay: fmtExcel(emp.sundayPay), grossPay: emp.grossPay.toFixed(2) });
        grandTotals.basePay += emp.basePay; grandTotals.netPay += emp.netPay; grandTotals.benefits += emp.totalBenefits; grandTotals.loan += emp.loanDeduction; grandTotals.absence += emp.absenceDeduction; grandTotals.tss += emp.tss; grandTotals.isr += emp.isr; grandTotals.otPay += emp.overtimePay; grandTotals.holPay += emp.holidayPay; grandTotals.sunPay += emp.sundayPay; grandTotals.grossPay += emp.grossPay;
      });
      const totRow = sheet.addRow({ name: "TOTALES", basePay: grandTotals.basePay.toFixed(2), netPay: grandTotals.netPay.toFixed(2), benefits: fmtExcel(grandTotals.benefits), loan: fmtExcel(grandTotals.loan), absence: fmtExcel(grandTotals.absence), tss: fmtExcel(grandTotals.tss), isr: fmtExcel(grandTotals.isr), otPay: fmtExcel(grandTotals.otPay), holPay: fmtExcel(grandTotals.holPay), sunPay: fmtExcel(grandTotals.sunPay), grossPay: grandTotals.grossPay.toFixed(2) });
      totRow.font = { bold: true };
      totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nomina_Mensual_${format(startDate, "yyyy-MM")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Nómina mensual exportada (${monthPeriods.length} período${monthPeriods.length > 1 ? "s" : ""} - ${monthName})`);
    } catch (error: any) {
      toast.error("Error al exportar nómina mensual");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`Nómina ${nominaNumber}`);
      sheet.columns = [
        { header: "Nombre", key: "name", width: 25 },
        { header: "Salario", key: "salary", width: 15 },
        { header: "Salario Base", key: "basePay", width: 15 },
        { header: "Hrs Extra", key: "otPay", width: 12 },
        { header: "Pago Fer", key: "holPay", width: 12 },
        { header: "Pago Dom", key: "sunPay", width: 12 },
        { header: "Beneficios", key: "benefits", width: 12 },
        { header: "Bruto", key: "grossPay", width: 15 },
        { header: "TSS", key: "tss", width: 12 },
        { header: "ISR", key: "isr", width: 12 },
        { header: "Préstamo", key: "loan", width: 12 },
        { header: "Ausencias", key: "absence", width: 12 },
        { header: "Deducciones", key: "deductions", width: 15 },
        { header: "Pago Neto", key: "netPay", width: 15 },
      ];
      const hRow = sheet.getRow(1);
      hRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      const fmtE = (v: number) => (v > 0 ? v.toFixed(2) : "-");
      payrollData.forEach((p) => {
        sheet.addRow({ name: p.employee_name, salary: p.salary.toFixed(2), basePay: p.base_pay.toFixed(2), otPay: fmtE(p.overtime_pay), holPay: fmtE(p.holiday_pay), sunPay: fmtE(p.sunday_pay), benefits: fmtE(p.total_benefits), grossPay: p.gross_pay.toFixed(2), tss: fmtE(p.tss), isr: fmtE(p.isr), loan: fmtE(p.loan_deduction), absence: fmtE(p.absence_deduction), deductions: p.total_deductions.toFixed(2), netPay: p.net_pay.toFixed(2) });
      });
      const tRow = sheet.addRow({ name: "TOTALES", salary: totals.salary.toFixed(2), basePay: totals.base_pay.toFixed(2), otPay: fmtE(totals.overtime_pay), holPay: fmtE(totals.holiday_pay), sunPay: fmtE(totals.sunday_pay), benefits: fmtE(totals.total_benefits), grossPay: totals.gross_pay.toFixed(2), tss: fmtE(totals.tss), isr: fmtE(totals.isr), loan: fmtE(totals.loan_deduction), absence: fmtE(totals.absence_deduction), deductions: totals.total_deductions.toFixed(2), netPay: totals.net_pay.toFixed(2) });
      tRow.font = { bold: true };
      tRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nomina_${nominaNumber}_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("payrollSummary.payrollExported"));
    } catch (error) {
      toast.error(t("payrollSummary.payrollExportError"));
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text(`Reporte de Nómina ${nominaNumber}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Período: ${fmtDate(startDate)} - ${fmtDate(endDate)}`, 14, 22);
      const headers = ["Nombre", "Salario", "Base", "Extras", "Feriado", "Domingo", "Benef.", "Bruto", "TSS", "ISR", "Prést.", "Ausencias", "Deduc.", "Neto"];
      const rows = payrollData.map((p) => [
        p.employee_name, formatCurrency(p.salary), formatCurrency(p.base_pay),
        fmtVal(p.overtime_pay), fmtVal(p.holiday_pay), fmtVal(p.sunday_pay),
        fmtVal(p.total_benefits), formatCurrency(p.gross_pay),
        fmtVal(p.tss), fmtVal(p.isr), fmtVal(p.loan_deduction),
        fmtVal(p.absence_deduction), formatCurrency(p.total_deductions), formatCurrency(p.net_pay),
      ]);
      rows.push([
        "TOTALES", formatCurrency(totals.salary), formatCurrency(totals.base_pay),
        fmtVal(totals.overtime_pay), fmtVal(totals.holiday_pay), fmtVal(totals.sunday_pay),
        fmtVal(totals.total_benefits), formatCurrency(totals.gross_pay),
        fmtVal(totals.tss), fmtVal(totals.isr), fmtVal(totals.loan_deduction),
        fmtVal(totals.absence_deduction), formatCurrency(totals.total_deductions), formatCurrency(totals.net_pay),
      ]);
      autoTable(doc, {
        head: [headers], body: rows, startY: 28,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 111, 92], textColor: 255, fontStyle: "bold" },
        didParseCell: (data) => { if (data.row.index === rows.length - 1) { data.cell.styles.fillColor = [226, 239, 218]; data.cell.styles.fontStyle = "bold"; } },
      });
      doc.save(`Nomina_${nominaNumber}_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.pdf`);
      toast.success(t("payrollSummary.pdfExported"));
    } catch (error) {
      toast.error(t("payrollSummary.pdfExportError"));
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Generate PDF receipts
  const handleGenerateReceipts = async () => {
    setIsGeneratingReceipts(true);
    try {
      const legacyData = buildLegacyData();
      await generatePayrollReceiptsZip(legacyData, nominaNumber, startDate, endDate);
      toast.success(t("payrollSummary.receiptsGenerated"));
    } catch (error) {
      toast.error(t("payrollSummary.receiptsError"));
      console.error(error);
    } finally {
      setIsGeneratingReceipts(false);
    }
  };

  // Close period mutation (creates transactions, journals, receipts)
  const closePeriod = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId) {
        throw new Error("Seleccione una entidad específica para cerrar el período");
      }

      // 0. Read committed snapshots from DB as source of truth
      const { data: freshSnapshots, error: snapErr } = await supabase
        .from("payroll_snapshots")
        .select("*")
        .eq("period_id", periodId);
      if (snapErr) throw snapErr;
      if (!freshSnapshots || freshSnapshots.length === 0) {
        throw new Error("Debe confirmar la nómina antes de cerrar el período. Haga clic en 'Confirmar y Guardar' primero.");
      }

      // Build legacy data from DB snapshots (authoritative), not stale preview
      const snapshotLegacyData = freshSnapshots.map((s) => {
        const employee = employees.find((e) => e.id === s.employee_id);
        const employeeLoans = loans.filter((l) => l.employee_id === s.employee_id);
        const loanDetails = employeeLoans.map((l) => ({
          loan_amount: l.loan_amount,
          payment_amount: l.payment_amount,
          payment_number: l.number_of_payments - l.remaining_payments,
          total_payments: l.number_of_payments,
        }));
        const grossPay = Number(s.gross_pay);
        const netPay = Number(s.net_pay);
        return {
          employee: employee ?? { id: s.employee_id, name: "?", salary: 0, position: "", bank: null, bank_account_number: null },
          regularHours: 0,
          overtimeHours: 0,
          holidayHours: 0,
          sundayHours: 0,
          vacationDays: 0,
          basePay: Number(s.base_pay),
          overtimePay: Number(s.overtime_pay),
          holidayPay: Number(s.holiday_pay),
          sundayPay: Number(s.sunday_pay),
          benefits: employeeBenefits
            .filter((b) => b.employee_id === s.employee_id)
            .map((b) => ({ benefit_type: b.benefit_type, amount: b.amount })),
          totalBenefits: Number(s.total_benefits),
          tss: Number(s.tss),
          isr: Number(s.isr),
          absenceDeduction: Number(s.absence_deduction),
          vacationDeduction: Number(s.vacation_deduction),
          loanDeduction: Number(s.loan_deduction),
          loanDetails,
          totalDeductions: grossPay - netPay,
          grossPay,
          netPay,
        };
      });

      const dateStr = format(endDate, "yyyy-MM-dd");
      const legacyData = snapshotLegacyData;

      // 1. Create transactions for each employee's net pay
      for (const p of legacyData) {
        await createTransaction({
          transaction_date: dateStr,
          master_acct_code: "7010",
          description: `Nomina ${nominaNumber}`,
          currency: "DOP",
          amount: p.netPay,
          pay_method: "Transfer BHD",
          document: "Recibo",
          name: p.employee.name,
          is_internal: true,
          comments: `Período: ${fmtDate(startDate)} - ${fmtDate(endDate)} | Deducciones: ${p.totalDeductions.toFixed(2)}`,
        }, selectedEntityId);
      }

      // 2. Update period status to 'closed'
      const { error } = await supabase
        .from("payroll_periods")
        .update({ status: "closed" })
        .eq("id", periodId);
      if (error) throw error;

      // 3. Generate PRJ journal entry
      try {
        const totalGrossPay = legacyData.reduce((s, p) => s + p.grossPay, 0);
        const totalTss = legacyData.reduce((s, p) => s + p.tss, 0);
        const totalIsr = legacyData.reduce((s, p) => s + p.isr, 0);
        const totalNetPay = legacyData.reduce((s, p) => s + p.netPay, 0);
        const totalLoanDeduction = legacyData.reduce((s, p) => s + p.loanDeduction, 0);
        const TSS_EMPLOYER_RATE = 0.1572;
        const employerTss = Math.round(totalGrossPay * TSS_EMPLOYER_RATE * 100) / 100;

        const acctCodes = ["7010", "6210", "2180", "2170", "1130"];
        const { data: glAccts } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code")
          .in("account_code", acctCodes)
          .eq("allow_posting", true)
          .is("deleted_at", null);

        const acctMap = new Map((glAccts || []).map((a) => [a.account_code, a.id]));
        const salaryAcct = acctMap.get("7010");
        const employerTssAcct = acctMap.get("6210");
        const tssLiabilityAcct = acctMap.get("2180");
        const isrLiabilityAcct = acctMap.get("2170");
        const loansReceivableAcct = acctMap.get("1130");

        if (salaryAcct && tssLiabilityAcct) {
          const { data: journalId, error: jErr } = await supabase.rpc(
            "create_journal_from_transaction" as any,
            { p_transaction_id: null, p_date: dateStr, p_description: `Nómina ${nominaNumber} — ${format(startDate, "dd/MM")} al ${fmtDate(endDate)}`, p_created_by: null, p_journal_type: "PRJ" }
          );

          if (!jErr && journalId) {
            const journalLines: any[] = [];
            if (totalGrossPay > 0) journalLines.push({ journal_id: journalId, account_id: salaryAcct, debit: Math.round(totalGrossPay * 100) / 100, credit: 0, description: `Salarios Nómina ${nominaNumber}` });
            if (employerTss > 0 && employerTssAcct) journalLines.push({ journal_id: journalId, account_id: employerTssAcct, debit: employerTss, credit: 0, description: `TSS Patronal Nómina ${nominaNumber}` });
            const totalTssLiability = Math.round((totalTss + employerTss) * 100) / 100;
            if (totalTssLiability > 0) journalLines.push({ journal_id: journalId, account_id: tssLiabilityAcct, debit: 0, credit: totalTssLiability, description: `TSS por Pagar Nómina ${nominaNumber}` });
            if (totalIsr > 0 && isrLiabilityAcct) journalLines.push({ journal_id: journalId, account_id: isrLiabilityAcct, debit: 0, credit: Math.round(totalIsr * 100) / 100, description: `ISR Retenido Nómina ${nominaNumber}` });
            if (totalLoanDeduction > 0 && loansReceivableAcct) journalLines.push({ journal_id: journalId, account_id: loansReceivableAcct, debit: 0, credit: Math.round(totalLoanDeduction * 100) / 100, description: `Descuento Préstamos Nómina ${nominaNumber}` });

            const { data: defaultBank } = await supabase
              .from("bank_accounts")
              .select("chart_account_id")
              .eq("is_active", true)
              .eq("account_type", "bank")
              .limit(1)
              .maybeSingle();

            if (defaultBank?.chart_account_id && totalNetPay > 0) journalLines.push({ journal_id: journalId, account_id: defaultBank.chart_account_id, debit: 0, credit: Math.round(totalNetPay * 100) / 100, description: `Pago Neto Nómina ${nominaNumber}` });

            if (journalLines.length > 0) {
              const { error: lErr } = await supabase.from("journal_lines").insert(journalLines);
              if (lErr) {
                console.error("PRJ journal lines error:", lErr);
                await supabase.from("journals").delete().eq("id", journalId);
              }
            }
          }
        }
      } catch (prjErr) {
        console.error("PRJ journal generation error:", prjErr);
      }

      // 4. Generate receipts automatically
      await generatePayrollReceiptsZip(legacyData, nominaNumber, startDate, endDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-period"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-snapshots", periodId] });
      toast.success(t("payrollSummary.periodClosed"));
      onPeriodClosed();
    },
    onError: (error) => {
      toast.error(t("payrollSummary.periodCloseError") + error.message);
    },
  });

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {rpcError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{rpcError}</span>
            <Button variant="ghost" size="sm" onClick={() => setRpcError(null)} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">{t("payrollSummary.title")}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preview button — only when no committed snapshots, or admin re-run */}
          {canPreviewPayroll && isOpen && !hasCommittedSnapshots && (
            <Button
              variant="outline"
              onClick={() => refetchPreview()}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {t("payrollSummary.preview")}
            </Button>
          )}

          {/* Re-run button for admin when snapshots already exist */}
          {isAdmin && isOpen && hasCommittedSnapshots && (
            <Button
              variant="outline"
              onClick={() => refetchPreview()}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              {t("payrollSummary.reRunPreview")}
            </Button>
          )}

          {/* Commit button — only after preview, and when no committed snapshots (unless admin re-run) */}
          {canManagePayroll && isOpen && hasPreviewedOnce && (
            <Button
              variant="default"
              onClick={() => setShowCommitConfirm(true)}
              disabled={payrollData.length === 0 || commitPayroll.isPending}
            >
              {commitPayroll.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {t("payrollSummary.confirmAndSave")}
            </Button>
          )}

          {canExportPayroll && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting || payrollData.length === 0}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {t("payrollSummary.export")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover">
                <DropdownMenuItem onClick={handleExport}><FileSpreadsheet className="mr-2 h-4 w-4" />{t("payrollSummary.exportExcel")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}><FileText className="mr-2 h-4 w-4" />{t("payrollSummary.exportPdf")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMonthly}><Calendar className="mr-2 h-4 w-4" />{t("payrollSummary.exportMonthly")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canExportPayroll && (
            <Button variant="outline" onClick={handleGenerateReceipts} disabled={isGeneratingReceipts || payrollData.length === 0}>
              {isGeneratingReceipts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {t("payrollSummary.receiptsPdf")}
            </Button>
          )}

          {!isClosed && canManagePayroll && (
            <Button onClick={() => setShowCloseConfirm(true)} disabled={payrollData.length === 0 || !hasCommittedSnapshots}>
              <Lock className="h-4 w-4 mr-2" />
              {t("payrollSummary.closePeriod")}
            </Button>
          )}
        </div>
      </div>

      {/* Status guard: committed snapshots notice */}
      {hasCommittedSnapshots && isOpen && !hasPreviewedOnce && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Esta nómina ya fue comprometida. Los datos mostrados son de solo lectura.
            {isAdmin && " Como administrador, puede re-ejecutar la vista previa si necesita recalcular."}
          </AlertDescription>
        </Alert>
      )}

      {/* Preview note */}
      {hasPreviewedOnce && !hasCommittedSnapshots && isOpen && payrollData.length > 0 && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Vista previa — ningún dato ha sido guardado aún.
          </AlertDescription>
        </Alert>
      )}

      {isPreviewLoading || snapshotsLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Calculando nómina...
        </div>
      ) : payrollData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {isClosed
            ? (snapshotsLoading
                ? "Cargando datos de nómina cerrada..."
                : "Este período está cerrado pero no tiene datos de nómina guardados.")
            : hasCommittedSnapshots
              ? "Cargando datos de nómina comprometida..."
              : "No hay datos de nómina. Haga clic en \"Vista Previa Nómina\" para calcular."}
        </div>
      ) : (
        <div className="overflow-auto border rounded-lg max-h-[70vh] relative">
          <table className="w-full caption-bottom text-sm table-auto">
             <TableHeader className="sticky top-0 z-20 bg-background">
              <TableRow>
                <TableHead className="whitespace-nowrap sticky left-0 z-30 bg-background">Empleado</TableHead>
                <TableHead className="text-right whitespace-nowrap">Salario</TableHead>
                <TableHead className="text-right whitespace-nowrap">Salario Base</TableHead>
                <TableHead className="text-right whitespace-nowrap">Horas Extra</TableHead>
                <TableHead className="text-right whitespace-nowrap">Pago Feriado</TableHead>
                <TableHead className="text-right whitespace-nowrap">Pago Domingo</TableHead>
                <TableHead className="text-right whitespace-nowrap">Beneficios</TableHead>
                <TableHead className="text-right whitespace-nowrap font-bold">Bruto</TableHead>
                <TableHead className="text-right whitespace-nowrap text-destructive">TSS Emp.</TableHead>
                <TableHead className="text-right whitespace-nowrap text-destructive">ISR</TableHead>
                <TableHead className="text-right whitespace-nowrap text-destructive">Préstamo</TableHead>
                <TableHead className="text-right whitespace-nowrap text-destructive">Ausencias</TableHead>
                <TableHead className="text-right whitespace-nowrap text-destructive">Total Ded.</TableHead>
                <TableHead className="text-right whitespace-nowrap font-bold text-primary">Pago Neto</TableHead>
                <TableHead className="text-right whitespace-nowrap">Días Trab.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Días Aus.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Días Fer.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Hrs Extra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.map((p) => (
                <TableRow key={p.employee_id}>
                  <TableCell className="font-medium sticky left-0 z-10 bg-background whitespace-nowrap">{p.employee_name}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(p.salary)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(p.base_pay)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtVal(p.overtime_pay)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtVal(p.holiday_pay)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtVal(p.sunday_pay)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtVal(p.total_benefits)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(p.gross_pay)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmtVal(p.tss)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmtVal(p.isr)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmtVal(p.loan_deduction)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmtVal(p.absence_deduction)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(p.total_deductions)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{formatCurrency(p.net_pay)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(p.days_worked)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(p.days_absent)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(p.days_holiday)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtDec(p.overtime_hours)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="sticky left-0 z-10 bg-muted/50">TOTALES</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totals.salary)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totals.base_pay)}</TableCell>
                <TableCell className="text-right font-mono">{fmtVal(totals.overtime_pay)}</TableCell>
                <TableCell className="text-right font-mono">{fmtVal(totals.holiday_pay)}</TableCell>
                <TableCell className="text-right font-mono">{fmtVal(totals.sunday_pay)}</TableCell>
                <TableCell className="text-right font-mono">{fmtVal(totals.total_benefits)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatCurrency(totals.gross_pay)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">{fmtVal(totals.tss)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">{fmtVal(totals.isr)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">{fmtVal(totals.loan_deduction)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">{fmtVal(totals.absence_deduction)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">{formatCurrency(totals.total_deductions)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">{formatCurrency(totals.net_pay)}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(totals.days_worked)}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(totals.days_absent)}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(totals.days_holiday)}</TableCell>
                <TableCell className="text-right font-mono">{fmtDec(totals.overtime_hours)}</TableCell>
              </TableRow>
            </TableFooter>
          </table>
        </div>
      )}

      {/* Commit Payroll Confirmation */}
      <AlertDialog open={showCommitConfirm} onOpenChange={setShowCommitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar esta nómina?</AlertDialogTitle>
            <AlertDialogDescription>
              Se guardarán {payrollData.length} registros en payroll_snapshots.
              Esta acción no se puede deshacer.
              <p className="mt-2 font-medium">Empleados a procesar: {payrollData.length}</p>
              <p>Pago neto total: {formatCurrency(totals.net_pay)}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => commitPayroll.mutate()}
              disabled={commitPayroll.isPending}
            >
              {commitPayroll.isPending ? "Procesando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Period Confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar Período de Nómina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto hará lo siguiente:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Bloquear todas las entradas de hoja de tiempo para este período</li>
                <li>Crear {payrollData.length} transacciones de nómina en el libro mayor</li>
                <li>Pago total: {formatCurrency(totals.net_pay)}</li>
              </ul>
              <p className="mt-3 font-medium">Esta acción no se puede deshacer.</p>
              <p className="mt-2 text-sm">Los recibos PDF se descargarán automáticamente.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closePeriod.mutate()}
              disabled={closePeriod.isPending}
            >
              {closePeriod.isPending ? "Cerrando..." : "Cerrar Período"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
