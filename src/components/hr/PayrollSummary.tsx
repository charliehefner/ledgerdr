import { useState, useEffect } from "react";
import { format, eachDayOfInterval, isWithinInterval, parseISO, isSunday } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Lock, Loader2, FileText, FileSpreadsheet, Calendar } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  is_sunday_work?: boolean;
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
  number_of_payments: number;
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
// Positions exempt from overtime pay (fixed salary regardless of hours)
const OVERTIME_EXEMPT_POSITIONS = ["Gerencia"];
const STANDARD_START = 7 * 60 + 30;
const STANDARD_END = 16 * 60 + 30;
const STANDARD_HOURS_PER_DAY = 8;
const LUNCH_DEDUCTION_HOURS = 1; // 1 hour lunch break (implicit, not shown on timesheet)
const LUNCH_THRESHOLD_HOURS = 5; // Deduct lunch if worked more than 5 clock hours
const SATURDAY_NORMAL_END = 11 * 60 + 30; // 11:30 AM - end of normal Saturday hours
const SATURDAY_NORMAL_HOURS = 4; // Normal Saturday: 7:30 AM to 11:30 AM
const SATURDAY_LUNCH_THRESHOLD = 14 * 60; // 2:00 PM - if end time > this, deduct lunch
import { TSS_EMPLOYEE_RATE, calculateAnnualISR, loadTssParameters } from "@/lib/payrollCalculations";

const OVERTIME_MULTIPLIER = 1.35;
const HOLIDAY_MULTIPLIER = 2.0; // 100% bonus = 2x pay
const SUNDAY_MULTIPLIER = 2.0; // 100% bonus for Sunday work per DR labor law

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

  const isClosed = periodStatus === "closed";

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
        .select("id, employee_id, loan_amount, payment_amount, remaining_payments, number_of_payments, is_active")
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

    const isOvertimeExempt = OVERTIME_EXEMPT_POSITIONS.includes(employee.position);

    const entries = timesheets.filter((t) => t.employee_id === employeeId);
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;
    let sundayHours = 0;
    let deficitHours = 0;

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
        let end = parseTimeToMinutes(t.end_time);
        // Handle cross-midnight shifts (e.g., 07:30 to 00:30)
        if (end < start) end += 24 * 60;
        const workDate = parseDateLocal(t.work_date);
        const isSundayWork = isSunday(workDate);
        const isSaturdayWork = workDate.getDay() === 6; // Saturday = 6

        // Sunday work gets 100% bonus (tracked separately)
        if (isSundayWork) {
          const clockHours = (end - start) / 60;
          const totalDayHours = clockHours > LUNCH_THRESHOLD_HOURS 
            ? clockHours - LUNCH_DEDUCTION_HOURS 
            : clockHours;
          sundayHours += totalDayHours;
          return;
        }

        // Saturday: Normal hours 7:30-11:30 (4 hours), overtime after that
        if (isSaturdayWork && !t.is_holiday) {
          const clockHours = (end - start) / 60;
          const totalDayHours = end > SATURDAY_LUNCH_THRESHOLD 
            ? clockHours - LUNCH_DEDUCTION_HOURS 
            : clockHours;
          
          if (isOvertimeExempt) {
            regularHours += totalDayHours;
          } else if (totalDayHours <= SATURDAY_NORMAL_HOURS) {
            regularHours += totalDayHours;
            if (totalDayHours < SATURDAY_NORMAL_HOURS) {
              deficitHours += SATURDAY_NORMAL_HOURS - totalDayHours;
            }
          } else {
            regularHours += SATURDAY_NORMAL_HOURS;
            overtimeHours += totalDayHours - SATURDAY_NORMAL_HOURS;
          }
          return;
        }

        // Weekdays (Mon-Fri) and Saturday holidays
        const clockHours = (end - start) / 60;
        const totalDayHours = clockHours > LUNCH_THRESHOLD_HOURS 
          ? clockHours - LUNCH_DEDUCTION_HOURS 
          : clockHours;
        
        if (t.is_holiday) {
          holidayHours += totalDayHours;
          return;
        }

        if (isOvertimeExempt) {
          regularHours += totalDayHours;
        } else if (totalDayHours <= STANDARD_HOURS_PER_DAY) {
          regularHours += totalDayHours;
          if (totalDayHours < STANDARD_HOURS_PER_DAY) {
            deficitHours += STANDARD_HOURS_PER_DAY - totalDayHours;
          }
        } else {
          regularHours += STANDARD_HOURS_PER_DAY;
          overtimeHours += totalDayHours - STANDARD_HOURS_PER_DAY;
        }
      }
    });

    // Count absences: full days (AUS flag) + partial days (deficit hours)
    const fullAbsenceDays = entries.filter((e) => {
      if (e.is_holiday) return false;
      if (e.work_date) {
        const workDate = parseDateLocal(e.work_date);
        if (isEmployeeOnVacation(employeeId, workDate)) return false;
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
    // Sunday bonus: 100% extra for hours worked on Sundays per DR labor law
    const sundayPay = sundayHours * hourlyRate * SUNDAY_MULTIPLIER; // Full 2x since Sunday hours aren't in regular

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

    // Benefits are taxable income for ISR but NOT for TSS
    const monthlyBenefits = totalBenefits * 2; // Convert bi-weekly to monthly

    // Step 1: TSS applies ONLY to salary (not benefits)
    // TSS is calculated on the full biweekly salary (vacation pay is still paid, so TSS still applies)
    const tss = basePay * TSS_EMPLOYEE_RATE;
    
    
    // Step 2: ISR base = (salary - TSS) + benefits
    // Per accountant: first deduct TSS from salary, then add benefits, then calculate ISR
    let isr = 0;
    if (effectiveBasePay > 0 || totalBenefits > 0) {
      // Monthly: salary - TSS on salary + benefits
      const monthlyTSS = employee.salary * TSS_EMPLOYEE_RATE;
      const monthlyTaxable = employee.salary - monthlyTSS + monthlyBenefits;
      
      // Project to annual taxable income
      const annualTaxableIncome = monthlyTaxable * 12;
      
      // Calculate annual ISR using progressive brackets
      const annualISR = calculateAnnualISR(annualTaxableIncome);
      
      // Prorate for this period based on worked ratio
      const workedRatio = effectiveBasePay / biweeklySalary;
      isr = (annualISR / 24) * Math.min(workedRatio, 1);
    }
    
    // Absence deduction: full days + partial days (deficit hours)
    const absenceDeduction = (fullAbsenceDays * dailyRate) + (deficitHours * hourlyRate);
    const employeeLoans = loans.filter((l) => l.employee_id === employeeId);
    const loanDeduction = Math.round(employeeLoans.reduce((sum, l) => sum + l.payment_amount, 0) * 100) / 100;

    // Build loan details for receipts
    // If period is closed, remaining_payments was already decremented, so payment_number = total - remaining
    // If period is open, remaining_payments is pre-decrement, so payment_number = total - remaining + 1
    const periodClosed = periodStatus === "closed";
    const loanDetails = employeeLoans.map((l) => ({
      loan_amount: l.loan_amount,
      payment_amount: l.payment_amount,
      payment_number: periodClosed
        ? l.number_of_payments - l.remaining_payments
        : l.number_of_payments - l.remaining_payments + 1,
      total_payments: l.number_of_payments,
    }));

    const totalDeductions = tss + isr + absenceDeduction + vacationDeduction + loanDeduction;
    const grossPay = basePay + overtimePay + holidayPay + sundayPay + totalBenefits;
    const netPayRaw = grossPay - totalDeductions;
    // Round up to next multiple of 5
    const netPay = Math.ceil(netPayRaw / 5) * 5;

    return {
      employee,
      regularHours,
      overtimeHours,
      holidayHours,
      sundayHours,
      vacationDays,
      basePay,
      overtimePay,
      holidayPay,
      sundayPay,
      benefits: employeeBenefits,
      totalBenefits,
      tss,
      isr,
      absenceDeduction,
      vacationDeduction,
      loanDeduction,
      loanDetails,
      totalDeductions,
      grossPay,
      netPay,
    };
  };

  // Export monthly consolidated Excel (both periods of the month)
  const handleExportMonthly = async () => {
    setIsExporting(true);
    try {
      // Determine the month from the current period's start date
      const year = startDate.getFullYear();
      const month = startDate.getMonth(); // 0-indexed
      const monthStart = format(new Date(year, month, 1), "yyyy-MM-dd");
      const monthEnd = format(new Date(year, month + 1, 0), "yyyy-MM-dd");

      // Fetch all payroll periods for this month
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

      // Fetch all snapshots for these periods
      const { data: allSnapshots, error: snapError } = await supabase
        .from("payroll_snapshots")
        .select("*")
        .in("period_id", periodIds);

      if (snapError) throw snapError;
      if (!allSnapshots || allSnapshots.length === 0) {
        toast.error("No hay datos de nómina para este mes.");
        return;
      }

      // Aggregate by employee
      const employeeMap = new Map<string, {
        name: string;
        basePay: number;
        overtimePay: number;
        holidayPay: number;
        sundayPay: number;
        totalBenefits: number;
        tss: number;
        isr: number;
        absenceDeduction: number;
        vacationDeduction: number;
        loanDeduction: number;
        grossPay: number;
        netPay: number;
      }>();

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
      const periodsCount = monthPeriods.length;

      // Build Excel
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`Nómina Mensual`);

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

      const fmtExcel = (v: number) => v > 0 ? v.toFixed(2) : "-";

      const grandTotals = {
        basePay: 0, netPay: 0, benefits: 0, loan: 0, absence: 0,
        tss: 0, isr: 0, otPay: 0, holPay: 0, sunPay: 0, grossPay: 0,
      };

      const sortedEmployees = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      sortedEmployees.forEach((emp) => {
        sheet.addRow({
          name: emp.name,
          basePay: emp.basePay.toFixed(2),
          netPay: emp.netPay.toFixed(2),
          benefits: fmtExcel(emp.totalBenefits),
          loan: fmtExcel(emp.loanDeduction),
          absence: fmtExcel(emp.absenceDeduction),
          tss: fmtExcel(emp.tss),
          isr: fmtExcel(emp.isr),
          otPay: fmtExcel(emp.overtimePay),
          holPay: fmtExcel(emp.holidayPay),
          sunPay: fmtExcel(emp.sundayPay),
          grossPay: emp.grossPay.toFixed(2),
        });
        grandTotals.basePay += emp.basePay;
        grandTotals.netPay += emp.netPay;
        grandTotals.benefits += emp.totalBenefits;
        grandTotals.loan += emp.loanDeduction;
        grandTotals.absence += emp.absenceDeduction;
        grandTotals.tss += emp.tss;
        grandTotals.isr += emp.isr;
        grandTotals.otPay += emp.overtimePay;
        grandTotals.holPay += emp.holidayPay;
        grandTotals.sunPay += emp.sundayPay;
        grandTotals.grossPay += emp.grossPay;
      });

      const totRow = sheet.addRow({
        name: "TOTALES",
        basePay: grandTotals.basePay.toFixed(2),
        netPay: grandTotals.netPay.toFixed(2),
        benefits: fmtExcel(grandTotals.benefits),
        loan: fmtExcel(grandTotals.loan),
        absence: fmtExcel(grandTotals.absence),
        tss: fmtExcel(grandTotals.tss),
        isr: fmtExcel(grandTotals.isr),
        otPay: fmtExcel(grandTotals.otPay),
        holPay: fmtExcel(grandTotals.holPay),
        sunPay: fmtExcel(grandTotals.sunPay),
        grossPay: grandTotals.grossPay.toFixed(2),
      });
      totRow.font = { bold: true };
      totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Nomina_Mensual_${format(startDate, "yyyy-MM")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Nómina mensual exportada (${periodsCount} período${periodsCount > 1 ? "s" : ""} - ${monthName})`);
    } catch (error) {
      toast.error("Error al exportar nómina mensual");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // When period is closed, use immutable snapshots instead of recalculating
  const payrollData = (() => {
    if (isClosed && snapshots.length > 0) {
      return snapshots.map((s) => {
        const employee = employees.find((e) => e.id === s.employee_id);
        if (!employee) return null;
        return {
          employee,
          regularHours: 0,
          overtimeHours: 0,
          holidayHours: 0,
          sundayHours: 0,
          vacationDays: 0,
          basePay: Number(s.base_pay),
          overtimePay: Number(s.overtime_pay),
          holidayPay: Number(s.holiday_pay),
          sundayPay: Number(s.sunday_pay),
          benefits: [] as EmployeeBenefit[],
          totalBenefits: Number(s.total_benefits),
          tss: Number(s.tss),
          isr: Number(s.isr),
          absenceDeduction: Number(s.absence_deduction),
          vacationDeduction: Number(s.vacation_deduction),
          loanDeduction: Number(s.loan_deduction),
          loanDetails: [] as { loan_amount: number; payment_amount: number; payment_number: number; total_payments: number }[],
          totalDeductions: Number(s.tss) + Number(s.isr) + Number(s.absence_deduction) + Number(s.vacation_deduction) + Number(s.loan_deduction),
          grossPay: Number(s.gross_pay),
          netPay: Number(s.net_pay),
        };
      }).filter(Boolean) as NonNullable<ReturnType<typeof calculateEmployeePayroll>>[];
    }
    return employees
      .map((e) => calculateEmployeePayroll(e.id))
      .filter(Boolean) as NonNullable<ReturnType<typeof calculateEmployeePayroll>>[];
  })();

  const totals = payrollData.reduce(
    (acc, p) => ({
      regularHours: acc.regularHours + p.regularHours,
      overtimeHours: acc.overtimeHours + p.overtimeHours,
      holidayHours: acc.holidayHours + p.holidayHours,
      sundayHours: acc.sundayHours + p.sundayHours,
      vacationDays: acc.vacationDays + p.vacationDays,
      basePay: acc.basePay + p.basePay,
      overtimePay: acc.overtimePay + p.overtimePay,
      holidayPay: acc.holidayPay + p.holidayPay,
      sundayPay: acc.sundayPay + p.sundayPay,
      totalBenefits: acc.totalBenefits + p.totalBenefits,
      tss: acc.tss + p.tss,
      isr: acc.isr + p.isr,
      absenceDeduction: acc.absenceDeduction + p.absenceDeduction,
      loanDeduction: acc.loanDeduction + p.loanDeduction,
      totalDeductions: acc.totalDeductions + p.totalDeductions,
      grossPay: acc.grossPay + p.grossPay,
      netPay: acc.netPay + p.netPay,
    }),
    {
      regularHours: 0,
      overtimeHours: 0,
      holidayHours: 0,
      sundayHours: 0,
      vacationDays: 0,
      basePay: 0,
      overtimePay: 0,
      holidayPay: 0,
      sundayPay: 0,
      totalBenefits: 0,
      tss: 0,
      isr: 0,
      absenceDeduction: 0,
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
      const sheet = workbook.addWorksheet(`Nómina ${nominaNumber}`);

      // Header
      sheet.columns = [
        { header: "Nombre", key: "name", width: 25 },
        { header: "Salario Base", key: "basePay", width: 15 },
        { header: "Pago Neto", key: "netPay", width: 15 },
        { header: "Beneficios", key: "benefits", width: 15 },
        { header: "Préstamo", key: "loan", width: 12 },
        { header: "Ausencias", key: "absence", width: 12 },
        { header: "TSS", key: "tss", width: 12 },
        { header: "ISR", key: "isr", width: 12 },
        { header: "Hrs Reg", key: "regHours", width: 12 },
        { header: "Hrs Extra", key: "otHours", width: 12 },
        { header: "Pago Extra", key: "otPay", width: 15 },
        { header: "Hrs Fer", key: "holHours", width: 12 },
        { header: "Pago Fer", key: "holPay", width: 15 },
        { header: "Hrs Dom", key: "sunHours", width: 12 },
        { header: "Pago Dom", key: "sunPay", width: 15 },
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

      const fmtExcel = (v: number) => v > 0 ? v.toFixed(2) : "-";
      const fmtHrs = (v: number) => v > 0 ? v.toFixed(1) : "-";

      // Data rows
      payrollData.forEach((p) => {
        sheet.addRow({
          name: p.employee.name,
          basePay: p.basePay.toFixed(2),
          netPay: p.netPay.toFixed(2),
          benefits: fmtExcel(p.totalBenefits),
          loan: fmtExcel(p.loanDeduction),
          absence: fmtExcel(p.absenceDeduction),
          tss: fmtExcel(p.tss),
          isr: fmtExcel(p.isr),
          regHours: fmtHrs(p.regularHours),
          otHours: fmtHrs(p.overtimeHours),
          otPay: fmtExcel(p.overtimePay),
          holHours: fmtHrs(p.holidayHours),
          holPay: fmtExcel(p.holidayPay),
          sunHours: fmtHrs(p.sundayHours),
          sunPay: fmtExcel(p.sundayPay),
        });
      });

      // Totals row
      const totalsRow = sheet.addRow({
        name: "TOTALES",
        basePay: totals.basePay.toFixed(2),
        netPay: totals.netPay.toFixed(2),
        benefits: fmtExcel(totals.totalBenefits),
        loan: fmtExcel(totals.loanDeduction),
        absence: fmtExcel(totals.absenceDeduction),
        tss: fmtExcel(totals.tss),
        isr: fmtExcel(totals.isr),
        regHours: fmtHrs(totals.regularHours),
        otHours: fmtHrs(totals.overtimeHours),
        otPay: fmtExcel(totals.overtimePay),
        holHours: fmtHrs(totals.holidayHours),
        holPay: fmtExcel(totals.holidayPay),
        sunHours: fmtHrs(totals.sundayHours),
        sunPay: fmtExcel(totals.sundayPay),
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
      a.download = `Nomina_${nominaNumber}_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.xlsx`;
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

  // Export to PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      
      // Title
      doc.setFontSize(16);
      doc.text(`Reporte de Nómina ${nominaNumber}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`, 14, 22);

      // Table data
      const headers = [
        "Nombre", "Salario Base", "Pago Neto", "Beneficios", "Préstamo",
        "Ausencias", "TSS", "ISR", "Hrs Reg", "Hrs Extra", "Pago Extra",
        "Hrs Fer", "Pago Fer", "Hrs Dom", "Pago Dom"
      ];

      const fmtV = (v: number, isCurrency = false) => {
        if (v <= 0) return "-";
        return isCurrency ? formatCurrency(v) : v.toFixed(1);
      };

      const rows = payrollData.map((p) => [
        p.employee.name,
        formatCurrency(p.basePay),
        formatCurrency(p.netPay),
        fmtV(p.totalBenefits, true),
        fmtV(p.loanDeduction, true),
        fmtV(p.absenceDeduction, true),
        fmtV(p.tss, true),
        fmtV(p.isr, true),
        fmtV(p.regularHours),
        fmtV(p.overtimeHours),
        fmtV(p.overtimePay, true),
        fmtV(p.holidayHours),
        fmtV(p.holidayPay, true),
        fmtV(p.sundayHours),
        fmtV(p.sundayPay, true),
      ]);

      // Add totals row
      rows.push([
        "TOTALES",
        formatCurrency(totals.basePay),
        formatCurrency(totals.netPay),
        fmtV(totals.totalBenefits, true),
        fmtV(totals.loanDeduction, true),
        fmtV(totals.absenceDeduction, true),
        fmtV(totals.tss, true),
        fmtV(totals.isr, true),
        fmtV(totals.regularHours),
        fmtV(totals.overtimeHours),
        fmtV(totals.overtimePay, true),
        fmtV(totals.holidayHours),
        fmtV(totals.holidayPay, true),
        fmtV(totals.sundayHours),
        fmtV(totals.sundayPay, true),
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 28,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 111, 92], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [226, 239, 218], textColor: 0, fontStyle: "bold" },
        didParseCell: (data) => {
          // Style the totals row
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fillColor = [226, 239, 218];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      doc.save(`Nomina_${nominaNumber}_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.pdf`);
      toast.success("Reporte PDF exportado");
    } catch (error) {
      toast.error("Error al exportar PDF");
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

      // 3. Save payroll snapshots for IR-3 and other reports
      const snapshotRows = payrollData.map((p) => ({
        period_id: periodId,
        employee_id: p.employee.id,
        base_pay: p.basePay,
        overtime_pay: p.overtimePay,
        holiday_pay: p.holidayPay,
        sunday_pay: p.sundayPay,
        total_benefits: p.totalBenefits,
        tss: p.tss,
        isr: p.isr,
        loan_deduction: p.loanDeduction,
        absence_deduction: p.absenceDeduction,
        vacation_deduction: p.vacationDeduction,
        gross_pay: p.grossPay,
        net_pay: p.netPay,
      }));

      if (snapshotRows.length > 0) {
        const { error: snapError } = await supabase
          .from("payroll_snapshots")
          .upsert(snapshotRows, { onConflict: "period_id,employee_id" });
        if (snapError) {
          console.error("Snapshot insert error:", snapError);
          // Non-fatal: don't block close
        }
      }

      // 4. Decrement remaining_payments for all active loans
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

      // 5. Generate detailed PRJ journal entry for accounting
      try {
        const totalGrossPay = payrollData.reduce((s, p) => s + p.grossPay, 0);
        const totalTss = payrollData.reduce((s, p) => s + p.tss, 0);
        const totalIsr = payrollData.reduce((s, p) => s + p.isr, 0);
        const totalNetPay = payrollData.reduce((s, p) => s + p.netPay, 0);
        const totalLoanDeduction = payrollData.reduce((s, p) => s + p.loanDeduction, 0);
        // Employer TSS: ~15.72% of gross (7.09% AFP + 7.53% SFS + 1.1% SRL)
        const TSS_EMPLOYER_RATE = 0.1572;
        const employerTss = Math.round(totalGrossPay * TSS_EMPLOYER_RATE * 100) / 100;

        // Lookup GL account IDs
        const acctCodes = ["7010", "6210", "2180", "2170", "1130"];
        const { data: glAccts } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code")
          .in("account_code", acctCodes)
          .eq("allow_posting", true)
          .is("deleted_at", null);

        const acctMap = new Map((glAccts || []).map(a => [a.account_code, a.id]));
        const salaryAcct = acctMap.get("7010");   // Salary Expense
        const employerTssAcct = acctMap.get("6210"); // Employer TSS Expense
        const tssLiabilityAcct = acctMap.get("2180"); // TSS Liability (employee + employer)
        const isrLiabilityAcct = acctMap.get("2170"); // ISR Withholding Liability
        const loansReceivableAcct = acctMap.get("1130"); // Loans Receivable / Employee Advances

        if (salaryAcct && tssLiabilityAcct) {
          // Create journal
          const { data: journalId, error: jErr } = await supabase.rpc(
            "create_journal_from_transaction" as any,
            {
              p_transaction_id: null,
              p_date: dateStr,
              p_description: `Nómina ${nominaNumber} — ${format(startDate, "dd/MM")} al ${format(endDate, "dd/MM/yyyy")}`,
              p_created_by: null,
              p_journal_type: "PRJ",
            }
          );

          if (!jErr && journalId) {
            const journalLines: any[] = [];

            // Debit: Salary Expense (gross pay)
            if (totalGrossPay > 0) {
              journalLines.push({
                journal_id: journalId, account_id: salaryAcct,
                debit: Math.round(totalGrossPay * 100) / 100, credit: 0,
                description: `Salarios Nómina ${nominaNumber}`,
              });
            }

            // Debit: Employer TSS Expense
            if (employerTss > 0 && employerTssAcct) {
              journalLines.push({
                journal_id: journalId, account_id: employerTssAcct,
                debit: employerTss, credit: 0,
                description: `TSS Patronal Nómina ${nominaNumber}`,
              });
            }

            // Credit: TSS Liability (employee + employer combined)
            const totalTssLiability = Math.round((totalTss + employerTss) * 100) / 100;
            if (totalTssLiability > 0) {
              journalLines.push({
                journal_id: journalId, account_id: tssLiabilityAcct,
                debit: 0, credit: totalTssLiability,
                description: `TSS por Pagar Nómina ${nominaNumber}`,
              });
            }

            // Credit: ISR Withholding Liability
            if (totalIsr > 0 && isrLiabilityAcct) {
              journalLines.push({
                journal_id: journalId, account_id: isrLiabilityAcct,
                debit: 0, credit: Math.round(totalIsr * 100) / 100,
                description: `ISR Retenido Nómina ${nominaNumber}`,
              });
            }

            // Credit: Loan deductions (reduce employee advances receivable)
            if (totalLoanDeduction > 0 && loansReceivableAcct) {
              journalLines.push({
                journal_id: journalId, account_id: loansReceivableAcct,
                debit: 0, credit: Math.round(totalLoanDeduction * 100) / 100,
                description: `Descuento Préstamos Nómina ${nominaNumber}`,
              });
            }

            // Credit: Net pay to bank (balancing entry)
            // Net pay = Gross + EmployerTSS - TotalTSSLiability - ISR - Loans
            // This simplifies to: totalNetPay (which already = gross - empTSS - ISR - loans) + employerTSS expense - employerTSS liability (net 0)
            // So bank credit = totalNetPay
            // But we need to find a bank account. Use the first active bank's GL account as default.
            const { data: defaultBank } = await supabase
              .from("bank_accounts")
              .select("chart_account_id")
              .eq("is_active", true)
              .eq("account_type", "bank")
              .limit(1)
              .maybeSingle();

            if (defaultBank?.chart_account_id && totalNetPay > 0) {
              journalLines.push({
                journal_id: journalId, account_id: defaultBank.chart_account_id,
                debit: 0, credit: Math.round(totalNetPay * 100) / 100,
                description: `Pago Neto Nómina ${nominaNumber}`,
              });
            }

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
        // Non-fatal: don't block payroll close
      }

      // 6. Generate receipts automatically on close
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

  // isClosed is declared at the top of the component

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resumen de Nómina</h3>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isExporting || payrollData.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover">
              <DropdownMenuItem onClick={handleExport} className="text-excel">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar a Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar a PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportMonthly}>
                <Calendar className="mr-2 h-4 w-4" />
                Exportar Mes Completo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <TableHead className="text-right whitespace-nowrap">Salario Base</TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">Pago Neto</TableHead>
              <TableHead className="text-right whitespace-nowrap">Beneficios</TableHead>
              <TableHead className="text-right text-purple-600 whitespace-nowrap">Préstamo</TableHead>
              <TableHead className="text-right text-red-600 whitespace-nowrap">Ausencias</TableHead>
              <TableHead className="text-right text-red-600 whitespace-nowrap">TSS</TableHead>
              <TableHead className="text-right text-red-600 whitespace-nowrap">ISR</TableHead>
              <TableHead className="text-right whitespace-nowrap">Hrs Reg</TableHead>
              <TableHead className="text-right whitespace-nowrap bg-green-50">Hrs Extra</TableHead>
              <TableHead className="text-right whitespace-nowrap bg-green-50">Pago Extra</TableHead>
              <TableHead className="text-right whitespace-nowrap bg-amber-50">Hrs Fer</TableHead>
              <TableHead className="text-right whitespace-nowrap bg-amber-50">Pago Fer</TableHead>
              <TableHead className="text-right whitespace-nowrap bg-sky-50">Hrs Dom</TableHead>
              <TableHead className="text-right whitespace-nowrap bg-sky-50">Pago Dom</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollData.map((p) => (
              <TableRow key={p.employee.id}>
                <TableCell className="font-medium">{p.employee.name}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(p.basePay)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {formatCurrency(p.netPay)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {p.totalBenefits > 0 ? formatCurrency(p.totalBenefits) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-purple-600">
                  {p.loanDeduction > 0 ? formatCurrency(p.loanDeduction) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {p.absenceDeduction > 0 ? formatCurrency(p.absenceDeduction) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {p.tss > 0 ? formatCurrency(p.tss) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {p.isr > 0 ? formatCurrency(p.isr) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {p.regularHours > 0 ? p.regularHours.toFixed(1) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono bg-green-50">
                  {p.overtimeHours > 0 ? p.overtimeHours.toFixed(1) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono bg-green-50">
                  {p.overtimePay > 0 ? formatCurrency(p.overtimePay) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono bg-amber-50">
                  {p.holidayHours > 0 ? p.holidayHours.toFixed(1) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono bg-amber-50">
                  {p.holidayPay > 0 ? formatCurrency(p.holidayPay) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono bg-sky-50">
                  {p.sundayHours > 0 ? p.sundayHours.toFixed(1) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono bg-sky-50">
                  {p.sundayPay > 0 ? formatCurrency(p.sundayPay) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>TOTALES</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(totals.basePay)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold text-primary">
                {formatCurrency(totals.netPay)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {totals.totalBenefits > 0 ? formatCurrency(totals.totalBenefits) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-purple-600">
                {totals.loanDeduction > 0 ? formatCurrency(totals.loanDeduction) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {totals.absenceDeduction > 0 ? formatCurrency(totals.absenceDeduction) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {totals.tss > 0 ? formatCurrency(totals.tss) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {totals.isr > 0 ? formatCurrency(totals.isr) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {totals.regularHours > 0 ? totals.regularHours.toFixed(1) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono bg-green-50">
                {totals.overtimeHours > 0 ? totals.overtimeHours.toFixed(1) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono bg-green-50">
                {totals.overtimePay > 0 ? formatCurrency(totals.overtimePay) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono bg-amber-50">
                {totals.holidayHours > 0 ? totals.holidayHours.toFixed(1) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono bg-amber-50">
                {totals.holidayPay > 0 ? formatCurrency(totals.holidayPay) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono bg-sky-50">
                {totals.sundayHours > 0 ? totals.sundayHours.toFixed(1) : "-"}
              </TableCell>
              <TableCell className="text-right font-mono bg-sky-50">
                {totals.sundayPay > 0 ? formatCurrency(totals.sundayPay) : "-"}
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
