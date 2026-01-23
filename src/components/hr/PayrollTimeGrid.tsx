import { useState } from "react";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TimeInput } from "./TimeInput";

interface Employee {
  id: string;
  name: string;
  salary: number;
}

interface TimesheetEntry {
  id?: string;
  employee_id: string;
  period_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  is_absent: boolean;
}

interface EmployeeBenefit {
  id: string;
  employee_id: string;
  benefit_type: string;
  amount: number;
  is_recurring: boolean;
}

interface PeriodBenefit {
  id: string;
  period_id: string;
  employee_id: string;
  benefit_type: string;
  amount: number;
}

interface PayrollTimeGridProps {
  periodId: string | null;
  startDate: Date;
  endDate: Date;
  onEmployeeClick: (employeeId: string) => void;
}

const BENEFIT_TYPES = ["Telephone", "Gasoline", "Bonus"];
const STANDARD_HOURS_PER_DAY = 8;

// DR Labor Law rates (approximate, user should verify)
const TSS_EMPLOYEE_RATE = 0.0304; // 3.04% AFP + SFS
const ISR_EXEMPTION = 34685; // Monthly exemption (DOP)

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
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, salary")
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

  // Fetch recurring employee benefits (defaults)
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

  // Fetch period-specific benefit overrides
  const { data: periodBenefits = [] } = useQuery({
    queryKey: ["period-benefits", periodId],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from("period_employee_benefits")
        .select("*")
        .eq("period_id", periodId);
      if (error) throw error;
      return data as PeriodBenefit[];
    },
    enabled: !!periodId,
  });

  // Mutation to save timesheet entry
  const saveTimesheet = useMutation({
    mutationFn: async (entry: Omit<TimesheetEntry, "id"> & { id?: string }) => {
      if (entry.id) {
        const { error } = await supabase
          .from("employee_timesheets")
          .update({
            start_time: entry.start_time,
            end_time: entry.end_time,
            is_absent: entry.is_absent,
          })
          .eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_timesheets")
          .insert(entry);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", periodId] });
    },
    onError: (error) => {
      toast.error("Failed to save time entry: " + error.message);
    },
  });

  // Mutation to save period benefit
  const savePeriodBenefit = useMutation({
    mutationFn: async (benefit: Omit<PeriodBenefit, "id"> & { id?: string }) => {
      const existing = periodBenefits.find(
        (b) =>
          b.employee_id === benefit.employee_id &&
          b.benefit_type === benefit.benefit_type
      );

      if (existing) {
        const { error } = await supabase
          .from("period_employee_benefits")
          .update({ amount: benefit.amount })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("period_employee_benefits")
          .insert({
            period_id: benefit.period_id,
            employee_id: benefit.employee_id,
            benefit_type: benefit.benefit_type,
            amount: benefit.amount,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-benefits", periodId] });
    },
    onError: (error) => {
      toast.error("Failed to save benefit: " + error.message);
    },
  });

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

    const entry: TimesheetEntry = existing
      ? { ...existing, [field]: value }
      : {
          employee_id: employeeId,
          period_id: periodId,
          work_date: dateStr,
          start_time: field === "start_time" ? value : null,
          end_time: field === "end_time" ? value : null,
          is_absent: false,
        };

    // Check if both times are empty → mark absent
    if (!entry.start_time && !entry.end_time) {
      entry.is_absent = true;
    } else {
      entry.is_absent = false;
    }

    saveTimesheet.mutate(entry);
  };

  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const calculateHoursForEmployee = (employeeId: string) => {
    const entries = timesheets.filter((t) => t.employee_id === employeeId);
    let regularHours = 0;
    let overtimeHours = 0;

    entries.forEach((t) => {
      if (t.start_time && t.end_time) {
        const start = parseTimeToMinutes(t.start_time);
        const end = parseTimeToMinutes(t.end_time);
        const hoursWorked = (end - start) / 60;

        if (hoursWorked > STANDARD_HOURS_PER_DAY) {
          regularHours += STANDARD_HOURS_PER_DAY;
          overtimeHours += hoursWorked - STANDARD_HOURS_PER_DAY;
        } else {
          regularHours += hoursWorked;
        }
      }
    });

    return { regularHours, overtimeHours, totalHours: regularHours + overtimeHours };
  };

  const getAbsenceDays = (employeeId: string) => {
    return timesheets.filter(
      (t) => t.employee_id === employeeId && t.is_absent
    ).length;
  };

  const getBenefitAmount = (employeeId: string, benefitType: string): number => {
    // Check for period override first
    const periodOverride = periodBenefits.find(
      (b) => b.employee_id === employeeId && b.benefit_type === benefitType
    );
    if (periodOverride) return periodOverride.amount;

    // Fall back to employee default
    const defaultBenefit = employeeBenefits.find(
      (b) => b.employee_id === employeeId && b.benefit_type === benefitType
    );
    return defaultBenefit?.amount || 0;
  };

  const handleBenefitChange = (
    employeeId: string,
    benefitType: string,
    value: string
  ) => {
    if (!periodId) return;
    const amount = parseFloat(value) || 0;
    savePeriodBenefit.mutate({
      period_id: periodId,
      employee_id: employeeId,
      benefit_type: benefitType,
      amount,
    });
  };

  const calculateDeductions = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return { tss: 0, isr: 0, absenceDeduction: 0 };

    const biweeklySalary = employee.salary / 2;
    const monthlySalary = employee.salary;
    const dailyRate = employee.salary / 23.83; // DR average work days

    // TSS (employee portion)
    const tss = biweeklySalary * TSS_EMPLOYEE_RATE;

    // ISR (simplified - monthly based, divided by 2)
    let isr = 0;
    if (monthlySalary > ISR_EXEMPTION) {
      // Simplified bracket (15% on excess over exemption)
      isr = ((monthlySalary - ISR_EXEMPTION) * 0.15) / 2;
    }

    // Absence deduction (prorated)
    const absenceDays = getAbsenceDays(employeeId);
    const absenceDeduction = absenceDays * dailyRate;

    return { tss, isr, absenceDeduction };
  };

  const calculateTotalBenefits = (employeeId: string) => {
    return BENEFIT_TYPES.reduce(
      (sum, type) => sum + getBenefitAmount(employeeId, type),
      0
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!periodId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Select or create a payroll period to begin
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">
              Employee
            </TableHead>
            {days.map((day) => (
              <TableHead
                key={day.toISOString()}
                className={cn(
                  "text-center min-w-[100px]",
                  isWeekend(day) && "bg-muted/50"
                )}
              >
                <div className="text-xs">{format(day, "EEE")}</div>
                <div className="font-mono">{format(day, "d")}</div>
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[60px]">Hrs</TableHead>
            <TableHead className="text-center min-w-[60px] text-orange-600">OT</TableHead>
            {BENEFIT_TYPES.map((type) => (
              <TableHead key={type} className="text-center min-w-[80px] text-green-600">
                {type}
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[80px] text-red-600">TSS</TableHead>
            <TableHead className="text-center min-w-[80px] text-red-600">ISR</TableHead>
            <TableHead className="text-center min-w-[80px] text-red-600">Absences</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const { regularHours, overtimeHours } = calculateHoursForEmployee(employee.id);
            const deductions = calculateDeductions(employee.id);

            return (
              <TableRow key={employee.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  <button
                    onClick={() => onEmployeeClick(employee.id)}
                    className="text-left hover:text-primary hover:underline focus:outline-none text-sm"
                  >
                    {employee.name}
                  </button>
                </TableCell>
                {days.map((day) => {
                  const entry = getTimesheetEntry(employee.id, day);
                  const weekend = isWeekend(day);
                  return (
                    <TableCell
                      key={day.toISOString()}
                      className={cn(
                        "p-1 text-center",
                        weekend && "bg-muted/30",
                        entry?.is_absent && "bg-destructive/10"
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <TimeInput
                          value={entry?.start_time || null}
                          onChange={(val) =>
                            handleTimeChange(employee.id, day, "start_time", val)
                          }
                        />
                        <TimeInput
                          value={entry?.end_time || null}
                          onChange={(val) =>
                            handleTimeChange(employee.id, day, "end_time", val)
                          }
                        />
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-mono text-sm">
                  {regularHours.toFixed(1)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm text-orange-600">
                  {overtimeHours.toFixed(1)}
                </TableCell>
                {BENEFIT_TYPES.map((type) => (
                  <TableCell key={type} className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={getBenefitAmount(employee.id, type) || ""}
                      onChange={(e) =>
                        handleBenefitChange(employee.id, type, e.target.value)
                      }
                      className="h-7 text-xs font-mono text-center w-20"
                      placeholder="0.00"
                    />
                  </TableCell>
                ))}
                <TableCell className="text-center font-mono text-sm text-red-600">
                  {formatCurrency(deductions.tss)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm text-red-600">
                  {formatCurrency(deductions.isr)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm text-red-600">
                  {deductions.absenceDeduction > 0 
                    ? formatCurrency(deductions.absenceDeduction)
                    : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
