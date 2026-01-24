import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  defaultPeriod?: "AM" | "PM";
}

// Convert 24hr to 12hr format
function to12Hour(time24: string | null): { hours: string; minutes: string; period: "AM" | "PM" } {
  if (!time24) return { hours: "", minutes: "", period: "AM" };
  
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hours12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  
  return {
    hours: hours12.toString(),
    minutes: m.toString().padStart(2, "0"),
    period,
  };
}

// Convert 12hr to 24hr format
function to24Hour(hours: string, minutes: string, period: "AM" | "PM"): string | null {
  if (!hours || !minutes) return null;
  
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  
  if (isNaN(h) || isNaN(m)) return null;
  
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function TimeInput({ value, onChange, className, defaultPeriod = "AM" }: TimeInputProps) {
  const parsed = to12Hour(value);
  const [hours, setHours] = useState(parsed.hours);
  const [minutes, setMinutes] = useState(parsed.minutes);
  const [period, setPeriod] = useState<"AM" | "PM">(value ? parsed.period : defaultPeriod);

  useEffect(() => {
    const parsed = to12Hour(value);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
    // Only set period from value if value exists, otherwise keep default
    if (value) {
      setPeriod(parsed.period);
    }
  }, [value]);

  const handleChange = (newHours: string, newMinutes: string, newPeriod: "AM" | "PM") => {
    // Treat "0" as clearing the field (mark as absent)
    if (newHours === "0") {
      setHours("");
      setMinutes("");
      onChange(null);
      return;
    }
    
    // Validate hours (1-12)
    if (newHours && (parseInt(newHours) < 1 || parseInt(newHours) > 12)) return;
    // Validate minutes (0-59)
    if (newMinutes && (parseInt(newMinutes) < 0 || parseInt(newMinutes) > 59)) return;
    
    setHours(newHours);
    setMinutes(newMinutes);
    setPeriod(newPeriod);

    if (newHours && newMinutes) {
      const time24 = to24Hour(newHours, newMinutes, newPeriod);
      onChange(time24);
    } else if (!newHours && !newMinutes) {
      onChange(null);
    }
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="--"
        value={hours}
        onChange={(e) => handleChange(e.target.value.replace(/\D/g, ""), minutes, period)}
        className="h-6 w-7 text-xs px-1 font-mono text-center"
      />
      <span className="text-xs text-muted-foreground">:</span>
      <Input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="--"
        value={minutes}
        onChange={(e) => handleChange(hours, e.target.value.replace(/\D/g, ""), period)}
        className="h-6 w-7 text-xs px-1 font-mono text-center"
      />
      <Select value={period} onValueChange={(v) => handleChange(hours, minutes, v as "AM" | "PM")}>
        <SelectTrigger className="h-6 w-12 text-xs px-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
