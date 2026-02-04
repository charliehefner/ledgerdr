import { useState } from "react";
import { format, eachDayOfInterval, isWithinInterval, parseISO, isSunday } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Lock, Loader2, FileText } from "lucide-react";
import ExcelJS from "exceljs";
import { createTransaction } from "@/lib/api";
import { generatePayrollReceiptsZip } from "@/lib/payrollReceipts";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Employee {
  id: string;
  name: string;
  salary: number;
  position: string;
  bank: string | null;
  bank_account_number: string | null;
}

interface TimesheetEntry {
  employee_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  is_absent: boolean;
  is_holiday: boolean;
}

interface EmployeeBenefit {
  employee_id: string;
  benefit_type: string;
  amount: number;
}

interface EmployeeVacation {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
}

interface EmployeeLoan {
  id: string;
  employee_id: string;
  loan_amount: number;
  payment_amount: number;
  remaining_payments: number;
  is_active: boolean;
}

interface PayrollSummaryProps {
  periodId: string;
  periodStatus: string;
  startDate: Date;
  endDate: Date;
  nominaNumber: number;
  onPeriodClosed: () => void;
}

const BENEFIT_TYPES = ["Teléfono", "Gasolina", "Bono"];
const STANDARD_START = 7 * 60 + 30;
const STANDARD_END = 16 * 60 + 30;
const STANDARD_HOURS_PER_DAY = 8;
const TSS_EMPLOYEE_RATE = 0.0591; // 3.04% AFP + 2.87% SFS
const OVERTIME_MULTIPLIER = 1.35;
const HOLIDAY_MULTIPLIER = 2.0; // 100% bonus = 2x pay

// ISR Progressive Tax Brackets (Annual Income - DOP)
// Source: DGII / PWC Tax Summaries
const ISR_BRACKETS = [
  { min: 0, max: 416220, rate: 0, baseTax: 0 },
  { min: 416220, max: 624329, rate: 0.15, baseTax: 0 },
  { min: 624329, max: 867123, rate: 0.20, baseTax: 31216 },
  { min: 867123, max: Infinity, rate: 0.25, baseTax: 79776 },
];

/**
 * Calculate annual ISR using Dominican Republic progressive tax brackets
 */
function calculateAnnualISR(annualIncome: number): number {
  if (annualIncome <= ISR_BRACKETS[0].max) return 0;
  
  for (let i = ISR_BRACKETS.length - 1; i >= 0; i--) {
    const bracket = ISR_BRACKETS[i];
    if (annualIncome > bracket.min) {
      return bracket.baseTax + (annualIncome - bracket.min) * bracket.rate;
    }
  }
  return 0;
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingReceipts, setIsGeneratingReceipts] = useState(false);

  // Fetch employees with bank info
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-with-bank"],
    queryFn: async () => {
      // Use employees_safe view to mask bank account numbers for non-admin users
      const { data, error } = await supabase
        .from("employees_safe")
        .select("id, name, salary, position, bank, bank_account_number")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch timesheets
  const { data: timesheets = [] } = useQuery({
    queryKey: ["timesheets", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_timesheets")
        .select("employee_id, work_date, start_time, end_time, is_absent, is_holiday")
        .eq("period_id", periodId);
      if (error) throw error;
      return data as TimesheetEntry[];
    },
    enabled: !!periodId,
  });

  // Fetch employee vacations that overlap with this period
  const { data: vacations = [] } = useQuery({
    queryKey: ["employee-vacations-summary", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("id, employee_id, start_date, end_date")
        .lte("start_date", format(endDate, "yyyy-MM-dd"))
        .gte("end_date", format(startDate, "yyyy-MM-dd"));
      if (error) throw error;
      return data as EmployeeVacation[];
    },
  });

  // Fetch benefits
  const { data: benefits = [] } = useQuery({
    queryKey: ["employee-benefits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_benefits")
        .select("employee_id, benefit_type, amount");
      if (error) throw error;
      return data as EmployeeBenefit[];
    },
  });

  // Fetch active loans
  const { data: loans = [] } = useQuery({
    queryKey: ["employee-loans-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_loans")
        .select("id, employee_id, loan_amount, payment_amount, remaining_payments, is_active")
        .eq("is_active", true)
        .gt("remaining_payments", 0);
      if (error) throw error;
      return data as EmployeeLoan[];
    },
  });

  // Check if employee is on vacation for a specific date
  const isEmployeeOnVacation = (employeeId: string, date: Date): boolean => {
    return vacations.some((v) => {
      const vacStart = parseDateLocal(v.start_date);
      const vacEnd = parseDateLocal(v.end_date);
      return (
        v.employee_id === employeeId &&
        isWithinInterval(date, { start: vacStart, end: vacEnd })
      );
    });
  };

  // Count vacation days for an employee in this period (Saturday is a workday in DR)
  const getVacationDays = (employeeId: string): number => {
    const periodDays = eachDayOfInterval({ start: startDate, end: endDate });
    return periodDays.filter((day) => !isSunday(day) && isEmployeeOnVacation(employeeId, day)).length;
  };

  // Count total working days in this period (excluding Sundays only)
  const getTotalWorkingDays = (): number => {
    const periodDays = eachDayOfInterval({ start: startDate, end: endDate });
    return periodDays.filter((day) => !isSunday(day)).length;
  };

  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const calculateEmployeePayroll = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return null;

    const entries = timesheets.filter((t) => t.employee_id === employeeId);
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;

    entries.forEach((t) => {
      // Skip vacation days - they are paid separately
      if (t.work_date) {
        const workDate = parseDateLocal(t.work_date);
        if (isEmployeeOnVacation(employeeId, workDate)) {
          return; // Skip this entry
        }
      }

      if (t.start_time && t.end_time) {
        const start = parseTimeToMinutes(t.start_time);
        const end = parseTimeToMinutes(t.end_time);

        // Total hours worked this day (capped at standard)
        const totalDayHours = Math.min((end - start) / 60, STANDARD_HOURS_PER_DAY);
        
        // If this is a holiday, track those hours for bonus pay
        if (t.is_holiday) {
          holidayHours += totalDayHours;
        }

        const regularStart = Math.max(start, STANDARD_START);
        const regularEnd = Math.min(end, STANDARD_END);

        if (regularEnd > regularStart) {
          const rawRegular = (regularEnd - regularStart) / 60;
          regularHours += Math.min(rawRegular, STANDARD_HOURS_PER_DAY);
        }

        if (start < STANDARD_START) {
          overtimeHours += (STANDARD_START - start) / 60;
        }
        if (end > STANDARD_END) {
          overtimeHours += (end - STANDARD_END) / 60;
        }
      }
    });

    // Count absences (excluding vacation days AND holiday days)
    const absenceDays = entries.filter((e) => {
      // Holiday days with no times are NOT absences - employee gets the day off
      if (e.is_holiday) {
        return false;
      }
      if (e.work_date) {
        const workDate = parseDateLocal(e.work_date);
        if (isEmployeeOnVacation(employeeId, workDate)) {
          return false; // Vacation days are not absences
        }
      }
      return e.is_absent;
    }).length;

    const vacationDays = getVacationDays(employeeId);
    const biweeklySalary = employee.salary / 2;
    const dailyRate = employee.salary / 23.83;
    const hourlyRate = dailyRate / 8;

    // Earnings
    const basePay = biweeklySalary;
    const overtimePay = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;
    // Holiday bonus: 100% extra on top of regular pay for hours worked on holidays
    const holidayPay = holidayHours * hourlyRate * (HOLIDAY_MULTIPLIER - 1); // -1 because base is already in basePay

    // Benefits
    const employeeBenefits = benefits.filter((b) => b.employee_id === employeeId);
    const totalBenefits = Math.round(employeeBenefits.reduce((sum, b) => sum + b.amount, 0) * 100) / 100;

    // Vacation deduction: proportional to biweekly salary based on days in period
    // This ensures vacation deduction never exceeds base pay
    const totalWorkingDays = getTotalWorkingDays();
    const vacationDeduction = totalWorkingDays > 0 
      ? (vacationDays / totalWorkingDays) * biweeklySalary 
      : 0;
    
    // Calculate effective earnings after vacation deduction (for TSS/ISR calculation)
    // Employees on full vacation don't earn wages this period, so no TSS/ISR applies
    const effectiveBasePay = Math.max(0, basePay - vacationDeduction);

    // Deductions - TSS and ISR only apply to effective earnings (not vacation pay)
    const tss = effectiveBasePay * TSS_EMPLOYEE_RATE;
    
    // ISR (progressive brackets - annual based, divided by 24 for bi-monthly)
    let isr = 0;
    if (effectiveBasePay > 0) {
      // Project annual income based on effective earnings ratio
      const workedRatio = effectiveBasePay / biweeklySalary;
      const projectedAnnualIncome = employee.salary * 12 * workedRatio;
      const annualISR = calculateAnnualISR(projectedAnnualIncome);
      // Divide by 24 for bi-monthly withholding
      isr = annualISR / 24;
    }
    
    const absenceDeduction = absenceDays * dailyRate;

    // Loan deductions - sum all active loan payment amounts for this employee
    const employeeLoans = loans.filter((l) => l.employee_id === employeeId);
    const loanDeduction = Math.round(employeeLoans.reduce((sum, l) => sum + l.payment_amount, 0) * 100) / 100;

    const totalDeductions = tss + isr + absenceDeduction + vacationDeduction + loanDeduction;
    const grossPay = basePay + overtimePay + holidayPay + totalBenefits;
    const netPay = grossPay - totalDeductions;

    return {
      employee,
      regularHours,
      overtimeHours,
      holidayHours,
      vacationDays,
      basePay,
      overtimePay,
      holidayPay,
      benefits: employeeBenefits,
      totalBenefits,
      tss,
      isr,
      absenceDeduction,
      vacationDeduction,
      loanDeduction,
      totalDeductions,
      grossPay,
      netPay,
    };
  };


  const payrollData = employees
    .map((e) => calculateEmployeePayroll(e.id))
    .filter(Boolean) as NonNullable<ReturnType<typeof calculateEmployeePayroll>>[];

  const totals = payrollData.reduce(
    (acc, p) => ({
      regularHours: acc.regularHours + p.regularHours,
      overtimeHours: acc.overtimeHours + p.overtimeHours,
      holidayHours: acc.holidayHours + p.holidayHours,
      vacationDays: acc.vacationDays + p.vacationDays,
      basePay: acc.basePay + p.basePay,
      overtimePay: acc.overtimePay + p.overtimePay,
      holidayPay: acc.holidayPay + p.holidayPay,
      totalBenefits: acc.totalBenefits + p.totalBenefits,
      tss: acc.tss + p.tss,
      isr: acc.isr + p.isr,
      loanDeduction: acc.loanDeduction + p.loanDeduction,
      totalDeductions: acc.totalDeductions + p.totalDeductions,
      grossPay: acc.grossPay + p.grossPay,
      netPay: acc.netPay + p.netPay,
    }),
    {
      regularHours: 0,
      overtimeHours: 0,
      holidayHours: 0,
      vacationDays: 0,
      basePay: 0,
      overtimePay: 0,
      holidayPay: 0,
      totalBenefits: 0,
      tss: 0,
      isr: 0,
      loanDeduction: 0,
      totalDeductions: 0,
      grossPay: 0,
      netPay: 0,
    }
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);

  // Export to Excel
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Reporte de Nómina");

      // Header
      sheet.columns = [
        { header: "Nombre", key: "name", width: 25 },
        { header: "Banco", key: "bank", width: 15 },
        { header: "Núm. Cuenta", key: "account", width: 20 },
        { header: "Hrs Reg", key: "regHours", width: 12 },
        { header: "Hrs Extra", key: "otHours", width: 12 },
        { header: "Hrs Fer", key: "holHours", width: 12 },
        { header: "Salario Base", key: "basePay", width: 15 },
        { header: "Pago Extra", key: "otPay", width: 15 },
        { header: "Pago Feriado", key: "holPay", width: 15 },
        { header: "Beneficios", key: "benefits", width: 15 },
        { header: "TSS", key: "tss", width: 12 },
        { header: "ISR", key: "isr", width: 12 },
        { header: "Ausencias", key: "absences", width: 12 },
        { header: "Préstamo", key: "loan", width: 12 },
        { header: "Total Deducciones", key: "totalDed", width: 18 },
        { header: "Pago Neto", key: "netPay", width: 15 },
      ];

      // Style header
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Data rows
      payrollData.forEach((p) => {
        sheet.addRow({
          name: p.employee.name,
          bank: p.employee.bank || "-",
          account: p.employee.bank_account_number || "-",
          regHours: p.regularHours.toFixed(1),
          otHours: p.overtimeHours.toFixed(1),
          holHours: p.holidayHours.toFixed(1),
          basePay: p.basePay.toFixed(2),
          otPay: p.overtimePay.toFixed(2),
          holPay: p.holidayPay.toFixed(2),
          benefits: p.totalBenefits.toFixed(2),
          tss: p.tss.toFixed(2),
          isr: p.isr.toFixed(2),
          absences: p.absenceDeduction.toFixed(2),
          loan: p.loanDeduction.toFixed(2),
          totalDed: p.totalDeductions.toFixed(2),
          netPay: p.netPay.toFixed(2),
        });
      });

      // Totals row
      const totalsRow = sheet.addRow({
        name: "TOTALES",
        bank: "",
        account: "",
        regHours: totals.regularHours.toFixed(1),
        otHours: totals.overtimeHours.toFixed(1),
        holHours: totals.holidayHours.toFixed(1),
        basePay: totals.basePay.toFixed(2),
        otPay: totals.overtimePay.toFixed(2),
        holPay: totals.holidayPay.toFixed(2),
        benefits: totals.totalBenefits.toFixed(2),
        tss: "",
        isr: "",
        absences: "",
        loan: totals.loanDeduction.toFixed(2),
        totalDed: totals.totalDeductions.toFixed(2),
        netPay: totals.netPay.toFixed(2),
      });
      totalsRow.font = { bold: true };
      totalsRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2EFDA" },
      };

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nomina_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Reporte de nómina exportado");
    } catch (error) {
      toast.error("Error al exportar reporte");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Generate PDF receipts
  const handleGenerateReceipts = async () => {
    setIsGeneratingReceipts(true);
    try {
      await generatePayrollReceiptsZip(payrollData, nominaNumber, startDate, endDate);
      toast.success("Recibos de pago generados");
    } catch (error) {
      toast.error("Error al generar recibos");
      console.error(error);
    } finally {
      setIsGeneratingReceipts(false);
    }
  };

  // Close period mutation
  const closePeriod = useMutation({
    mutationFn: async () => {
      // 1. Create transactions for each employee's net pay
      const dateStr = format(endDate, "yyyy-MM-dd");

      for (const p of payrollData) {
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
          comments: `Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")} | Horas: ${p.regularHours.toFixed(1)} + ${p.overtimeHours.toFixed(1)} Extra | Deducciones: ${p.totalDeductions.toFixed(2)}`,
        });
      }

      // 2. Update period status to 'closed'
      const { error } = await supabase
        .from("payroll_periods")
        .update({ status: "closed" })
        .eq("id", periodId);

      if (error) throw error;

      // 3. Decrement remaining_payments for all active loans
      for (const loan of loans) {
        const newRemaining = Math.max(0, loan.remaining_payments - 1);
        const isStillActive = newRemaining > 0;
        
        await supabase
          .from("employee_loans")
          .update({ 
            remaining_payments: newRemaining,
            is_active: isStillActive,
          })
          .eq("id", loan.id);
      }

      // 4. Generate receipts automatically on close
      await generatePayrollReceiptsZip(payrollData, nominaNumber, startDate, endDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-period"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      toast.success("Período cerrado, transacciones registradas y recibos generados");
      onPeriodClosed();
    },
    onError: (error) => {
      toast.error("Error al cerrar período: " + error.message);
    },
  });

  const isClosed = periodStatus === "closed";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resumen de Nómina</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="excel"
            onClick={handleExport}
            disabled={isExporting || payrollData.length === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateReceipts}
            disabled={isGeneratingReceipts || payrollData.length === 0}
          >
            {isGeneratingReceipts ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Recibos PDF
          </Button>
          {!isClosed && (
            <Button
              onClick={() => setShowCloseConfirm(true)}
              disabled={payrollData.length === 0}
            >
              <Lock className="h-4 w-4 mr-2" />
              Cerrar Período
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Table className="table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Empleado</TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">Pago Neto</TableHead>
              <TableHead className="text-right whitespace-nowrap">Hrs Reg</TableHead>
              <TableHead className="text-right text-orange-600 whitespace-nowrap">Hrs Extra</TableHead>
              <TableHead className="text-right text-amber-600 whitespace-nowrap">Hrs Fer</TableHead>
              <TableHead className="text-right whitespace-nowrap">Salario Base</TableHead>
              <TableHead className="text-right text-orange-600 whitespace-nowrap">Pago Extra</TableHead>
              <TableHead className="text-right text-amber-600 whitespace-nowrap">Pago Fer</TableHead>
              <TableHead className="text-right text-green-600 whitespace-nowrap">Beneficios</TableHead>
              <TableHead className="text-right text-purple-600 whitespace-nowrap">Préstamo</TableHead>
              <TableHead className="text-right text-red-600 whitespace-nowrap">TSS</TableHead>
              <TableHead className="text-right text-red-600 whitespace-nowrap">ISR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollData.map((p) => (
              <TableRow key={p.employee.id}>
                <TableCell className="font-medium">{p.employee.name}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {formatCurrency(p.netPay)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {p.regularHours.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono text-orange-600">
                  {p.overtimeHours.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono text-amber-600">
                  {p.holidayHours > 0 ? p.holidayHours.toFixed(1) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(p.basePay)}
                </TableCell>
                <TableCell className="text-right font-mono text-orange-600">
                  {formatCurrency(p.overtimePay)}
                </TableCell>
                <TableCell className="text-right font-mono text-amber-600">
                  {p.holidayPay > 0 ? formatCurrency(p.holidayPay) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-green-600">
                  {formatCurrency(p.totalBenefits)}
                </TableCell>
                <TableCell className="text-right font-mono text-purple-600">
                  {p.loanDeduction > 0 ? formatCurrency(p.loanDeduction) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {formatCurrency(p.tss)}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {p.isr > 0 ? formatCurrency(p.isr) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>TOTALES</TableCell>
              <TableCell className="text-right font-mono font-bold text-primary">
                {formatCurrency(totals.netPay)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {totals.regularHours.toFixed(1)}
              </TableCell>
              <TableCell className="text-right font-mono text-orange-600">
                {totals.overtimeHours.toFixed(1)}
              </TableCell>
              <TableCell className="text-right font-mono text-amber-600">
                {totals.holidayHours > 0 ? totals.holidayHours.toFixed(1) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(totals.basePay)}
              </TableCell>
              <TableCell className="text-right font-mono text-orange-600">
                {formatCurrency(totals.overtimePay)}
              </TableCell>
              <TableCell className="text-right font-mono text-amber-600">
                {totals.holidayPay > 0 ? formatCurrency(totals.holidayPay) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-green-600">
                {formatCurrency(totals.totalBenefits)}
              </TableCell>
              <TableCell className="text-right font-mono text-purple-600">
                {totals.loanDeduction > 0 ? formatCurrency(totals.loanDeduction) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {formatCurrency(totals.tss)}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {totals.isr > 0 ? formatCurrency(totals.isr) : "-"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar Período de Nómina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto hará lo siguiente:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Bloquear todas las entradas de hoja de tiempo para este período</li>
                <li>Crear {payrollData.length} transacciones de nómina en el libro mayor</li>
                <li>Pago total: {formatCurrency(totals.netPay)}</li>
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
