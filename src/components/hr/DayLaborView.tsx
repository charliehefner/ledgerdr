import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, subWeeks, isAfter, startOfDay, eachDayOfInterval, getDay } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Trash2, FileDown, Lock, AlertCircle, Pencil, FileSpreadsheet, FileText, Download, ChevronDown, TriangleAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { toast } from "@/hooks/use-toast";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseDateLocal, formatDateLocal, fmtDate } from "@/lib/dateUtils";
import { DayLaborAttachment } from "./DayLaborAttachment";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { generateDayLaborReceiptsZip } from "@/lib/dayLaborReceipts";
import { useEntityFilter } from "@/hooks/useEntityFilter";

interface Jornalero {
  id: string;
  name: string;
  apodo: string | null;
  cedula: string;
  is_active: boolean;
}

interface DayLaborEntry {
  id: string;
  work_date: string;
  week_ending_date: string;
  operation_description: string;
  worker_name: string;
  workers_count: number;
  field_name: string | null;
  amount: number;
  is_closed: boolean;
}

function getFridayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const friday = new Date(date);
  friday.setDate(date.getDate() + daysUntilFriday);
  return friday;
}

function getSundayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);
  return sunday;
}

function getSaturdayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const saturday = new Date(date);
  saturday.setDate(date.getDate() + daysUntilSaturday);
  return saturday;
}

export function DayLaborView() {
  const queryClient = useQueryClient();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();
  const { t, language } = useLanguage();
  const dateFnsLocale = language === "en" ? enUS : es;
  const [selectedFriday, setSelectedFriday] = useState(() => getFridayOfWeek(new Date()));
  const [editingEntry, setEditingEntry] = useState<DayLaborEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    work_date: formatDateLocal(new Date()),
    operation_description: "",
    worker_name: "",
    workers_count: "1",
    field_name: "",
    amount: "",
  });

  const weekStart = getSundayOfWeek(selectedFriday);
  const weekEnd = getSaturdayOfWeek(selectedFriday);

  const today = new Date();
  const canClose = useMemo(() => {
    const fridayStart = startOfDay(selectedFriday);
    return isAfter(today, fridayStart) || today.toDateString() === fridayStart.toDateString();
  }, [selectedFriday, today]);

  const { data: jornaleros = [] } = useQuery({
    queryKey: ["jornaleros-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornaleros")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Jornalero[];
    },
  });

  const apodoByName = useMemo(() => {
    const m = new Map<string, string>();
    jornaleros.forEach((j) => { if (j.apodo) m.set(j.name, j.apodo); });
    return m;
  }, [jornaleros]);
  const fmtWorker = (n: string) => {
    const a = apodoByName.get(n);
    return a ? `${n} (${a})` : n;
  };

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["day-labor", formatDateLocal(selectedFriday), selectedEntityId],
    queryFn: async () => {
      let query: any = supabase
        .from("day_labor_entries")
        .select("*")
        .eq("week_ending_date", formatDateLocal(selectedFriday))
        .order("work_date", { ascending: true })
        .order("created_at", { ascending: true });
      query = applyEntityFilter(query);
      const { data, error } = await query;
      if (error) throw error;
      return data as DayLaborEntry[];
    },
  });

  const isWeekClosed = entries.some(e => e.is_closed);

  const weeklyTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  }, [entries]);

  const addEntry = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      if (!selectedEntityId) throw new Error("Selecciona una entidad antes de crear");
      const { error } = await supabase.from("day_labor_entries").insert({
        work_date: entry.work_date,
        week_ending_date: formatDateLocal(selectedFriday),
        operation_description: entry.operation_description,
        worker_name: entry.worker_name || "",
        workers_count: parseInt(entry.workers_count) || 1,
        field_name: entry.field_name || null,
        amount: parseFloat(entry.amount) || 0,
        entity_id: selectedEntityId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      setNewEntry({
        work_date: formatDateLocal(new Date()),
        operation_description: "",
        worker_name: "",
        workers_count: "1",
        field_name: "",
        amount: "",
      });
      toast({ title: t("dayLabor.entryAdded") });
    },
    onError: (error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("day_labor_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      toast({ title: t("dayLabor.entryDeleted") });
    },
    onError: (error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async (entry: DayLaborEntry) => {
      const { error } = await supabase
        .from("day_labor_entries")
        .update({
          work_date: entry.work_date,
          operation_description: entry.operation_description,
          worker_name: entry.worker_name,
          workers_count: entry.workers_count,
          field_name: entry.field_name || null,
          amount: entry.amount,
        })
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      setEditingEntry(null);
      toast({ title: t("dayLabor.entryUpdated") });
    },
    onError: (error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleEditEntry = (entry: DayLaborEntry) => {
    setEditingEntry({ ...entry });
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    if (!editingEntry.operation_description || !editingEntry.worker_name || !editingEntry.amount) {
      toast({ title: t("dayLabor.completeRequired"), variant: "destructive" });
      return;
    }
    updateEntry.mutate(editingEntry);
  };

  // Generate PDF - Summary by Worker (Resumen Jornal)
  const generatePDF = () => {
    const doc = new jsPDF();
    const fridayStr = fmtDate(selectedFriday);
    
    doc.setFontSize(18);
    doc.text(`Resumen Jornal - Semana ${fridayStr}`, 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Período: ${fmtDate(weekStart)} - ${fmtDate(weekEnd)}`, 14, 30);
    
    const tableData: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
    
    summaryByWorker.forEach((group) => {
      group.entries.forEach((entry, idx) => {
        tableData.push([
          fmtDate(parseDateLocal(entry.work_date)),
          entry.operation_description,
          idx === 0 ? group.name : "",
          `RD$ ${Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
        ]);
      });
      tableData.push([
        { content: "", colSpan: 2 },
        { content: `Subtotal ${group.name}:`, styles: { fontStyle: "bold", halign: "right" } },
        { content: `RD$ ${group.subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`, styles: { fontStyle: "bold" } },
      ] as any);
    });
    
    tableData.push([
      { content: "", colSpan: 2 },
      { content: "TOTAL:", styles: { fontStyle: "bold", halign: "right" } },
      { content: `RD$ ${weeklyTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`, styles: { fontStyle: "bold" } },
    ] as any);

    autoTable(doc, {
      head: [["Fecha", "Descripción", "Nombre", "Monto"]],
      body: tableData,
      startY: 38,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`Resumen_Jornal_${format(selectedFriday, "yyyy-MM-dd")}.pdf`);
  };

  // Generate Excel - Summary by Worker
  const generateExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Resumen Jornal");
    const fridayStr = fmtDate(selectedFriday);

    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = `Resumen Jornal - Semana ${fridayStr}`;
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.mergeCells("A2:D2");
    worksheet.getCell("A2").value = `Período: ${fmtDate(weekStart)} - ${fmtDate(weekEnd)}`;
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(["Fecha", "Descripción", "Nombre", "Monto"]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    });

    summaryByWorker.forEach((group) => {
      group.entries.forEach((entry, idx) => {
        worksheet.addRow([
          fmtDate(parseDateLocal(entry.work_date)),
          entry.operation_description,
          idx === 0 ? group.name : "",
          Number(entry.amount),
        ]);
      });
      const subRow = worksheet.addRow(["", "", `Subtotal ${group.name}:`, group.subtotal]);
      subRow.eachCell((cell) => { cell.font = { bold: true }; });
    });

    worksheet.addRow([]);
    const totalRow = worksheet.addRow(["", "", "TOTAL:", weeklyTotal]);
    totalRow.eachCell((cell) => { cell.font = { bold: true }; });

    worksheet.getColumn(4).numFmt = "#,##0.00";
    worksheet.columns.forEach((col) => { col.width = 20; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resumen_Jornal_${format(selectedFriday, "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeWeek = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId) throw new Error("Selecciona una entidad antes de cerrar la semana");
      const { data, error } = await supabase.rpc("close_day_labor_week" as any, {
        p_week_ending: formatDateLocal(selectedFriday),
        p_entity_id: selectedEntityId,
      });
      if (error) throw error;
      generatePDF();
      await generateDayLaborReceiptsZip(summaryByWorker, jornaleros, selectedFriday, weekStart, weekEnd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["reportTransactions"] });
      toast({ title: t("dayLabor.weekClosed"), description: t("dayLabor.weekClosedDesc") });
    },
    onError: (error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  // Levenshtein distance for fuzzy matching
  const levenshtein = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
      const row = new Array(n + 1).fill(0);
      row[0] = i;
      return row;
    });
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
    return dp[m][n];
  };

  const isSimilar = (a: string, b: string): boolean => {
    const na = a.trim().toLowerCase();
    const nb = b.trim().toLowerCase();
    if (na === nb) return true;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return true;
    const dist = levenshtein(na, nb);
    return dist <= Math.max(2, Math.floor(maxLen * 0.3));
  };

  const duplicates = useMemo(() => {
    const dupes: { worker: string; operations: string[]; date: string; ids: string[] }[] = [];
    const matched = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      if (matched.has(entries[i].id)) continue;
      const group = [entries[i]];
      for (let j = i + 1; j < entries.length; j++) {
        if (matched.has(entries[j].id)) continue;
        if (
          entries[i].worker_name === entries[j].worker_name &&
          entries[i].work_date === entries[j].work_date &&
          isSimilar(entries[i].operation_description, entries[j].operation_description)
        ) {
          group.push(entries[j]);
          matched.add(entries[j].id);
        }
      }
      if (group.length > 1) {
        matched.add(entries[i].id);
        const uniqueOps = [...new Set(group.map(e => e.operation_description))];
        dupes.push({
          worker: entries[i].worker_name,
          operations: uniqueOps,
          date: entries[i].work_date,
          ids: group.map(e => e.id),
        });
      }
    }
    return dupes;
  }, [entries]);

  const duplicateIds = useMemo(() => new Set(duplicates.flatMap(d => d.ids)), [duplicates]);

  const summaryByWorker = useMemo(() => {
    const grouped: Record<string, { entries: DayLaborEntry[]; subtotal: number }> = {};
    const sortedEntries = [...entries].sort((a, b) => {
      const nameCompare = a.worker_name.localeCompare(b.worker_name);
      if (nameCompare !== 0) return nameCompare;
      return a.work_date.localeCompare(b.work_date);
    });
    sortedEntries.forEach((entry) => {
      const name = entry.worker_name || "Sin Nombre";
      if (!grouped[name]) {
        grouped[name] = { entries: [], subtotal: 0 };
      }
      grouped[name].entries.push(entry);
      grouped[name].subtotal += Number(entry.amount);
    });
    const sortedNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    return sortedNames.map((name) => ({ name, ...grouped[name] }));
  }, [entries]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.operation_description || !newEntry.workers_count || !newEntry.amount || !newEntry.worker_name.trim()) {
      toast({ title: t("dayLabor.completeRequired"), variant: "destructive" });
      return;
    }
    addEntry.mutate(newEntry);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedFriday(prev => 
      direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">
                    {t("dayLabor.title").replace("{date}", fmtDate(selectedFriday))}
                  </CardTitle>
                  <DayLaborAttachment weekEndingDate={formatDateLocal(selectedFriday)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: dateFnsLocale })} - {format(weekEnd, "d MMM, yyyy", { locale: dateFnsLocale })}
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {isWeekClosed && (
                <span className="flex items-center gap-1 text-sm text-warning bg-warning/10 px-3 py-1 rounded-full">
                  <Lock className="h-3 w-3" />
                  {t("dayLabor.closed")}
                </span>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={!canClose || isWeekClosed || entries.length === 0 || closeWeek.isPending}
                    variant="default"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {t("dayLabor.closeWeek")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("dayLabor.closeWeekConfirm")}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        <p>{t("dayLabor.closeWeekDesc")}</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>{t("dayLabor.closeWeekAction1")}</li>
                          <li>{t("dayLabor.closeWeekAction2").replace("{amount}", weeklyTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 }))}</li>
                          <li>{t("dayLabor.closeWeekAction3")}</li>
                        </ul>
                        <p className="mt-3 font-medium">{t("dayLabor.closeWeekWarning")}</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => closeWeek.mutate()}>
                      {t("dayLabor.closeWeek")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={entries.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("dayLabor.export")}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={generateExcel} className="text-excel">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {t("dayLabor.exportExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={generatePDF}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t("dayLabor.exportPdf")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generateDayLaborReceiptsZip(summaryByWorker, jornaleros, selectedFriday, weekStart, weekEnd)}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("dayLabor.downloadReceipts")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add Entry Form */}
      {!isWeekClosed && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("dayLabor.addEntry")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEntry} className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.date")}</label>
                <Input
                  type="date"
                  value={newEntry.work_date}
                  onChange={(e) => setNewEntry({ ...newEntry, work_date: e.target.value })}
                  min={format(weekStart, "yyyy-MM-dd")}
                  max={format(weekEnd, "yyyy-MM-dd")}
                  className="w-40"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-sm font-medium">{t("dayLabor.operation")}</label>
                <Input
                  value={newEntry.operation_description}
                  onChange={(e) => setNewEntry({ ...newEntry, operation_description: e.target.value })}
                  placeholder={t("dayLabor.workDesc")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.workersCount")}</label>
                <Input
                  type="number"
                  min="1"
                  value={newEntry.workers_count}
                  onChange={(e) => setNewEntry({ ...newEntry, workers_count: e.target.value })}
                  placeholder="1"
                  className="w-28"
                />
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="text-sm font-medium">{t("dayLabor.jornalero")}</label>
                <select
                  value={newEntry.worker_name}
                  onChange={(e) => setNewEntry({ ...newEntry, worker_name: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t("dayLabor.selectJornalero")}</option>
                  {jornaleros.map((j) => (
                    <option key={j.id} value={j.name}>
                      {j.name}{j.apodo ? ` (${j.apodo})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 min-w-[140px]">
                <label className="text-sm font-medium">{t("dayLabor.fieldOptional")}</label>
                <Input
                  value={newEntry.field_name}
                  onChange={(e) => setNewEntry({ ...newEntry, field_name: e.target.value })}
                  placeholder={t("dayLabor.fieldOptional")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.amountRd")}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-32"
                />
              </div>
              <Button type="submit" disabled={addEntry.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                {t("dayLabor.add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Warning */}
      {duplicates.length > 0 && (
        <Alert variant="destructive" className="border-warning/50 bg-warning/10 text-warning-foreground">
          <TriangleAlert className="h-4 w-4 !text-warning" />
          <AlertTitle className="text-warning">{t("dayLabor.duplicatesDetected")}</AlertTitle>
          <AlertDescription className="text-warning/80">
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {duplicates.map((d, i) => (
                <li key={i}>
                  <strong>{d.worker}</strong> — "{d.operations.join('" / "')}" el{" "}
                  {format(parseDateLocal(d.date), "dd MMM", { locale: dateFnsLocale })} ({t("dayLabor.entriesInDate").replace("{count}", String(d.ids.length))})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dayLabor.date")}</TableHead>
                <TableHead>{t("dayLabor.operationCol")}</TableHead>
                <TableHead className="text-center">{t("dayLabor.workersCol")}</TableHead>
                <TableHead>{t("dayLabor.nameCol")}</TableHead>
                <TableHead>{t("dayLabor.fieldCol")}</TableHead>
                <TableHead className="text-right">{t("dayLabor.amountCol")}</TableHead>
                {!isWeekClosed && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("dayLabor.loading")}
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t("dayLabor.noEntries")}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className={duplicateIds.has(entry.id) ? "bg-warning/10" : ""}>
                      <TableCell className="font-medium">
                        {format(parseDateLocal(entry.work_date), "EEE dd/MM", { locale: dateFnsLocale })}
                      </TableCell>
                      <TableCell>{entry.operation_description}</TableCell>
                      <TableCell className="text-center">{entry.workers_count}</TableCell>
                      <TableCell>{entry.worker_name ? fmtWorker(entry.worker_name) : "-"}</TableCell>
                      <TableCell>{entry.field_name || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        RD$ {Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      {!isWeekClosed && (
                        <TableCell className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditEntry(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteEntry.mutate(entry.id)}
                            disabled={deleteEntry.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5} className="text-right">
                      {t("dayLabor.weeklyTotal")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      RD$ {weeklyTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </TableCell>
                    {!isWeekClosed && <TableCell></TableCell>}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary by Worker */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("dayLabor.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dayLabor.date")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead>{t("dayLabor.nameCol")}</TableHead>
                  <TableHead className="text-right">{t("dayLabor.amountCol")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByWorker.map((group) => (
                  <React.Fragment key={group.name}>
                    {group.entries.map((entry, idx) => (
                      <TableRow key={entry.id}>
                        <TableCell>{fmtDate(parseDateLocal(entry.work_date))}</TableCell>
                        <TableCell>{entry.operation_description}</TableCell>
                        <TableCell>{idx === 0 ? fmtWorker(group.name) : ""}</TableCell>
                        <TableCell className="text-right font-mono">
                          RD$ {Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="font-semibold text-right">{t("dayLabor.subtotal").replace("{name}", group.name)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        RD$ {group.subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="text-right">{t("dayLabor.total")}</TableCell>
                  <TableCell className="text-right font-mono">
                    RD$ {weeklyTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Info about closing */}
      {!isWeekClosed && !canClose && (
        <p className="text-sm text-muted-foreground text-center">
          {t("dayLabor.closeAvailableFriday").replace("{date}", format(selectedFriday, "d MMM", { locale: dateFnsLocale }))}
        </p>
      )}

      {/* Edit Entry Dialog */}
      {editingEntry && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingEntry(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dayLabor.editEntry")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.date")}</label>
                <Input
                  type="date"
                  value={editingEntry.work_date}
                  onChange={(e) => setEditingEntry({ ...editingEntry, work_date: e.target.value })}
                  min={format(weekStart, "yyyy-MM-dd")}
                  max={format(weekEnd, "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.operation")}</label>
                <Input
                  value={editingEntry.operation_description}
                  onChange={(e) => setEditingEntry({ ...editingEntry, operation_description: e.target.value })}
                  placeholder={t("dayLabor.workDesc")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.workersCount")}</label>
                <Input
                  type="number"
                  min="1"
                  value={editingEntry.workers_count}
                  onChange={(e) => setEditingEntry({ ...editingEntry, workers_count: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.jornalero")}</label>
                <select
                  value={editingEntry.worker_name}
                  onChange={(e) => setEditingEntry({ ...editingEntry, worker_name: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t("dayLabor.selectJornalero")}</option>
                  {jornaleros.map((j) => (
                    <option key={j.id} value={j.name}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.fieldOptional")}</label>
                <Input
                  value={editingEntry.field_name || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, field_name: e.target.value })}
                  placeholder={t("dayLabor.fieldOptional")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("dayLabor.amountRd")}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingEntry.amount}
                  onChange={(e) => setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEntry(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateEntry.isPending}>
                {t("dayLabor.saveChanges")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
