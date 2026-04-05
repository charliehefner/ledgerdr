import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, eachDayOfInterval, isSunday, isSaturday, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TimeInput } from "./TimeInput";

interface Employee {
  id: string;
  name: string;
  salary: number;
  position: string;
}

// Positions that get auto-filled with standard hours
const SALARIED_POSITIONS = ["Gerencia", "Administrativa", "Supervisor"];

// Positions exempt from overtime pay (fixed salary regardless of hours)
const OVERTIME_EXEMPT_POSITIONS = ["Gerencia"];

// Position display order for grouping (field workers first, management last)
const POSITION_ORDER = [
  "Servicios Generales",
  "Volteador",
  "Sereno",
  "Tractorista",
  "Supervisor",
  "Administrativa",
  "Gerencia",
];

interface TimesheetEntry {
  id?: string;
  employee_id: string;
  period_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  is_absent: boolean;
  is_holiday: boolean;
  is_sunday_work?: boolean; // Track Sunday work for 100% bonus
  notes?: string | null;
}

interface EmployeeBenefit {
  id: string;
  employee_id: string;
  benefit_type: string;
  amount: number;
  is_recurring: boolean;
}

interface EmployeeVacation {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
}

interface PayrollTimeGridProps {
  periodId: string | null;
  startDate: Date;
  endDate: Date;
  onEmployeeClick: (employeeId: string) => void;
}

const BENEFIT_TYPES = ["Teléfono", "Gasolina", "Bono"];

/** Small wrapper that debounces onChange by 600ms */
function DebouncedNumberInput({
  value: externalValue,
  onChange,
  className,
}: {
  value: number | string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(String(externalValue || ""));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(String(externalValue || ""));
  }, [externalValue]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeRef.current(val), 600);
  }, []);

  return (
    <Input
      type="number"
      min={0}
      step={100}
      value={localValue}
      onChange={handleChange}
      className={className}
    />
  );
}

// Standard work hours: 7:30 AM to 4:30 PM (9 clock hours, minus 1 hour lunch = 8 work hours)
const STANDARD_START = 7 * 60 + 30; // 7:30 AM in minutes
const STANDARD_END = 16 * 60 + 30;  // 4:30 PM in minutes
const STANDARD_HOURS_PER_DAY = 8;   // After lunch deduction
const LUNCH_DEDUCTION_HOURS = 1;    // 1 hour lunch break (implicit, not shown on timesheet)
const LUNCH_THRESHOLD_HOURS = 5;    // Deduct lunch if worked more than 5 clock hours
const SATURDAY_NORMAL_END = 11 * 60 + 30; // 11:30 AM - end of normal Saturday hours
const SATURDAY_NORMAL_HOURS = 4;    // Normal Saturday: 7:30 AM to 11:30 AM
const SATURDAY_LUNCH_THRESHOLD = 14 * 60; // 2:00 PM - if end time > this, deduct lunch

// DR Labor Law rates (DGII 2024/2025)
const TSS_EMPLOYEE_RATE = 0.0591; // 3.04% AFP + 2.87% SFS

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

export function PayrollTimeGrid({
  periodId,
  startDate,
  endDate,
  onEmployeeClick,
}: PayrollTimeGridProps) {
  const queryClient = useQueryClient();
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      // Use employees_safe view for consistency (no sensitive fields in this query)
      const { data, error } = await supabase
        .from("employees_safe")
        .select("id, name, salary, position")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch timesheet entries for this period
  const { data: timesheets = [] } = useQuery({
    queryKey: ["timesheets", periodId],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from("employee_timesheets")
        .select("*")
        .eq("period_id", periodId);
      if (error) throw error;
      return data as TimesheetEntry[];
    },
    enabled: !!periodId,
  });

  // Fetch employee vacations that overlap with this period
  const { data: vacations = [] } = useQuery({
    queryKey: ["employee-vacations", startDate.toISOString(), endDate.toISOString()],
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

  // Fetch recurring employee benefits (these persist across periods)
  const { data: employeeBenefits = [] } = useQuery({
    queryKey: ["employee-benefits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_benefits")
        .select("*");
      if (error) throw error;
      return data as EmployeeBenefit[];
    },
  });

  // Mutation to save timesheet entry (upsert to avoid duplicate key errors)
  const saveTimesheet = useMutation({
    mutationFn: async (entry: Omit<TimesheetEntry, "id"> & { id?: string }) => {
      // Refresh session if JWT is about to expire or already expired
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw new Error("Sesión expirada. Por favor, vuelva a iniciar sesión.");
      }

      const { error } = await supabase
        .from("employee_timesheets")
        .upsert(
          {
            employee_id: entry.employee_id,
            period_id: entry.period_id,
            work_date: entry.work_date,
            start_time: entry.start_time,
            end_time: entry.end_time,
            is_absent: entry.is_absent,
            is_holiday: entry.is_holiday ?? false,
            notes: entry.notes ?? null,
          },
          {
            onConflict: "employee_id,work_date",
            ignoreDuplicates: false,
          }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", periodId] });
    },
    onError: (error) => {
      toast.error("Error al guardar entrada: " + error.message);
    },
  });

  // Mutation to delete a timesheet entry (for clearing cells)
  const deleteTimesheet = useMutation({
    mutationFn: async ({ employeeId, date }: { employeeId: string; date: string }) => {
      const { error } = await supabase
        .from("employee_timesheets")
        .delete()
        .eq("employee_id", employeeId)
        .eq("work_date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", periodId] });
    },
    onError: (error) => {
      toast.error("Error al limpiar entrada: " + error.message);
    },
  });

  // Mutation to save employee benefit (persists across all periods)
  const saveEmployeeBenefit = useMutation({
    mutationFn: async (benefit: { employee_id: string; benefit_type: string; amount: number }) => {
      const existing = employeeBenefits.find(
        (b) =>
          b.employee_id === benefit.employee_id &&
          b.benefit_type === benefit.benefit_type
      );

      if (existing) {
        const { error } = await supabase
          .from("employee_benefits")
          .update({ amount: benefit.amount })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_benefits")
          .insert({
            employee_id: benefit.employee_id,
            benefit_type: benefit.benefit_type,
            amount: benefit.amount,
            is_recurring: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-benefits"] });
    },
    onError: (error) => {
      toast.error("Error al guardar beneficio: " + error.message);
    },
  });

  // Check if employee is on vacation for a specific date
  const isEmployeeOnVacation = (employeeId: string, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return vacations.some((v) => {
      const vacStart = parseDateLocal(v.start_date);
      const vacEnd = parseDateLocal(v.end_date);
      return (
        v.employee_id === employeeId &&
        isWithinInterval(date, { start: vacStart, end: vacEnd })
      );
    });
  };

  // Auto-fill standard hours for salaried positions
  const autoFillSalariedEmployees = async () => {
    if (!periodId) return;

    const salariedEmployees = employees.filter((e) =>
      SALARIED_POSITIONS.includes(e.position)
    );

    if (salariedEmployees.length === 0) {
      toast.info("No hay empleados asalariados para auto-llenar");
      return;
    }

    try {
      const entries: Omit<TimesheetEntry, "id">[] = [];

      for (const employee of salariedEmployees) {
        for (const day of days) {
          // Skip Sundays, vacation days, and holidays (Saturday is a workday)
          if (isSunday(day)) continue;
          if (isEmployeeOnVacation(employee.id, day)) continue;
          if (isDayHoliday(day)) continue;

          const dateStr = format(day, "yyyy-MM-dd");
          // Saturday: 7:30-11:30 (4 hours), Weekdays: 7:30-16:30 (8 hours after lunch)
          const isSaturdayDay = isSaturday(day);
          
          entries.push({
            employee_id: employee.id,
            period_id: periodId,
            work_date: dateStr,
            start_time: "07:30",
            end_time: isSaturdayDay ? "11:30" : "16:30",
            is_absent: false,
            is_holiday: false,
          });
        }
      }

      // Upsert all entries
      const { error } = await supabase
        .from("employee_timesheets")
        .upsert(entries, { onConflict: "employee_id,work_date", ignoreDuplicates: false });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["timesheets", periodId] });
      toast.success(`Auto-llenado para ${salariedEmployees.length} empleado(s) asalariado(s)`);
    } catch (error: any) {
      toast.error("Error al auto-llenar: " + error.message);
    }
  };

  const getTimesheetEntry = (employeeId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return timesheets.find(
      (t) => t.employee_id === employeeId && t.work_date === dateStr
    );
  };

  const handleTimeChange = (
    employeeId: string,
    date: Date,
    field: "start_time" | "end_time",
    value: string | null
  ) => {
    if (!periodId) return;

    const existing = getTimesheetEntry(employeeId, date);
    const dateStr = format(date, "yyyy-MM-dd");

    // If clearing (value is null) and we have an existing entry
    if (value === null && existing) {
      const otherField = field === "start_time" ? "end_time" : "start_time";
      const otherValue = existing[otherField];
      
      // If both times would be empty after this change, mark as absent instead of deleting
      if (!otherValue) {
        const absentEntry: TimesheetEntry = {
          ...existing,
          start_time: null,
          end_time: null,
          is_absent: true,
        };
        saveTimesheet.mutate(absentEntry);
        return;
      }
    }

    const entry: TimesheetEntry = existing
      ? { ...existing, [field]: value }
      : {
          employee_id: employeeId,
          period_id: periodId,
          work_date: dateStr,
          start_time: field === "start_time" ? value : null,
          end_time: field === "end_time" ? value : null,
          is_absent: false,
          is_holiday: false,
        };

    // If we have valid times, clear the absent flag
    if (entry.start_time && entry.end_time) {
      entry.is_absent = false;
    }

    saveTimesheet.mutate(entry);
  };

  // Toggle absent status for a specific day and employee
  const toggleAbsentForDay = (employeeId: string, date: Date) => {
    if (!periodId) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = getTimesheetEntry(employeeId, date);
    
    if (existing) {
      // If already absent, delete the entry to clear it
      if (existing.is_absent && !existing.start_time && !existing.end_time) {
        deleteTimesheet.mutate({ employeeId, date: dateStr });
      } else {
        // Mark as absent by clearing times and setting flag
        const absentEntry: TimesheetEntry = {
          ...existing,
          start_time: null,
          end_time: null,
          is_absent: true,
        };
        saveTimesheet.mutate(absentEntry);
      }
    } else {
      // Create new absent entry
      const absentEntry = {
        employee_id: employeeId,
        period_id: periodId,
        work_date: dateStr,
        start_time: null,
        end_time: null,
        is_absent: true,
        is_holiday: false,
      };
      saveTimesheet.mutate(absentEntry);
    }
  };

  // Toggle holiday status for a specific day (affects all employees on that day)
  const toggleHolidayForDay = async (date: Date) => {
    if (!periodId) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const entriesForDay = timesheets.filter((t) => t.work_date === dateStr);
    
    // Check if any entry already has is_holiday = true
    const isCurrentlyHoliday = entriesForDay.some((t) => t.is_holiday);
    const newHolidayStatus = !isCurrentlyHoliday;
    
    try {
      // Update all existing entries for this day
      if (entriesForDay.length > 0) {
        const { error } = await supabase
          .from("employee_timesheets")
          .update({ is_holiday: newHolidayStatus })
          .eq("period_id", periodId)
          .eq("work_date", dateStr);
        
        if (error) throw error;
      }
      
      // For employees without entries, only create if marking AS holiday
      // Don't create empty entries just to mark holiday status
      if (newHolidayStatus) {
        const employeesWithEntries = new Set(entriesForDay.map((e) => e.employee_id));
        const employeesWithoutEntries = employees.filter((e) => !employeesWithEntries.has(e.id));
        
        if (employeesWithoutEntries.length > 0) {
          const newEntries = employeesWithoutEntries.map((employee) => ({
            employee_id: employee.id,
            period_id: periodId,
            work_date: dateStr,
            start_time: null,
            end_time: null,
            is_absent: false, // Holiday without times is NOT an absence
            is_holiday: true,
          }));
          
          const { error } = await supabase
            .from("employee_timesheets")
            .upsert(newEntries, { onConflict: "employee_id,work_date", ignoreDuplicates: false });
          
          if (error) throw error;
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["timesheets", periodId] });
      toast.success(newHolidayStatus ? "Día marcado como feriado (100% bono)" : "Estado de feriado removido");
    } catch (error: any) {
      toast.error("Error al cambiar feriado: " + error.message);
    }
  };

  // Check if a day is marked as holiday
  const isDayHoliday = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return timesheets.some((t) => t.work_date === dateStr && t.is_holiday);
  };

  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Calculate hours: regular is within 7:30am-4:30pm, overtime is outside, holiday/Sunday hours tracked separately
  // Gerencia employees are exempt from overtime - all hours count as regular
  // Deficit hours: when employee works less than standard day (counterpart to overtime)
  const calculateHoursForEmployee = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    const isOvertimeExempt = employee && OVERTIME_EXEMPT_POSITIONS.includes(employee.position);
    
    const entries = timesheets.filter((t) => t.employee_id === employeeId);
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;
    let sundayHours = 0;
    let deficitHours = 0;

    entries.forEach((t) => {
      if (t.start_time && t.end_time) {
        const start = parseTimeToMinutes(t.start_time);
        let end = parseTimeToMinutes(t.end_time);
        // Handle cross-midnight shifts (e.g., 07:30 to 00:30)
        if (end < start) end += 24 * 60;
        const workDate = parseDateLocal(t.work_date);
        const isSundayWork = isSunday(workDate);
        const isSaturdayWork = workDate.getDay() === 6; // Saturday = 6
        
        // Sunday work gets 100% bonus (tracked separately from holidays)
        // All Sunday hours get 2x rate, including overtime
        if (isSundayWork) {
          const clockHours = (end - start) / 60;
          const totalDayHours = clockHours > LUNCH_THRESHOLD_HOURS 
            ? clockHours - LUNCH_DEDUCTION_HOURS 
            : clockHours;
          sundayHours += totalDayHours;
          return;
        }

        // Saturday: Normal hours 7:30-11:30 (4 hours), overtime after that
        // Lunch deduction if end time > 14:00 (2:00 PM)
        if (isSaturdayWork && !t.is_holiday) {
          const clockHours = (end - start) / 60;
          // Deduct lunch if end time is after 2:00 PM
          const totalDayHours = end > SATURDAY_LUNCH_THRESHOLD 
            ? clockHours - LUNCH_DEDUCTION_HOURS 
            : clockHours;
          
          if (isOvertimeExempt) {
            // Exempt employees: all hours are regular, no overtime
            regularHours += totalDayHours;
          } else if (totalDayHours <= SATURDAY_NORMAL_HOURS) {
            regularHours += totalDayHours;
            // Track deficit if worked less than standard Saturday
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
        
        // If this is a holiday, all hours get holiday pay bonus (2x rate)
        // Holiday overtime is also at holiday rate
        if (t.is_holiday) {
          holidayHours += totalDayHours;
          return;
        }
        
        // Overtime calculation: based on 8-hour day threshold (per DR labor law)
        // Hours beyond 8 in a single day are overtime at 1.35x rate
        // Gerencia employees are exempt - all hours count as regular
        if (isOvertimeExempt) {
          regularHours += totalDayHours;
        } else if (totalDayHours <= STANDARD_HOURS_PER_DAY) {
          regularHours += totalDayHours;
          // Track deficit if worked less than standard day
          if (totalDayHours < STANDARD_HOURS_PER_DAY) {
            deficitHours += STANDARD_HOURS_PER_DAY - totalDayHours;
          }
        } else {
          regularHours += STANDARD_HOURS_PER_DAY;
          overtimeHours += totalDayHours - STANDARD_HOURS_PER_DAY;
        }
      }
    });

    return { regularHours, overtimeHours, holidayHours, sundayHours, deficitHours, totalHours: regularHours + overtimeHours };
  };

  const getAbsenceDays = (employeeId: string) => {
    return timesheets.filter(
      (t) => t.employee_id === employeeId && t.is_absent && !t.is_holiday
    ).length;
  };

  const getBenefitAmount = (employeeId: string, benefitType: string): number => {
    const benefit = employeeBenefits.find(
      (b) => b.employee_id === employeeId && b.benefit_type === benefitType
    );
    return benefit?.amount || 0;
  };

  const handleBenefitChange = (
    employeeId: string,
    benefitType: string,
    value: string
  ) => {
    if (!employeeId) return;
    const amount = parseFloat(value) || 0;
    saveEmployeeBenefit.mutate({
      employee_id: employeeId,
      benefit_type: benefitType,
      amount,
    });
  };

  const calculateDeductions = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return { tss: 0, isr: 0, absenceDeduction: 0, vacationDeduction: 0 };

    const biweeklySalary = employee.salary / 2;
    const monthlySalary = employee.salary;
    const dailyRate = employee.salary / 23.83; // DR average work days
    const hourlyRate = dailyRate / 8;

    // Get employee benefits (Teléfono, Gasolina, Bono) - these are taxable income per DGII
    const empBenefits = employeeBenefits.filter((b) => b.employee_id === employeeId);
    const totalBenefits = empBenefits.reduce((sum, b) => sum + b.amount, 0);
    const monthlyBenefits = totalBenefits * 2; // Convert bi-weekly to monthly

    // Count vacation days and total working days for this period
    const totalWorkingDays = days.filter((day) => !isSunday(day)).length;
    const vacationDays = days.filter((day) => 
      !isSunday(day) && isEmployeeOnVacation(employeeId, day)
    ).length;
    
    // Vacation deduction: proportional to biweekly salary based on days in period
    // This ensures vacation deduction never exceeds base pay
    const vacationDeduction = totalWorkingDays > 0 
      ? (vacationDays / totalWorkingDays) * biweeklySalary 
      : 0;
    
    // Calculate effective earnings after vacation deduction
    // Employees on full vacation don't earn wages this period, so no TSS/ISR applies
    const effectiveBasePay = Math.max(0, biweeklySalary - vacationDeduction);

    // TSS (employee portion) - applies to full biweekly salary (vacation pay is still paid)
    // Benefits are NOT included in TSS base per DR labor law
    const tss = biweeklySalary * TSS_EMPLOYEE_RATE;

    // ISR (progressive brackets - annual based, divided by 24 for bi-monthly)
    let isr = 0;
    if (effectiveBasePay > 0 || totalBenefits > 0) {
      const monthlyGross = monthlySalary + monthlyBenefits;
      const monthlyTSS = monthlyGross * TSS_EMPLOYEE_RATE;
      const monthlyTaxable = monthlyGross - monthlyTSS;
      const annualTaxableIncome = monthlyTaxable * 12;
      const annualISR = calculateAnnualISR(annualTaxableIncome);
      const workedRatio = (effectiveBasePay + totalBenefits) / (biweeklySalary + totalBenefits);
      isr = (annualISR / 24) * workedRatio;
    }

    // Absence deduction: full days (AUS flag) + partial days (deficit hours)
    const fullAbsenceDays = getAbsenceDays(employeeId);
    const { deficitHours } = calculateHoursForEmployee(employeeId);
    const absenceDeduction = (fullAbsenceDays * dailyRate) + (deficitHours * hourlyRate);

    return { tss, isr, absenceDeduction, vacationDeduction };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Group employees by position for visual organization
  const groupedEmployees = useMemo(() => {
    const groups: { position: string; employees: Employee[] }[] = [];
    
    POSITION_ORDER.forEach((position) => {
      const positionEmployees = employees.filter((e) => e.position === position);
      if (positionEmployees.length > 0) {
        groups.push({ position, employees: positionEmployees });
      }
    });
    
    // Add any employees with positions not in our order list
    const otherEmployees = employees.filter(
      (e) => !POSITION_ORDER.includes(e.position)
    );
    if (otherEmployees.length > 0) {
      groups.push({ position: "Servicios Generales", employees: otherEmployees });
    }
    
    return groups;
  }, [employees]);

  // Save note for a specific day/employee
  const saveNote = (employeeId: string, date: Date, note: string) => {
    if (!periodId) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = getTimesheetEntry(employeeId, date);
    const entry: TimesheetEntry = existing
      ? { ...existing, notes: note || null }
      : {
          employee_id: employeeId,
          period_id: periodId,
          work_date: dateStr,
          start_time: null,
          end_time: null,
          is_absent: false,
          is_holiday: false,
          notes: note || null,
        };
    saveTimesheet.mutate(entry);
  };

  // Inline NoteButton component
  const NoteButton = ({ employeeId, date }: { employeeId: string; date: Date }) => {
    const entry = getTimesheetEntry(employeeId, date);
    const hasNote = !!(entry?.notes && entry.notes.trim());
    const [noteText, setNoteText] = useState(entry?.notes || "");
    const [open, setOpen] = useState(false);

    // Sync local state when popover opens
    const handleOpenChange = (isOpen: boolean) => {
      if (isOpen) {
        setNoteText(entry?.notes || "");
      }
      setOpen(isOpen);
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "absolute top-0.5 right-0.5 w-2 h-2 rounded-full cursor-pointer z-10 transition-colors",
              hasNote
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600 opacity-40 hover:opacity-100"
            )}
            title={hasNote ? "Ver nota" : "Agregar nota"}
          />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" side="top" align="end">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="text-xs min-h-[60px] resize-none"
            placeholder="Nota del día..."
          />
          <Button
            size="sm"
            className="w-full mt-1 h-6 text-xs"
            onClick={() => {
              saveNote(employeeId, date, noteText);
              setOpen(false);
            }}
          >
            Guardar
          </Button>
        </PopoverContent>
      </Popover>
    );
  };

  if (!periodId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Seleccione o cree un período de nómina para comenzar
      </div>
    );
  }

  const hasSalariedEmployees = employees.some((e) =>
    SALARIED_POSITIONS.includes(e.position)
  );

  return (
    <div className="space-y-3">
      {hasSalariedEmployees && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={autoFillSalariedEmployees}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-llenar Asalariados
          </Button>
        </div>
      )}
      <div className="overflow-auto max-h-[70vh] border rounded-lg">
        <table className="w-full caption-bottom text-sm table-auto">
        <thead className="sticky top-0 z-20 bg-background shadow-sm border-b">
          <tr>
            <th className="sticky left-0 bg-background z-30 min-w-[140px] h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
              Empleado
            </th>
            {days.map((day, index) => {
              const isHoliday = isDayHoliday(day);
              return (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "text-center min-w-[100px] h-16 px-4 align-middle font-medium text-muted-foreground whitespace-nowrap",
                    isSunday(day) && "bg-muted",
                    !isSunday(day) && isHoliday && "bg-amber-300 dark:bg-amber-800",
                    !isSunday(day) && !isHoliday && index % 2 === 1 && "bg-muted/40",
                    !isSunday(day) && !isHoliday && index % 2 === 0 && "bg-background"
                  )}
                >
                  <div className="text-xs">{format(day, "EEE", { locale: es })}</div>
                  <div className="font-mono">{format(day, "d")}</div>
                  {!isSunday(day) && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Checkbox
                        id={`holiday-${day.toISOString()}`}
                        checked={isHoliday}
                        onCheckedChange={() => toggleHolidayForDay(day)}
                        className="h-3 w-3"
                      />
                      <label 
                        htmlFor={`holiday-${day.toISOString()}`}
                        className={cn(
                          "text-[10px] cursor-pointer",
                          isHoliday && "text-amber-600 font-medium"
                        )}
                      >
                        Feriado
                      </label>
                    </div>
                  )}
                </th>
              );
            })}
            <th className="text-center min-w-[60px] bg-background h-12 px-4 align-middle font-medium text-muted-foreground whitespace-nowrap">Hrs</th>
            <th className="text-center min-w-[60px] text-orange-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">Extra</th>
            <th className="text-center min-w-[60px] text-amber-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">Fer</th>
            <th className="text-center min-w-[60px] text-emerald-700 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">Dom</th>
            {BENEFIT_TYPES.map((type) => (
              <th key={type} className="text-center min-w-[80px] text-green-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">
                {type}
              </th>
            ))}
            <th className="text-center min-w-[80px] text-red-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">TSS</th>
            <th className="text-center min-w-[80px] text-red-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">ISR</th>
            <th className="text-center min-w-[80px] text-red-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">Ausencias</th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {groupedEmployees.map((group, groupIndex) => (
            <React.Fragment key={`group-${group.position}`}>
              {/* Position Group Header */}
              <tr className="bg-muted/80 border-b">
                <td 
                  colSpan={days.length + 1 + 3 + BENEFIT_TYPES.length + 3} 
                  className="sticky left-0 z-10 py-2 px-4 font-semibold text-sm text-muted-foreground uppercase tracking-wide border-t-2 border-border"
                >
                  {group.position} ({group.employees.length})
                </td>
              </tr>
              
              {group.employees.map((employee, empIndex) => {
                const { regularHours, overtimeHours, holidayHours, sundayHours } = calculateHoursForEmployee(employee.id);
                const deductions = calculateDeductions(employee.id);
                const isLastInGroup = empIndex === group.employees.length - 1;

                return (
                  <tr 
                    key={employee.id}
                    className={cn(
                      "transition-colors border-b hover:bg-muted/50",
                      isLastInGroup && "border-b-2 border-border"
                    )}
                  >
                    <td className="sticky left-0 bg-background z-10 font-medium border-r border-border p-4 align-middle">
                      <button
                        onClick={() => onEmployeeClick(employee.id)}
                        className="text-left hover:text-primary hover:underline focus:outline-none text-sm"
                      >
                        {employee.name}
                      </button>
                    </td>
                    {days.map((day, index) => {
                      const entry = getTimesheetEntry(employee.id, day);
                      const sunday = isSunday(day);
                      const saturday = isSaturday(day);
                      const endTimeDefaultPeriod = saturday ? "AM" : "PM";
                      const isHoliday = entry?.is_holiday;
                      const isVacation = isEmployeeOnVacation(employee.id, day);
                      
                      // Determine cell status for coloring
                      const hasData = entry?.start_time && entry?.end_time;
                      // Absent = has entry with is_absent flag AND not a holiday AND not vacation
                      // OR has entry with no times and is_absent is true
                      const isAbsent = !sunday && !isHoliday && !isVacation && entry?.is_absent && !hasData;
                      const hasOvertime = hasData && entry?.end_time && (
                        saturday
                          ? parseTimeToMinutes(entry.end_time) > SATURDAY_NORMAL_END
                          : parseTimeToMinutes(entry.end_time) > STANDARD_END
                      );
                      
                      return (
                        <td
                          key={day.toISOString()}
                          className={cn(
                            "p-1 text-center border-r border-border/30 align-middle relative",
                            // Sunday with work = darker green for 100% bonus
                            sunday && hasData && "bg-emerald-400 dark:bg-emerald-800",
                            // Sunday without work = muted
                            sunday && !hasData && "bg-muted/60",
                            // Status-based colors (priority order: vacation > holiday > absent > overtime > filled)
                            !sunday && isVacation && "bg-violet-300 dark:bg-violet-900",
                            !sunday && !isVacation && isHoliday && "bg-amber-300 dark:bg-amber-800",
                            !sunday && !isVacation && !isHoliday && isAbsent && "bg-red-100 dark:bg-red-900/50",
                            !sunday && !isVacation && !isAbsent && !isHoliday && hasOvertime && "bg-orange-200 dark:bg-orange-900",
                            !sunday && !isVacation && !isAbsent && hasData && !hasOvertime && !isHoliday && "bg-green-200 dark:bg-green-900",
                            // Alternating day stripes for empty cells
                            !sunday && !hasData && !isAbsent && !isHoliday && !isVacation && index % 2 === 1 && "bg-muted/30"
                          )}
                        >
                          <NoteButton employeeId={employee.id} date={day} />
                          {/* Vacation indicator overlay */}
                          {isVacation && !sunday && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-violet-700 dark:text-violet-300 font-bold text-xs opacity-80">VAC</span>
                            </div>
                          )}
                          {/* Holiday indicator overlay */}
                          {isHoliday && !sunday && !hasData && !isVacation && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-amber-700 dark:text-amber-300 font-bold text-xs opacity-80">FER</span>
                            </div>
                          )}
                          {/* Absence indicator overlay */}
                          {isAbsent && !sunday && !isVacation && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-red-700 dark:text-red-300 font-bold text-xs opacity-80">AUS</span>
                            </div>
                          )}
                          {/* Sunday work indicator overlay */}
                          {sunday && hasData && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-emerald-900 dark:text-emerald-200 font-bold text-xs opacity-60">DOM</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5">
                            {!isAbsent ? (
                              <>
                                <TimeInput
                                  value={entry?.start_time || null}
                                  onChange={(val) =>
                                    handleTimeChange(employee.id, day, "start_time", val)
                                  }
                                  defaultPeriod="AM"
                                  disabled={isVacation}
                                />
                                <TimeInput
                                  value={entry?.end_time || null}
                                  onChange={(val) =>
                                    handleTimeChange(employee.id, day, "end_time", val)
                                  }
                                  defaultPeriod={sunday ? "PM" : endTimeDefaultPeriod}
                                  disabled={isVacation}
                                />
                              </>
                            ) : (
                              <button
                                onClick={() => toggleAbsentForDay(employee.id, day)}
                                className="text-red-600 dark:text-red-400 font-bold text-sm py-2 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors"
                                title="Click para quitar ausencia"
                              >
                                AUSENTE
                              </button>
                            )}
                            {/* Toggle absent button - only show when not vacation and not already absent and not Sunday */}
                            {!isVacation && !isAbsent && !hasData && !sunday && (
                              <button
                                onClick={() => toggleAbsentForDay(employee.id, day)}
                                className="text-[10px] text-muted-foreground hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded px-1 py-0.5 transition-colors"
                                title="Marcar como ausente"
                              >
                                AUS
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center font-mono text-sm border-l border-border p-4 align-middle">
                      {regularHours.toFixed(1)}
                    </td>
                    <td className="text-center font-mono text-sm text-orange-600 p-4 align-middle">
                      {overtimeHours.toFixed(1)}
                    </td>
                    <td className="text-center font-mono text-sm text-amber-600 p-4 align-middle">
                      {holidayHours > 0 ? holidayHours.toFixed(1) : "-"}
                    </td>
                    <td className="text-center font-mono text-sm text-emerald-700 p-4 align-middle">
                      {sundayHours > 0 ? sundayHours.toFixed(1) : "-"}
                    </td>
                    {BENEFIT_TYPES.map((type) => (
                      <td key={type} className="p-1 align-middle">
                        <DebouncedNumberInput
                          value={getBenefitAmount(employee.id, type)}
                          onChange={(val) =>
                            handleBenefitChange(employee.id, type, val)
                          }
                          className="h-7 text-xs font-mono text-center w-20"
                        />
                      </td>
                    ))}
                    <td className="text-center font-mono text-sm text-red-600 p-4 align-middle">
                      {formatCurrency(deductions.tss)}
                    </td>
                    <td className="text-center font-mono text-sm text-red-600 p-4 align-middle">
                      {formatCurrency(deductions.isr)}
                    </td>
                    <td className="text-center font-mono text-sm text-red-600 p-4 align-middle">
                      {deductions.absenceDeduction > 0 
                        ? formatCurrency(deductions.absenceDeduction)
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
