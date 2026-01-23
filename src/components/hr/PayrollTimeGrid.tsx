import { useState, useEffect } from "react";
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

interface PayrollTimeGridProps {
  periodId: string | null;
  startDate: Date;
  endDate: Date;
  onEmployeeClick: (employeeId: string) => void;
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
    value: string
  ) => {
    if (!periodId) return;

    const existing = getTimesheetEntry(employeeId, date);
    const dateStr = format(date, "yyyy-MM-dd");

    const entry: TimesheetEntry = existing
      ? { ...existing, [field]: value || null }
      : {
          employee_id: employeeId,
          period_id: periodId,
          work_date: dateStr,
          start_time: field === "start_time" ? value || null : null,
          end_time: field === "end_time" ? value || null : null,
          is_absent: false,
        };

    // Check if both times are empty or null → mark absent
    if (!entry.start_time && !entry.end_time) {
      entry.is_absent = true;
    } else {
      entry.is_absent = false;
    }

    saveTimesheet.mutate(entry);
  };

  const calculateTotalHours = (employeeId: string) => {
    return timesheets
      .filter((t) => t.employee_id === employeeId)
      .reduce((total, t) => {
        if (t.start_time && t.end_time) {
          const start = parseTimeToMinutes(t.start_time);
          const end = parseTimeToMinutes(t.end_time);
          return total + (end - start) / 60;
        }
        return total;
      }, 0);
  };

  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
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
            <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
              Employee
            </TableHead>
            {days.map((day) => (
              <TableHead
                key={day.toISOString()}
                className={cn(
                  "text-center min-w-[70px]",
                  isWeekend(day) && "bg-muted/50"
                )}
              >
                <div className="text-xs">{format(day, "EEE")}</div>
                <div className="font-mono">{format(day, "d")}</div>
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[80px]">Total Hrs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                <button
                  onClick={() => onEmployeeClick(employee.id)}
                  className="text-left hover:text-primary hover:underline focus:outline-none"
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
                      <Input
                        type="time"
                        value={entry?.start_time || ""}
                        onChange={(e) =>
                          handleTimeChange(
                            employee.id,
                            day,
                            "start_time",
                            e.target.value
                          )
                        }
                        className="h-6 text-xs px-1 font-mono"
                        placeholder="--:--"
                      />
                      <Input
                        type="time"
                        value={entry?.end_time || ""}
                        onChange={(e) =>
                          handleTimeChange(
                            employee.id,
                            day,
                            "end_time",
                            e.target.value
                          )
                        }
                        className="h-6 text-xs px-1 font-mono"
                        placeholder="--:--"
                      />
                    </div>
                  </TableCell>
                );
              })}
              <TableCell className="text-center font-mono font-medium">
                {calculateTotalHours(employee.id).toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
