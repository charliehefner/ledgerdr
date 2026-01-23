import { useState } from "react";
import { format, startOfMonth, endOfMonth, setDate, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayrollPeriodSelectorProps {
  selectedPeriod: { startDate: Date; endDate: Date };
  onPeriodChange: (period: { startDate: Date; endDate: Date }) => void;
}

export function PayrollPeriodSelector({
  selectedPeriod,
  onPeriodChange,
}: PayrollPeriodSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedPeriod.startDate);

  const getPeriodOptions = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const lastDay = monthEnd.getDate();

    return [
      {
        label: `1 - 15 ${format(month, "MMM yyyy")}`,
        startDate: setDate(monthStart, 1),
        endDate: setDate(monthStart, 15),
        value: "first",
      },
      {
        label: `16 - ${lastDay} ${format(month, "MMM yyyy")}`,
        startDate: setDate(monthStart, 16),
        endDate: monthEnd,
        value: "second",
      },
    ];
  };

  const periods = getPeriodOptions(currentMonth);

  const getCurrentPeriodValue = () => {
    const day = selectedPeriod.startDate.getDate();
    return day <= 15 ? "first" : "second";
  };

  const handlePeriodSelect = (value: string) => {
    const period = periods.find((p) => p.value === value);
    if (period) {
      onPeriodChange({ startDate: period.startDate, endDate: period.endDate });
    }
  };

  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    setCurrentMonth(prevMonth);
    // Select second half of previous month
    const monthEnd = endOfMonth(prevMonth);
    onPeriodChange({
      startDate: setDate(startOfMonth(prevMonth), 16),
      endDate: monthEnd,
    });
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    setCurrentMonth(nextMonth);
    // Select first half of next month
    onPeriodChange({
      startDate: setDate(startOfMonth(nextMonth), 1),
      endDate: setDate(startOfMonth(nextMonth), 15),
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handlePrevMonth}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={getCurrentPeriodValue()} onValueChange={handlePeriodSelect}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" size="icon" onClick={handleNextMonth}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="text-sm text-muted-foreground ml-2">
        Payment: {format(selectedPeriod.endDate, "MMM d, yyyy")}
      </span>
    </div>
  );
}
