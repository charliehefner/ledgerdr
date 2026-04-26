import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, subWeeks, getDay, eachDayOfInterval, isWithinInterval } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2, Copy, Download, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { formatDateLocal, parseDateLocal } from "@/lib/dateUtils";
import { toast } from "sonner";
// ScrollArea removed: native overflow-x-auto gives draggable scrollbar + trackpad swipe
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

// User IDs for highlight logic
const CEDENOJORD_ID = "3976a9b9-ac8e-4afb-a4cb-2efcc02c2e80"; // Schedule owner
const INSTRUCTOR_ID = "7ce0dff1-c2b3-4506-b6eb-c61d9ca50121"; // Never highlighted
// Trusted editors whose edits do NOT trigger the orange-ring "other editor" indicator
const TRUSTED_EDITOR_IDS = new Set<string>([
  INSTRUCTOR_ID,
  "b2a33a75-b63c-48e1-a252-7ab843f559d5", // Iramaia Bassoi (irabassoi@gmail.com)
]);
const SELF_EDIT_HIGHLIGHT_HOURS = 8; // Hours after creation before cedenojord edits are highlighted

// Per-device toggle: hide edit indicators on this machine
const HIGHLIGHT_PREF_KEY = "cronograma.showEditIndicators";
function getShowIndicatorsPref(): boolean {
  try {
    const v = localStorage.getItem(HIGHLIGHT_PREF_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

// Highlight types for visual differentiation
type HighlightType = "other" | "self-edit" | null;

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
  created_at: string;
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
    
    if (error) return new Map();
    
    const users = Array.isArray(data) ? data : data?.users;
    if (!users) return new Map();
    
    const emailMap = new Map<string, string>();
    users.forEach((u: { id: string; email: string }) => {
      emailMap.set(u.id, u.email);
    });
    return emailMap;
  } catch {
    return new Map();
  }
}

// Build a lookup key for the entry map
function entryKey(workerName: string, workerType: string, dayOfWeek: number, timeSlot: string): string {
  return `${workerName}|${workerType}|${dayOfWeek}|${timeSlot}`;
}

/**
 * Determine the highlight type for an entry based on who edited it and when.
 */
function getHighlightType(entry?: CronogramaEntry): HighlightType {
  if (!entry?.updated_by) return null;
  if (TRUSTED_EDITOR_IDS.has(entry.updated_by)) return null;
  if (entry.updated_by === CEDENOJORD_ID) {
    const createdAt = new Date(entry.created_at);
    const updatedAt = new Date(entry.updated_at);
    const hoursDiff = (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff >= SELF_EDIT_HIGHLIGHT_HOURS ? "self-edit" : null;
  }
  return "other";
}

export function CronogramaGrid() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const { selectedEntityId, requireEntity } = useEntity();
  const queryClient = useQueryClient();
  const locale = language === "es" ? es : enUS;
  
  const [selectedSaturday, setSelectedSaturday] = useState(() => getSaturdayOfWeek(new Date()));
  const [additionalRows, setAdditionalRows] = useState<WorkerRow[]>([]);
  const [copiedTask, setCopiedTask] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showIndicators, setShowIndicators] = useState<boolean>(() => getShowIndicatorsPref());

  const toggleIndicators = useCallback(() => {
    setShowIndicators(prev => {
      const next = !prev;
      try { localStorage.setItem(HIGHLIGHT_PREF_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  
  // Debounce timer ref for mutations
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekEndingDate = formatDateLocal(selectedSaturday);
  const weekStart = getMondayOfWeek(selectedSaturday);
  const weekDays = eachDayOfInterval({ start: weekStart, end: selectedSaturday });
  
  const isSaturday = getDay(new Date()) === 6;

  // Position priority for Cronograma ordering
  const positionPriority: Record<string, number> = {
    'Tractorista': 1,
    'Servicios Generales': 2,
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
    queryKey: ["cronograma-entries", weekEndingDate, selectedEntityId],
    queryFn: async () => {
      let query = supabase
        .from("cronograma_entries")
        .select("*")
        .eq("week_ending_date", weekEndingDate);
      if (selectedEntityId) {
        query = query.eq("entity_id", selectedEntityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as CronogramaEntry[];
    },
  });

  // O(1) lookup map for entries — replaces all entries.find() calls
  const entryMap = useMemo(() => {
    const map = new Map<string, CronogramaEntry>();
    for (const e of entries) {
      map.set(entryKey(e.worker_name, e.worker_type, e.day_of_week, e.time_slot), e);
    }
    return map;
  }, [entries]);

  // Fetch user emails for displaying in tooltips.
  // Stable key + long staleTime: directory is small, fetched once per session,
  // shared across week navigation. Prevents the "Usuario desconocido" flicker.
  const { data: userEmailMap = new Map<string, string>() } = useQuery({
    queryKey: ["all-user-emails"],
    queryFn: async () => fetchUserEmails([]),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  // Fetch week status
  const { data: weekStatus } = useQuery({
    queryKey: ["cronograma-week", weekEndingDate, selectedEntityId],
    queryFn: async () => {
      let query = supabase
        .from("cronograma_weeks")
        .select("*")
        .eq("week_ending_date", weekEndingDate);
      if (selectedEntityId) {
        query = query.eq("entity_id", selectedEntityId);
      }
      const { data, error } = await query.maybeSingle();
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
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione una entidad antes de guardar.");

      // Ensure week row exists before inserting entry (FK constraint)
      const { data: existingWeek, error: existingWeekError } = await supabase
        .from("cronograma_weeks")
        .select("id")
        .eq("week_ending_date", entry.week_ending_date)
        .eq("entity_id", entityId)
        .maybeSingle();
      if (existingWeekError) throw existingWeekError;

      let weekId = existingWeek?.id;

      if (!weekId) {
        const { data: newWeek, error: newWeekError } = await supabase
          .from("cronograma_weeks")
          .insert({ week_ending_date: entry.week_ending_date, is_closed: false, entity_id: entityId })
          .select("id")
          .single();

        if (newWeekError) throw newWeekError;
        weekId = newWeek.id;
      }
      
      // Find existing entry using the map (O(1))
      const lookupKey = entryKey(
        entry.worker_name,
        entry.worker_type,
        entry.day_of_week,
        entry.time_slot
      );
      const existing = entryMap.get(lookupKey);

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
            cronograma_week_id: weekId,
            week_ending_date: entry.week_ending_date,
            worker_type: entry.worker_type,
            worker_name: entry.worker_name,
            day_of_week: entry.day_of_week,
            time_slot: entry.time_slot,
            task: (entry as any).task ?? null,
            worker_id: (entry as any).worker_id ?? null,
            is_vacation: (entry as any).is_vacation ?? false,
            is_holiday: (entry as any).is_holiday ?? false,
            source_operation_id: (entry as any).source_operation_id ?? null,
            created_by: currentUserId,
            updated_by: currentUserId,
            entity_id: entityId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cronograma-entries", weekEndingDate, selectedEntityId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    },
  });

  // Close week mutation
  const closeWeekMutation = useMutation({
    mutationFn: async () => {
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione una entidad.");

      const { data: existing } = await supabase
        .from("cronograma_weeks")
        .select("id")
        .eq("week_ending_date", weekEndingDate)
        .eq("entity_id", entityId)
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
          .insert({ week_ending_date: weekEndingDate, is_closed: true, closed_at: new Date().toISOString(), entity_id: entityId });
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

  const isEmployeeOnVacation = useCallback((employeeId: string, date: Date): boolean => {
    return vacations.some(v => {
      if (v.employee_id !== employeeId) return false;
      const start = parseDateLocal(v.start_date);
      const end = parseDateLocal(v.end_date);
      return isWithinInterval(date, { start, end });
    });
  }, [vacations]);

  // Optimistic + debounced cell change handler
  const handleCellChange = useCallback((
    worker: WorkerRow,
    dayOfWeek: number,
    timeSlot: "morning" | "afternoon",
    value: string
  ) => {
    if (isWeekClosed) return;
    
    const mutationPayload = {
      week_ending_date: weekEndingDate,
      worker_type: worker.type,
      worker_id: worker.id,
      worker_name: worker.name,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
      task: value || null,
      is_vacation: false,
      is_holiday: false,
    };

    // Optimistic update: patch the query cache immediately
    const queryKey = ["cronograma-entries", weekEndingDate, selectedEntityId];
    queryClient.setQueryData<CronogramaEntry[]>(queryKey, (old) => {
      if (!old) return old;
      const key = entryKey(worker.name, worker.type, dayOfWeek, timeSlot);
      const idx = old.findIndex(e => entryKey(e.worker_name, e.worker_type, e.day_of_week, e.time_slot) === key);
      if (idx >= 0) {
        const updated = [...old];
        updated[idx] = { ...updated[idx], task: value || null, updated_at: new Date().toISOString() };
        return updated;
      }
      return old;
    });

    // Debounce the actual network mutation (300ms)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      upsertMutation.mutate(mutationPayload);
    }, 300);
  }, [isWeekClosed, weekEndingDate, selectedEntityId, queryClient, upsertMutation]);

  const handleCopy = useCallback((value: string) => {
    setCopiedTask(value);
    toast.success(t("cronograma.taskCopied"));
  }, [t]);

  const handlePaste = useCallback((worker: WorkerRow, dayOfWeek: number, timeSlot: "morning" | "afternoon") => {
    if (copiedTask && !isWeekClosed) {
      handleCellChange(worker, dayOfWeek, timeSlot, copiedTask);
    }
  }, [copiedTask, isWeekClosed, handleCellChange]);

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
  const allWorkerRows: WorkerRow[] = useMemo(() => [
    ...employees.map(e => ({ type: "employee" as const, id: e.id, name: e.name })),
    ...additionalRows,
  ], [employees, additionalRows]);

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

    const titleText = language === "es" 
      ? `Cronograma - Semana ${format(weekStart, "d/M")} al ${format(selectedSaturday, "d/M/yyyy")}`
      : `Schedule - Week ${format(weekStart, "M/d")} to ${format(selectedSaturday, "M/d/yyyy")}`;
    worksheet.addRow([titleText]);
    worksheet.mergeCells(1, 1, 1, 13);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 14 };
    titleRow.height = 24;
    titleRow.alignment = { vertical: "middle" };

    worksheet.addRow([]);

    const headerRow1 = [language === "es" ? "Trabajador" : "Worker"];
    weekDays.forEach((day, idx) => {
      headerRow1.push(`${fullDayLabels[idx]} ${format(day, "d/M")}`);
      headerRow1.push("");
    });
    worksheet.addRow(headerRow1);

    for (let i = 0; i < 6; i++) {
      const startCol = 2 + (i * 2);
      worksheet.mergeCells(3, startCol, 3, startCol + 1);
    }

    const headerRow2 = [""];
    weekDays.forEach(() => {
      headerRow2.push("AM");
      headerRow2.push("PM");
    });
    worksheet.addRow(headerRow2);

    const dayColors = ["FFD6E3F0", "FFE8EDF3"];
    [3, 4].forEach((rowNum) => {
      const row = worksheet.getRow(rowNum);
      row.font = { bold: true };
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.height = 20;
      
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      row.getCell(1).border = { bottom: { style: "medium" }, right: { style: "thin" }, left: { style: "thin" }, top: { style: "thin" } };
      
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

    let dataRowNum = 5;
    allWorkerRows.forEach((worker) => {
      if (worker.isTemp && !worker.id) return;
      
      const rowData = [worker.name];
      weekDays.forEach((day, idx) => {
        const dayNum = idx + 1;
        const amEntry = entryMap.get(entryKey(worker.name, worker.type, dayNum, "morning"));
        const pmEntry = entryMap.get(entryKey(worker.name, worker.type, dayNum, "afternoon"));
        rowData.push(amEntry?.task || "");
        rowData.push(pmEntry?.task || "");
      });
      worksheet.addRow(rowData);
      
      const row = worksheet.getRow(dataRowNum);
      row.alignment = { vertical: "top", wrapText: true };
      row.height = 28;
      
      row.getCell(1).font = { bold: true };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      row.getCell(1).border = { bottom: { style: "thin" }, right: { style: "thin" }, left: { style: "thin" } };
      
      for (let i = 0; i < 6; i++) {
        const color = i % 2 === 0 ? "FFE8F0F8" : "FFFFFFFF";
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

    worksheet.getColumn(1).width = 22;
    for (let i = 2; i <= 13; i++) {
      worksheet.getColumn(i).width = 16;
    }

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
    
    const title = language === "es" 
      ? `Cronograma - Semana ${format(weekStart, "d/M")} al ${format(selectedSaturday, "d/M/yyyy")}`
      : `Schedule - Week ${format(weekStart, "M/d")} to ${format(selectedSaturday, "M/d/yyyy")}`;
    doc.setFontSize(14);
    doc.text(title, 14, 15);

    const headers = [[language === "es" ? "Trabajador" : "Worker"]];
    weekDays.forEach((day, idx) => {
      headers[0].push(`${dayLabels[idx]} ${format(day, "d/M")} AM`);
      headers[0].push(`${dayLabels[idx]} ${format(day, "d/M")} PM`);
    });

    const data: string[][] = [];
    allWorkerRows.forEach((worker) => {
      if (worker.isTemp && !worker.id) return;
      
      const row = [worker.name];
      weekDays.forEach((day, idx) => {
        const dayNum = idx + 1;
        const amEntry = entryMap.get(entryKey(worker.name, worker.type, dayNum, "morning"));
        const pmEntry = entryMap.get(entryKey(worker.name, worker.type, dayNum, "afternoon"));
        row.push(amEntry?.task || "");
        row.push(pmEntry?.task || "");
      });
      data.push(row);
    });

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
        if (hookData.section === "body" && hookData.column.index > 0) {
          const dayIndex = Math.floor((hookData.column.index - 1) / 2);
          hookData.cell.styles.fillColor = dayIndex % 2 === 0 ? lightBlue : white;
        }
      },
    });

    doc.save(`cronograma_${format(selectedSaturday, "yyyy-MM-dd")}.pdf`);
    toast.success(language === "es" ? "PDF exportado" : "PDF exported");
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
      <TooltipProvider delayDuration={300}>
        <div className="w-full overflow-x-auto overflow-y-visible">
          <div className="min-w-[900px]">
            <table className="w-full border-collapse text-sm" style={{ borderSpacing: 0 }}>
              <thead className="border-b-[4px] border-foreground/40 sticky top-0 z-20">
                <tr>
                  <th className="border-2 border-border bg-muted/50 p-2 text-left font-medium sticky left-0 z-30 min-w-[150px]">
                    {t("cronograma.worker")}
                  </th>
                  {weekDays.map((day, idx) => {
                    const dateStr = formatDateLocal(day);
                    const isHol = isHoliday(dateStr);
                    
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
                  <th className="border-2 border-border bg-muted/50 p-1 text-xs sticky left-0 z-30"></th>
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
                        const isOnVacation = worker.type === "employee" && worker.id ? isEmployeeOnVacation(worker.id, day) : false;

                        const morningEntry = entryMap.get(entryKey(worker.name, worker.type, dayNum, "morning"));
                        const afternoonEntry = entryMap.get(entryKey(worker.name, worker.type, dayNum, "afternoon"));

                        return (
                          <>
                            <CronogramaCellMemo
                              key={`${rowIdx}-${dayIdx}-am`}
                              worker={worker}
                              dayOfWeek={dayNum}
                              timeSlot="morning"
                              value={morningEntry?.task || ""}
                              onChange={(val) => handleCellChange(worker, dayNum, "morning", val)}
                              onCopy={handleCopy}
                              onPaste={() => handlePaste(worker, dayNum, "morning")}
                              hasCopied={!!copiedTask}
                              isHoliday={isHol}
                              isVacation={isOnVacation}
                              isDisabled={isWeekClosed || !!isJornaleroTemp}
                              dayShade={dayIdx % 2 === 0}
                              isLastOfDay={false}
                              t={t}
                              entry={morningEntry}
                              userEmailMap={userEmailMap}
                              language={language}
                              showIndicators={showIndicators}
                            />
                            <CronogramaCellMemo
                              key={`${rowIdx}-${dayIdx}-pm`}
                              worker={worker}
                              dayOfWeek={dayNum}
                              timeSlot="afternoon"
                              value={afternoonEntry?.task || ""}
                              onChange={(val) => handleCellChange(worker, dayNum, "afternoon", val)}
                              onCopy={handleCopy}
                              onPaste={() => handlePaste(worker, dayNum, "afternoon")}
                              hasCopied={!!copiedTask}
                              isHoliday={isHol}
                              isVacation={isOnVacation}
                              isDisabled={isWeekClosed || !!isJornaleroTemp}
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
        </div>
      </TooltipProvider>

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

// Props type for the cell component
type CronogramaCellProps = {
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
  showIndicators: boolean;
};

// Memoized cell component — only re-renders when its specific props change
const CronogramaCellMemo = memo(function CronogramaCell({
  worker,
  dayOfWeek,
  timeSlot,
  value,
  onChange,
  onCopy,
  onPaste,
  hasCopied,
  isHoliday: isHol,
  isVacation,
  isDisabled,
  dayShade,
  isLastOfDay,
  t,
  entry,
  userEmailMap,
  language,
  showIndicators,
}: CronogramaCellProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rawHighlightType = getHighlightType(entry);
  const highlightType = showIndicators ? rawHighlightType : null;
  const isHighlighted = highlightType !== null;
  const modifierEmail = entry?.updated_by ? userEmailMap.get(entry.updated_by) : null;
  const modifiedAt = entry?.updated_at ? new Date(entry.updated_at) : null;

  // Softer indicator: thin outline + dot positioned outside the cell so it never overlaps text
  const ringClass = highlightType === "self-edit"
    ? "ring-1 ring-inset ring-blue-300 dark:ring-blue-500"
    : "ring-1 ring-inset ring-orange-300 dark:ring-orange-500";
  const dotClass = highlightType === "self-edit"
    ? "bg-blue-400"
    : "bg-orange-400";

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    // Ctrl+C / Ctrl+V are intentionally NOT intercepted here so the browser's
    // native clipboard handling works inside the textarea (copy from Word,
    // WhatsApp, other cells, etc.). The "duplicate cell" workflow is available
    // via the dedicated Copy button in the toolbar.
  };

  const getTooltipContent = () => {
    if (!isHighlighted || !modifiedAt) return null;
    
    const dateStr = format(modifiedAt, language === "es" ? "d/M/yyyy HH:mm" : "M/d/yyyy h:mm a");
    const userDisplay = modifierEmail
      || (userEmailMap.size === 0
            ? (language === "es" ? "Cargando…" : "Loading…")
            : (language === "es" ? "Usuario desconocido" : "Unknown user"));
    
    const modTypeLabel = highlightType === "self-edit"
      ? (language === "es" ? " (auto-edición tardía)" : " (late self-edit)")
      : "";
    
    return language === "es" 
      ? `Modificado por: ${userDisplay}${modTypeLabel}\n${dateStr}`
      : `Modified by: ${userDisplay}${modTypeLabel}\n${dateStr}`;
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

  if (isHol) {
    return (
      <td className={cn(
        "border border-border p-1 text-center min-w-[120px] align-top",
        "bg-amber-50 dark:bg-amber-900/20",
        isLastOfDay && "border-r-[3px]",
        isHighlighted && ringClass
      )}>
        {isHighlighted ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                {cellContent}
                <div className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full ring-1 ring-background", dotClass)} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="whitespace-pre-line text-xs">
              {getTooltipContent()}
            </TooltipContent>
          </Tooltip>
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
      isHighlighted && ringClass
    )}>
      {isHighlighted ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              {cellContent}
              <div className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full ring-1 ring-background", dotClass)} />
            </div>
          </TooltipTrigger>
          <TooltipContent className="whitespace-pre-line text-xs">
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
      ) : (
        cellContent
      )}
    </td>
  );
}, (prevProps, nextProps) => {
  // Custom comparator: only re-render when meaningful props change
  return (
    prevProps.value === nextProps.value &&
    prevProps.isDisabled === nextProps.isDisabled &&
    prevProps.isHoliday === nextProps.isHoliday &&
    prevProps.isVacation === nextProps.isVacation &&
    prevProps.hasCopied === nextProps.hasCopied &&
    prevProps.dayShade === nextProps.dayShade &&
    prevProps.isLastOfDay === nextProps.isLastOfDay &&
    prevProps.language === nextProps.language &&
    prevProps.entry?.updated_by === nextProps.entry?.updated_by &&
    prevProps.entry?.updated_at === nextProps.entry?.updated_at &&
    prevProps.entry?.task === nextProps.entry?.task
  );
});
