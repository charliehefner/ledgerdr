import React, { useState, useMemo } from "react";
import { format, eachDayOfInterval, isWeekend, isSaturday } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

// Position display order for grouping (field workers first, management last)
const POSITION_ORDER = [
  "Obrero",
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
}

interface EmployeeBenefit {
  id: string;
  employee_id: string;
  benefit_type: string;
  amount: number;
  is_recurring: boolean;
}

interface PayrollTimeGridProps {
  periodId: string | null;
  startDate: Date;
  endDate: Date;
  onEmployeeClick: (employeeId: string) => void;
}

const BENEFIT_TYPES = ["Telephone", "Gasoline", "Bonus"];

// Standard work hours: 7:30 AM to 4:30 PM (9 hours, minus 1 hour lunch = 8 hours)
const STANDARD_START = 7 * 60 + 30; // 7:30 AM in minutes
const STANDARD_END = 16 * 60 + 30;  // 4:30 PM in minutes
const STANDARD_HOURS_PER_DAY = 8;   // After lunch deduction

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
      toast.error("Failed to save time entry: " + error.message);
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
      toast.error("Failed to save benefit: " + error.message);
    },
  });

  // Auto-fill standard hours for salaried positions
  const autoFillSalariedEmployees = async () => {
    if (!periodId) return;

    const salariedEmployees = employees.filter((e) =>
      SALARIED_POSITIONS.includes(e.position)
    );

    if (salariedEmployees.length === 0) {
      toast.info("No salaried employees to auto-fill");
      return;
    }

    try {
      const entries: Omit<TimesheetEntry, "id">[] = [];

      for (const employee of salariedEmployees) {
        for (const day of days) {
          // Skip weekends
          if (isWeekend(day)) continue;

          const dateStr = format(day, "yyyy-MM-dd");
          entries.push({
            employee_id: employee.id,
            period_id: periodId,
            work_date: dateStr,
            start_time: "07:30",
            end_time: "16:30",
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
      toast.success(`Auto-filled ${salariedEmployees.length} salaried employee(s)`);
    } catch (error: any) {
      toast.error("Failed to auto-fill: " + error.message);
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

    // Check if both times are empty → mark absent
    if (!entry.start_time && !entry.end_time) {
      entry.is_absent = true;
    } else {
      entry.is_absent = false;
    }

    saveTimesheet.mutate(entry);
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
      toast.success(newHolidayStatus ? "Day marked as holiday (100% bonus)" : "Holiday status removed");
    } catch (error: any) {
      toast.error("Failed to toggle holiday: " + error.message);
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

  // Calculate hours: regular is within 7:30am-4:30pm, overtime is outside, holiday hours tracked separately
  const calculateHoursForEmployee = (employeeId: string) => {
    const entries = timesheets.filter((t) => t.employee_id === employeeId);
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;

    entries.forEach((t) => {
      if (t.start_time && t.end_time) {
        const start = parseTimeToMinutes(t.start_time);
        const end = parseTimeToMinutes(t.end_time);
        
        // Total hours worked this day (minus 1 hour lunch if full day)
        const totalDayHours = Math.min((end - start) / 60, STANDARD_HOURS_PER_DAY);
        
        // If this is a holiday, all hours get holiday pay bonus
        if (t.is_holiday) {
          holidayHours += totalDayHours;
        }
        
        // Calculate regular hours (within standard window)
        const regularStart = Math.max(start, STANDARD_START);
        const regularEnd = Math.min(end, STANDARD_END);
        
        if (regularEnd > regularStart) {
          // Cap at 8 hours (lunch deducted)
          const rawRegular = (regularEnd - regularStart) / 60;
          regularHours += Math.min(rawRegular, STANDARD_HOURS_PER_DAY);
        }
        
        // Calculate overtime (before 7:30am or after 4:30pm)
        if (start < STANDARD_START) {
          overtimeHours += (STANDARD_START - start) / 60;
        }
        if (end > STANDARD_END) {
          overtimeHours += (end - STANDARD_END) / 60;
        }
      }
    });

    return { regularHours, overtimeHours, holidayHours, totalHours: regularHours + overtimeHours };
  };

  const getAbsenceDays = (employeeId: string) => {
    return timesheets.filter(
      (t) => t.employee_id === employeeId && t.is_absent
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
    const amount = parseFloat(value) || 0;
    saveEmployeeBenefit.mutate({
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
      groups.push({ position: "Other", employees: otherEmployees });
    }
    
    return groups;
  }, [employees]);

  if (!periodId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Select or create a payroll period to begin
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
            Auto-fill Salaried Staff
          </Button>
        </div>
      )}
      <div className="overflow-auto max-h-[70vh] border rounded-lg">
        <table className="w-full caption-bottom text-sm table-auto">
        <thead className="sticky top-0 z-20 bg-background shadow-sm border-b">
          <tr>
            <th className="sticky left-0 bg-background z-30 min-w-[140px] h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
              Employee
            </th>
            {days.map((day, index) => {
              const isHoliday = isDayHoliday(day);
              return (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "text-center min-w-[100px] h-16 px-4 align-middle font-medium text-muted-foreground whitespace-nowrap",
                    isWeekend(day) && "bg-muted",
                    !isWeekend(day) && isHoliday && "bg-amber-100 dark:bg-amber-950/40",
                    !isWeekend(day) && !isHoliday && index % 2 === 1 && "bg-muted/40",
                    !isWeekend(day) && !isHoliday && index % 2 === 0 && "bg-background"
                  )}
                >
                  <div className="text-xs">{format(day, "EEE")}</div>
                  <div className="font-mono">{format(day, "d")}</div>
                  {!isWeekend(day) && (
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
                        Holiday
                      </label>
                    </div>
                  )}
                </th>
              );
            })}
            <th className="text-center min-w-[60px] bg-background h-12 px-4 align-middle font-medium text-muted-foreground whitespace-nowrap">Hrs</th>
            <th className="text-center min-w-[60px] text-orange-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">OT</th>
            <th className="text-center min-w-[60px] text-amber-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">Hol</th>
            {BENEFIT_TYPES.map((type) => (
              <th key={type} className="text-center min-w-[80px] text-green-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">
                {type}
              </th>
            ))}
            <th className="text-center min-w-[80px] text-red-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">TSS</th>
            <th className="text-center min-w-[80px] text-red-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">ISR</th>
            <th className="text-center min-w-[80px] text-red-600 bg-background h-12 px-4 align-middle font-medium whitespace-nowrap">Absences</th>
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
                const { regularHours, overtimeHours, holidayHours } = calculateHoursForEmployee(employee.id);
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
                      const weekend = isWeekend(day);
                      const saturday = isSaturday(day);
                      const endTimeDefaultPeriod = saturday ? "AM" : "PM";
                      const isHoliday = entry?.is_holiday;
                      
                      // Determine cell status for coloring
                      const hasData = entry?.start_time && entry?.end_time;
                      // Absent = has entry but no times (explicitly marked absent)
                      const isAbsent = entry?.is_absent || (entry && !entry.start_time && !entry.end_time);
                      const hasOvertime = hasData && entry?.end_time && parseTimeToMinutes(entry.end_time) > STANDARD_END;
                      
                      return (
                        <td
                          key={day.toISOString()}
                          className={cn(
                            "p-1 text-center border-r border-border/30 align-middle relative",
                            // Weekend styling
                            weekend && "bg-muted/60",
                            // Status-based colors (priority order)
                            !weekend && isAbsent && "bg-red-200 dark:bg-red-950/50",
                            !weekend && !isAbsent && isHoliday && hasData && "bg-amber-100 dark:bg-amber-950/40",
                            !weekend && !isAbsent && hasOvertime && "bg-orange-50 dark:bg-orange-950/20",
                            !weekend && !isAbsent && hasData && !hasOvertime && !isHoliday && "bg-green-50 dark:bg-green-950/20",
                            // Alternating day stripes for empty cells
                            !weekend && !hasData && !isAbsent && index % 2 === 1 && "bg-muted/30"
                          )}
                        >
                          {/* Absence indicator overlay */}
                          {isAbsent && !weekend && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-red-600 font-bold text-xs opacity-60">ABS</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5">
                            <TimeInput
                              value={entry?.start_time || null}
                              onChange={(val) =>
                                handleTimeChange(employee.id, day, "start_time", val)
                              }
                              defaultPeriod="AM"
                            />
                            <TimeInput
                              value={entry?.end_time || null}
                              onChange={(val) =>
                                handleTimeChange(employee.id, day, "end_time", val)
                              }
                              defaultPeriod={endTimeDefaultPeriod}
                            />
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
                    {BENEFIT_TYPES.map((type) => (
                      <td key={type} className="p-1 align-middle">
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
