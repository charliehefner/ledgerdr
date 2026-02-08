import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, subWeeks, getDay, eachDayOfInterval, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2, Copy, ClipboardPaste, Download, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateLocal, parseDateLocal } from "@/lib/dateUtils";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Owner user ID (cedenojord) - changes by this user won't be highlighted
const SCHEDULE_OWNER_ID = "3976a9b9-ac8e-4afb-a4cb-2efcc02c2e80";

// Admin user IDs (instructor) - changes by these users won't be highlighted
const ADMIN_USER_IDS = [
  "27ffb3e6-f18d-448d-8a4b-b5babf7f1b06",
  "b2a33a75-b63c-48e1-a252-7ab843f559d5",
];

type CronogramaEntry = {
  id: string;
  week_ending_date: string;
  worker_type: "employee" | "jornalero";
  worker_id: string | null;
  worker_name: string;
  day_of_week: number;
  time_slot: "morning" | "afternoon";
  task: string | null;
  is_vacation: boolean;
  is_holiday: boolean;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
};

type WorkerRow = {
  type: "employee" | "jornalero";
  id: string | null;
  name: string;
  isTemp?: boolean;
};

// Get Saturday of the week for a given date
function getSaturdayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const saturday = new Date(date);
  saturday.setDate(date.getDate() + daysUntilSaturday);
  return saturday;
}

// Get Monday of the week for a given date
function getMondayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysFromMonday);
  return monday;
}

// Define holidays (can be expanded)
const HOLIDAYS_2025 = [
  "2025-01-01", // New Year
  "2025-01-06", // Epiphany
  "2025-01-21", // Altagracia
  "2025-01-26", // Duarte
  "2025-02-27", // Independence
  "2025-04-18", // Good Friday
  "2025-05-01", // Labor Day
  "2025-06-19", // Corpus Christi
  "2025-08-16", // Restoration
  "2025-09-24", // Virgen de las Mercedes
  "2025-11-06", // Constitution
  "2025-12-25", // Christmas
];

function isHoliday(dateStr: string): boolean {
  return HOLIDAYS_2025.includes(dateStr);
}

// Fetch user emails for tooltips
async function fetchUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  
  try {
    const { data, error } = await supabase.functions.invoke("get-users", {
      body: {},
    });
    if (error || !data?.users) return new Map();
    
    const emailMap = new Map<string, string>();
    data.users.forEach((u: { id: string; email: string }) => {
      emailMap.set(u.id, u.email);
    });
    return emailMap;
  } catch {
    return new Map();
  }
}

export function CronogramaGrid() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const locale = language === "es" ? es : enUS;
  
  const [selectedSaturday, setSelectedSaturday] = useState(() => getSaturdayOfWeek(new Date()));
  const [additionalRows, setAdditionalRows] = useState<WorkerRow[]>([]);
  const [copiedTask, setCopiedTask] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  
  const weekEndingDate = formatDateLocal(selectedSaturday);
  const weekStart = getMondayOfWeek(selectedSaturday);
  const weekDays = eachDayOfInterval({ start: weekStart, end: selectedSaturday });
  
  const isSaturday = getDay(new Date()) === 6;

  // Position priority for Cronograma ordering
  const positionPriority: Record<string, number> = {
    'Tractorista': 1,
    'Obrero': 2,
    'Volteador': 3,
    'Sereno': 4,
    'Supervisor': 5,
    'Administrativa': 6,
    'Gerencia': 7,
  };

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active-cronograma"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, position")
        .eq("is_active", true);
      if (error) throw error;
      
      // Sort by position priority, then by name
      return data.sort((a, b) => {
        const priorityA = positionPriority[a.position] ?? 99;
        const priorityB = positionPriority[b.position] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name);
      });
    },
  });

  // Fetch jornaleros for dropdown
  const { data: jornaleros = [] } = useQuery({
    queryKey: ["jornaleros-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornaleros")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch vacations for the week
  const { data: vacations = [] } = useQuery({
    queryKey: ["vacations-week", weekEndingDate],
    queryFn: async () => {
      const weekStartStr = formatDateLocal(weekStart);
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("employee_id, start_date, end_date")
        .lte("start_date", weekEndingDate)
        .gte("end_date", weekStartStr);
      if (error) throw error;
      return data;
    },
  });

  // Fetch cronograma entries for the week
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cronograma-entries", weekEndingDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_entries")
        .select("*")
        .eq("week_ending_date", weekEndingDate);
      if (error) throw error;
      return data as CronogramaEntry[];
    },
  });

  // Fetch user emails for displaying in tooltips
  const { data: userEmailMap = new Map<string, string>() } = useQuery({
    queryKey: ["user-emails-cronograma", entries.map(e => e.updated_by).filter(Boolean)],
    queryFn: async () => {
      const userIds = entries.map(e => e.updated_by).filter(Boolean) as string[];
      return fetchUserEmails(userIds);
    },
    enabled: entries.length > 0,
  });

  // Fetch week status
  const { data: weekStatus } = useQuery({
    queryKey: ["cronograma-week", weekEndingDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_weeks")
        .select("*")
        .eq("week_ending_date", weekEndingDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isWeekClosed = weekStatus?.is_closed ?? false;

  // Initialize additional rows from entries that are jornaleros
  useEffect(() => {
    const jornaleroEntries = entries.filter(e => e.worker_type === "jornalero");
    const uniqueJornaleros = new Map<string, WorkerRow>();
    jornaleroEntries.forEach(e => {
      const key = e.worker_id || e.worker_name;
      if (!uniqueJornaleros.has(key)) {
        uniqueJornaleros.set(key, {
          type: "jornalero",
          id: e.worker_id,
          name: e.worker_name,
        });
      }
    });
    setAdditionalRows(Array.from(uniqueJornaleros.values()));
  }, [entries]);

  // Mutation for upserting entries
  const upsertMutation = useMutation({
    mutationFn: async (entry: Partial<CronogramaEntry> & { 
      week_ending_date: string;
      worker_type: "employee" | "jornalero";
      worker_name: string;
      day_of_week: number;
      time_slot: "morning" | "afternoon";
    }) => {
      const currentUserId = user?.id || null;
      
      // Find existing entry
      const existing = entries.find(
        e => e.worker_name === entry.worker_name && 
             e.day_of_week === entry.day_of_week && 
             e.time_slot === entry.time_slot
      );

      if (existing) {
        const { error } = await supabase
          .from("cronograma_entries")
          .update({ task: entry.task, updated_by: currentUserId })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cronograma_entries")
          .insert({
            ...entry,
            created_by: currentUserId,
            updated_by: currentUserId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cronograma-entries", weekEndingDate] });
    },
  });

  // Close week mutation
  const closeWeekMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("cronograma_weeks")
        .select("id")
        .eq("week_ending_date", weekEndingDate)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cronograma_weeks")
          .update({ is_closed: true, closed_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cronograma_weeks")
          .insert({ week_ending_date: weekEndingDate, is_closed: true, closed_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cronograma-week", weekEndingDate] });
      toast.success(t("cronograma.weekClosed"));
    },
  });

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedSaturday(prev => 
      direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
    setAdditionalRows([]);
  };

  const isEmployeeOnVacation = (employeeId: string, date: Date): boolean => {
    return vacations.some(v => {
      if (v.employee_id !== employeeId) return false;
      const start = parseDateLocal(v.start_date);
      const end = parseDateLocal(v.end_date);
      return isWithinInterval(date, { start, end });
    });
  };

  const getCellValue = (workerName: string, dayOfWeek: number, timeSlot: "morning" | "afternoon"): string => {
    const entry = entries.find(
      e => e.worker_name === workerName && e.day_of_week === dayOfWeek && e.time_slot === timeSlot
    );
    return entry?.task || "";
  };

  const handleCellChange = (
    worker: WorkerRow,
    dayOfWeek: number,
    timeSlot: "morning" | "afternoon",
    value: string
  ) => {
    if (isWeekClosed) return;
    
    upsertMutation.mutate({
      week_ending_date: weekEndingDate,
      worker_type: worker.type,
      worker_id: worker.id,
      worker_name: worker.name,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
      task: value || null,
      is_vacation: false,
      is_holiday: false,
    });
  };

  const handleCopy = (value: string) => {
    setCopiedTask(value);
    toast.success(t("cronograma.taskCopied"));
  };

  const handlePaste = (worker: WorkerRow, dayOfWeek: number, timeSlot: "morning" | "afternoon") => {
    if (copiedTask && !isWeekClosed) {
      handleCellChange(worker, dayOfWeek, timeSlot, copiedTask);
    }
  };

  const addJornaleroRow = () => {
    setAdditionalRows(prev => [...prev, { type: "jornalero", id: null, name: "", isTemp: true }]);
  };

  const updateJornaleroRow = (index: number, jornaleroId: string) => {
    const jornalero = jornaleros.find(j => j.id === jornaleroId);
    if (jornalero) {
      setAdditionalRows(prev => {
        const updated = [...prev];
        updated[index] = { type: "jornalero", id: jornalero.id, name: jornalero.name };
        return updated;
      });
    }
  };

  const removeJornaleroRow = (index: number) => {
    setAdditionalRows(prev => prev.filter((_, i) => i !== index));
  };

  // Build worker rows: employees first, then additional jornaleros
  const allWorkerRows: WorkerRow[] = [
    ...employees.map(e => ({ type: "employee" as const, id: e.id, name: e.name })),
    ...additionalRows,
  ];

  const dayLabels = language === "es" 
    ? ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const fullDayLabels = language === "es"
    ? ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Export to Excel
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(language === "es" ? "Cronograma" : "Schedule");

    // Title row
    const titleText = language === "es" 
      ? `Cronograma - Semana ${format(weekStart, "d/M")} al ${format(selectedSaturday, "d/M/yyyy")}`
      : `Schedule - Week ${format(weekStart, "M/d")} to ${format(selectedSaturday, "M/d/yyyy")}`;
    worksheet.addRow([titleText]);
    worksheet.mergeCells(1, 1, 1, 13);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 14 };
    titleRow.height = 24;
    titleRow.alignment = { vertical: "middle" };

    // Empty row
    worksheet.addRow([]);

    // Header row 1 - Day names
    const headerRow1 = [language === "es" ? "Trabajador" : "Worker"];
    weekDays.forEach((day, idx) => {
      headerRow1.push(`${fullDayLabels[idx]} ${format(day, "d/M")}`);
      headerRow1.push(""); // Will be merged
    });
    worksheet.addRow(headerRow1);

    // Merge day header cells
    for (let i = 0; i < 6; i++) {
      const startCol = 2 + (i * 2);
      worksheet.mergeCells(3, startCol, 3, startCol + 1);
    }

    // Header row 2 - AM/PM
    const headerRow2 = [""];
    weekDays.forEach(() => {
      headerRow2.push("AM");
      headerRow2.push("PM");
    });
    worksheet.addRow(headerRow2);

    // Style headers
    const dayColors = ["FFD6E3F0", "FFE8EDF3"]; // Light blue alternating
    [3, 4].forEach((rowNum) => {
      const row = worksheet.getRow(rowNum);
      row.font = { bold: true };
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.height = 20;
      
      // Worker column
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      row.getCell(1).border = { bottom: { style: "medium" }, right: { style: "thin" }, left: { style: "thin" }, top: { style: "thin" } };
      
      // Day columns with alternating colors
      for (let i = 0; i < 6; i++) {
        const color = dayColors[i % 2];
        const col1 = 2 + (i * 2);
        const col2 = col1 + 1;
        [col1, col2].forEach((c) => {
          row.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: color },
          };
          row.getCell(c).border = { bottom: { style: "medium" }, right: { style: "thin" }, left: { style: "thin" }, top: { style: "thin" } };
        });
      }
    });

    // Data rows
    let dataRowNum = 5;
    allWorkerRows.forEach((worker) => {
      if (worker.isTemp && !worker.id) return;
      
      const rowData = [worker.name];
      weekDays.forEach((day, idx) => {
        const dayNum = idx + 1;
        const amEntry = getEntryForCell(worker, dayNum, "morning");
        const pmEntry = getEntryForCell(worker, dayNum, "afternoon");
        rowData.push(amEntry?.task || "");
        rowData.push(pmEntry?.task || "");
      });
      worksheet.addRow(rowData);
      
      // Style data row
      const row = worksheet.getRow(dataRowNum);
      row.alignment = { vertical: "top", wrapText: true };
      row.height = 28;
      
      // Worker name column
      row.getCell(1).font = { bold: true };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      row.getCell(1).border = { bottom: { style: "thin" }, right: { style: "thin" }, left: { style: "thin" } };
      
      // Day columns with alternating colors
      for (let i = 0; i < 6; i++) {
        const color = i % 2 === 0 ? "FFE8F0F8" : "FFFFFFFF"; // Light blue / white
        const col1 = 2 + (i * 2);
        const col2 = col1 + 1;
        [col1, col2].forEach((c) => {
          row.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: color },
          };
          row.getCell(c).border = { bottom: { style: "thin" }, right: { style: "thin" }, left: { style: "thin" } };
        });
      }
      
      dataRowNum++;
    });

    // Column widths
    worksheet.getColumn(1).width = 22;
    for (let i = 2; i <= 13; i++) {
      worksheet.getColumn(i).width = 16;
    }

    // Generate file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cronograma_${format(selectedSaturday, "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(language === "es" ? "Excel exportado" : "Excel exported");
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    
    // Title
    const title = language === "es" 
      ? `Cronograma - Semana ${format(weekStart, "d/M")} al ${format(selectedSaturday, "d/M/yyyy")}`
      : `Schedule - Week ${format(weekStart, "M/d")} to ${format(selectedSaturday, "M/d/yyyy")}`;
    doc.setFontSize(14);
    doc.text(title, 14, 15);

    // Table headers
    const headers = [[language === "es" ? "Trabajador" : "Worker"]];
    weekDays.forEach((day, idx) => {
      headers[0].push(`${dayLabels[idx]} ${format(day, "d/M")} AM`);
      headers[0].push(`${dayLabels[idx]} ${format(day, "d/M")} PM`);
    });

    // Table data
    const data: string[][] = [];
    allWorkerRows.forEach((worker) => {
      if (worker.isTemp && !worker.id) return;
      
      const row = [worker.name];
      weekDays.forEach((day, idx) => {
        const dayNum = idx + 1;
        const amEntry = getEntryForCell(worker, dayNum, "morning");
        const pmEntry = getEntryForCell(worker, dayNum, "afternoon");
        row.push(amEntry?.task || "");
        row.push(pmEntry?.task || "");
      });
      data.push(row);
    });

    // Alternating day colors for PDF
    const lightBlue: [number, number, number] = [232, 240, 248];
    const white: [number, number, number] = [255, 255, 255];

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 22,
      styles: { fontSize: 7, cellPadding: 2, minCellHeight: 8 },
      headStyles: { fillColor: [70, 100, 140], textColor: 255, fontStyle: "bold" },
      columnStyles: { 
        0: { cellWidth: 28, fontStyle: "bold" },
      },
      theme: "grid",
      didParseCell: (hookData) => {
        // Apply alternating column colors
        if (hookData.section === "body" && hookData.column.index > 0) {
          const dayIndex = Math.floor((hookData.column.index - 1) / 2);
          hookData.cell.styles.fillColor = dayIndex % 2 === 0 ? lightBlue : white;
        }
      },
    });

    doc.save(`cronograma_${format(selectedSaturday, "yyyy-MM-dd")}.pdf`);
    toast.success(language === "es" ? "PDF exportado" : "PDF exported");
  };

  // Get entry for a cell
  const getEntryForCell = (worker: WorkerRow, dayOfWeek: number, timeSlot: "morning" | "afternoon") => {
    return entries.find(
      (e) =>
        e.worker_name === worker.name &&
        e.worker_type === worker.type &&
        e.day_of_week === dayOfWeek &&
        e.time_slot === timeSlot
    );
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <div className="font-medium">
              {format(weekStart, "d MMM", { locale })} - {format(selectedSaturday, "d MMM yyyy", { locale })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("cronograma.weekEnding")}: {format(selectedSaturday, "EEEE d", { locale })}
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-excel text-excel-foreground hover:bg-excel/90">
                <Download className="h-4 w-4 mr-2" />
                {t("common.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isWeekClosed ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>{t("cronograma.closed")}</span>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={addJornaleroRow}>
                <Plus className="h-4 w-4 mr-2" />
                {t("cronograma.addJornalero")}
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setShowCloseConfirm(true)}
                disabled={!isSaturday}
                title={!isSaturday ? t("cronograma.closeOnSaturday") : ""}
              >
                <Lock className="h-4 w-4 mr-2" />
                {t("cronograma.closeWeek")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Copied task indicator */}
      {copiedTask && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded inline-flex items-center gap-2">
          <Copy className="h-3 w-3" />
          {t("cronograma.copiedTask")}: "{copiedTask.substring(0, 30)}{copiedTask.length > 30 ? '...' : ''}"
        </div>
      )}

      {/* Schedule Grid */}
      <ScrollArea className="w-full">
        <div className="min-w-[900px]">
          <table className="w-full border-collapse text-sm" style={{ borderSpacing: 0 }}>
            <thead className="border-b-[4px] border-foreground/40">
              <tr>
                <th className="border-2 border-border bg-muted/50 p-2 text-left font-medium sticky left-0 z-10 min-w-[150px]">
                  {t("cronograma.worker")}
                </th>
                {weekDays.map((day, idx) => {
                  const dateStr = formatDateLocal(day);
                  const isHol = isHoliday(dateStr);
                  const dayNum = idx + 1; // 1-6 for Mon-Sat
                  
                  return (
                    <th 
                      key={idx} 
                      colSpan={2}
                      className={cn(
                        "border-2 border-border p-2 text-center font-medium",
                        idx % 2 === 0 ? "bg-secondary" : "bg-muted",
                        isHol && "bg-amber-100 dark:bg-amber-900/30"
                      )}
                    >
                      <div>{dayLabels[idx]}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {format(day, "d/M")}
                      </div>
                      {isHol && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 font-normal">
                          {t("cronograma.holiday")}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="border-2 border-border bg-muted/50 p-1 text-xs sticky left-0 z-10"></th>
                {weekDays.map((_, idx) => (
                  <>
                    <th key={`am-${idx}`} className={cn(
                      "border border-border p-1 text-xs font-normal",
                      idx % 2 === 0 ? "bg-secondary" : "bg-muted"
                    )}>
                      {t("cronograma.morning")}
                    </th>
                    <th key={`pm-${idx}`} className={cn(
                      "border border-border border-r-[3px] p-1 text-xs font-normal",
                      idx % 2 === 0 ? "bg-secondary" : "bg-muted"
                    )}>
                      {t("cronograma.afternoon")}
                    </th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {allWorkerRows.map((worker, rowIdx) => {
                const isJornaleroTemp = worker.type === "jornalero" && worker.isTemp;
                const jornaleroIndex = additionalRows.findIndex(r => r === worker);

                return (
                  <tr key={`${worker.type}-${worker.id || rowIdx}`} className="border-b-[3px] border-border">
                    <td className="border-2 border-border p-2 font-medium sticky left-0 bg-background z-10 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        {isJornaleroTemp ? (
                          <>
                            <Select onValueChange={(val) => updateJornaleroRow(jornaleroIndex, val)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={t("cronograma.selectJornalero")} />
                              </SelectTrigger>
                              <SelectContent>
                                {jornaleros.map(j => (
                                  <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeJornaleroRow(jornaleroIndex)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="truncate">{worker.name}</span>
                            {worker.type === "jornalero" && jornaleroIndex >= 0 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive shrink-0"
                                onClick={() => removeJornaleroRow(jornaleroIndex)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const dateStr = formatDateLocal(day);
                      const isHol = isHoliday(dateStr);
                      const dayNum = dayIdx + 1;
                      const isOnVacation = worker.type === "employee" && worker.id && isEmployeeOnVacation(worker.id, day);

                      const morningEntry = getEntryForCell(worker, dayNum, "morning");
                      const afternoonEntry = getEntryForCell(worker, dayNum, "afternoon");

                      return (
                        <>
                          {/* Morning cell */}
                          <CronogramaCell
                            key={`${rowIdx}-${dayIdx}-am`}
                            worker={worker}
                            dayOfWeek={dayNum}
                            timeSlot="morning"
                            value={getCellValue(worker.name, dayNum, "morning")}
                            onChange={(val) => handleCellChange(worker, dayNum, "morning", val)}
                            onCopy={handleCopy}
                            onPaste={() => handlePaste(worker, dayNum, "morning")}
                            hasCopied={!!copiedTask}
                            isHoliday={isHol}
                            isVacation={isOnVacation}
                            isDisabled={isWeekClosed || isJornaleroTemp}
                            dayShade={dayIdx % 2 === 0}
                            isLastOfDay={false}
                            t={t}
                            entry={morningEntry}
                            userEmailMap={userEmailMap}
                            language={language}
                          />
                          {/* Afternoon cell */}
                          <CronogramaCell
                            key={`${rowIdx}-${dayIdx}-pm`}
                            worker={worker}
                            dayOfWeek={dayNum}
                            timeSlot="afternoon"
                            value={getCellValue(worker.name, dayNum, "afternoon")}
                            onChange={(val) => handleCellChange(worker, dayNum, "afternoon", val)}
                            onCopy={handleCopy}
                            onPaste={() => handlePaste(worker, dayNum, "afternoon")}
                            hasCopied={!!copiedTask}
                            isHoliday={isHol}
                            isVacation={isOnVacation}
                            isDisabled={isWeekClosed || isJornaleroTemp}
                            dayShade={dayIdx % 2 === 0}
                            isLastOfDay={true}
                            t={t}
                            entry={afternoonEntry}
                            userEmailMap={userEmailMap}
                            language={language}
                          />
                        </>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Close Week Confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cronograma.confirmClose")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cronograma.confirmCloseDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => closeWeekMutation.mutate()}>
              {t("cronograma.closeWeek")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Check if the updated_by is the schedule owner or an admin
function isOwnerOrAdmin(updatedBy: string | null | undefined): boolean {
  if (!updatedBy) return true; // No update info means no highlight
  // Schedule owner (cedenojord)
  if (updatedBy === SCHEDULE_OWNER_ID) return true;
  // Admin users (instructor)
  if (ADMIN_USER_IDS.includes(updatedBy)) return true;
  return false;
}

// Individual cell component
function CronogramaCell({
  worker,
  dayOfWeek,
  timeSlot,
  value,
  onChange,
  onCopy,
  onPaste,
  hasCopied,
  isHoliday,
  isVacation,
  isDisabled,
  dayShade,
  isLastOfDay,
  t,
  entry,
  userEmailMap,
  language,
}: {
  worker: WorkerRow;
  dayOfWeek: number;
  timeSlot: "morning" | "afternoon";
  value: string;
  onChange: (val: string) => void;
  onCopy: (val: string) => void;
  onPaste: () => void;
  hasCopied: boolean;
  isHoliday: boolean;
  isVacation: boolean;
  isDisabled: boolean;
  dayShade: boolean;
  isLastOfDay: boolean;
  t: (key: string) => string;
  entry?: CronogramaEntry;
  userEmailMap: Map<string, string>;
  language: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine if this cell was modified by someone other than owner/admin
  const isModifiedByOther = entry?.updated_by ? !isOwnerOrAdmin(entry.updated_by) : false;
  const modifierEmail = entry?.updated_by ? userEmailMap.get(entry.updated_by) : null;
  const modifiedAt = entry?.updated_at ? new Date(entry.updated_at) : null;

  // Auto-resize textarea on initial load and when value changes
  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value);
    }
  }, [value, isFocused]);

  // Resize on initial render and when localValue changes
  useEffect(() => {
    autoResize();
  }, [localValue, autoResize]);

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    // Copy with Ctrl+C when cell is focused
    if (e.ctrlKey && e.key === "c" && localValue) {
      onCopy(localValue);
    }
    // Paste with Ctrl+V
    if (e.ctrlKey && e.key === "v" && hasCopied) {
      e.preventDefault();
      onPaste();
    }
  };

  // Format tooltip text
  const getTooltipContent = () => {
    if (!isModifiedByOther || !modifiedAt) return null;
    
    const dateStr = format(modifiedAt, language === "es" ? "d/M/yyyy HH:mm" : "M/d/yyyy h:mm a");
    const userDisplay = modifierEmail || (language === "es" ? "Usuario desconocido" : "Unknown user");
    
    return language === "es" 
      ? `Modificado por: ${userDisplay}\n${dateStr}`
      : `Modified by: ${userDisplay}\n${dateStr}`;
  };

  if (isVacation) {
    return (
      <td className={cn(
        "border border-border p-1 text-center min-w-[120px] align-top",
        "bg-purple-100 dark:bg-purple-900/30",
        isLastOfDay && "border-r-[3px]"
      )}>
        <div className="text-xs text-purple-600 dark:text-purple-400 font-medium py-1">
          {t("cronograma.vacation")}
        </div>
      </td>
    );
  }

  const cellContent = (
    <textarea
      ref={textareaRef}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      className="w-full min-h-[28px] text-xs bg-transparent border-0 focus:ring-1 focus:ring-ring rounded resize-none overflow-hidden px-2 py-1"
      placeholder="—"
      rows={1}
      onInput={autoResize}
    />
  );

  if (isHoliday) {
    return (
      <td className={cn(
        "border border-border p-1 text-center min-w-[120px] align-top",
        "bg-amber-50 dark:bg-amber-900/20",
        isLastOfDay && "border-r-[3px]",
        isModifiedByOther && "ring-2 ring-inset ring-orange-400 dark:ring-orange-500"
      )}>
        {isModifiedByOther ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  {cellContent}
                  <div className="absolute top-0 right-0 w-2 h-2 bg-orange-400 rounded-full" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line text-xs">
                {getTooltipContent()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          cellContent
        )}
      </td>
    );
  }

  return (
    <td className={cn(
      "border border-border p-1 min-w-[120px] align-top",
      dayShade ? "bg-primary/10" : "bg-background",
      isLastOfDay && "border-r-[3px]",
      isModifiedByOther && "ring-2 ring-inset ring-orange-400 dark:ring-orange-500"
    )}>
      {isModifiedByOther ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                {cellContent}
                <div className="absolute top-0 right-0 w-2 h-2 bg-orange-400 rounded-full" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="whitespace-pre-line text-xs">
              {getTooltipContent()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        cellContent
      )}
    </td>
  );
}
