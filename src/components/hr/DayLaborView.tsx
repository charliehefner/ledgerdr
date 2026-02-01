import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, subWeeks, isAfter, startOfDay, eachDayOfInterval, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Trash2, FileDown, Lock, AlertCircle, Paperclip } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { createTransaction } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseDateLocal, formatDateLocal } from "@/lib/dateUtils";
import { DayLaborAttachment } from "./DayLaborAttachment";

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

// Get the Friday of the week for a given date
function getFridayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const friday = new Date(date);
  friday.setDate(date.getDate() + daysUntilFriday);
  return friday;
}

// Get the Monday of the week for a given date
function getMondayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysFromMonday);
  return monday;
}

export function DayLaborView() {
  const queryClient = useQueryClient();
  const [selectedFriday, setSelectedFriday] = useState(() => getFridayOfWeek(new Date()));
  const [newEntry, setNewEntry] = useState({
    work_date: formatDateLocal(new Date()),
    operation_description: "",
    worker_name: "",
    workers_count: "1",
    field_name: "",
    amount: "",
  });

  const weekStart = getMondayOfWeek(selectedFriday);
  const weekEnd = selectedFriday;

  // Check if close button should be enabled (Friday morning or later, but not after Sunday)
  const today = new Date();
  const canClose = useMemo(() => {
    const fridayStart = startOfDay(selectedFriday);
    return isAfter(today, fridayStart) || today.toDateString() === fridayStart.toDateString();
  }, [selectedFriday, today]);

  // Fetch entries for the selected week
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["day-labor", formatDateLocal(selectedFriday)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_labor_entries")
        .select("*")
        .eq("week_ending_date", formatDateLocal(selectedFriday))
        .order("work_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as DayLaborEntry[];
    },
  });

  const isWeekClosed = entries.some(e => e.is_closed);

  // Calculate weekly total
  const weeklyTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  }, [entries]);

  // Add entry mutation
  const addEntry = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      const { error } = await supabase.from("day_labor_entries").insert({
        work_date: entry.work_date,
        week_ending_date: formatDateLocal(selectedFriday),
        operation_description: entry.operation_description,
        worker_name: entry.worker_name || "",
        workers_count: parseInt(entry.workers_count) || 1,
        field_name: entry.field_name || null,
        amount: parseFloat(entry.amount) || 0,
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
      toast({ title: "Entrada agregada" });
    },
    onError: (error) => {
      toast({ title: "Error al agregar entrada", description: error.message, variant: "destructive" });
    },
  });

  // Delete entry mutation
  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("day_labor_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      toast({ title: "Entrada eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error al eliminar entrada", description: error.message, variant: "destructive" });
    },
  });

  // Generate PDF
  const generatePDF = () => {
    const doc = new jsPDF();
    const fridayStr = format(selectedFriday, "dd/MM/yyyy");
    
    doc.setFontSize(18);
    doc.text(`Jornales Semana ${fridayStr}`, 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Período: ${format(weekStart, "dd/MM/yyyy")} - ${format(weekEnd, "dd/MM/yyyy")}`, 14, 30);
    doc.text(`Total Entradas: ${entries.length}`, 14, 37);
    
    const tableData = entries.map(entry => [
      format(parseDateLocal(entry.work_date), "dd/MM/yyyy"),
      entry.operation_description,
      entry.workers_count.toString(),
      entry.worker_name || "-",
      entry.field_name || "-",
      `RD$ ${Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
    ]);
    
    // Add total row
    tableData.push([
      "",
      "",
      "",
      "",
      "TOTAL:",
      `RD$ ${weeklyTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      head: [["Fecha", "Operación", "# Trab.", "Nombre", "Campo", "Monto"]],
      body: tableData,
      startY: 45,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    doc.save(`Jornales_Semana_${format(selectedFriday, "yyyy-MM-dd")}.pdf`);
  };

  // Close week mutation
  const closeWeek = useMutation({
    mutationFn: async () => {
      // Mark all entries as closed
      const { error: updateError } = await supabase
        .from("day_labor_entries")
        .update({ is_closed: true })
        .eq("week_ending_date", formatDateLocal(selectedFriday));

      if (updateError) throw updateError;

      // Create transaction
      const fridayStr = format(selectedFriday, "dd/MM/yyyy");
      await createTransaction({
        transaction_date: formatDateLocal(selectedFriday),
        master_acct_code: "7010",
        description: `Jornales Semana ${fridayStr}`,
        currency: "DOP",
        amount: weeklyTotal,
        pay_method: "Transfer BHD",
        document: "Recibos",
        name: "Transferencia",
        is_internal: true,
        comments: `Jornales de la semana terminando ${fridayStr}. ${entries.length} entradas.`,
      });

      // Generate PDF
      generatePDF();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      toast({ title: "Semana cerrada exitosamente", description: "Transacción creada y PDF descargado." });
    },
    onError: (error) => {
      toast({ title: "Error al cerrar semana", description: error.message, variant: "destructive" });
    },
  });

  // Calculate summary grouped by worker name
  const summaryByWorker = useMemo(() => {
    const grouped: Record<string, { entries: DayLaborEntry[]; subtotal: number }> = {};
    
    // Sort entries by worker name first, then by date
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
    
    // Sort worker names alphabetically
    const sortedNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    return sortedNames.map((name) => ({ name, ...grouped[name] }));
  }, [entries]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.operation_description || !newEntry.workers_count || !newEntry.amount || !newEntry.worker_name.trim()) {
      toast({ title: "Por favor complete los campos requeridos (Operación, # Trabajadores, Nombre, Monto)", variant: "destructive" });
      return;
    }
    addEntry.mutate(newEntry);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedFriday(prev => 
      direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  // Get days of the week for the date picker constraint
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
                    Jornales - Semana {format(selectedFriday, "dd/MM/yyyy")}
                  </CardTitle>
                  <DayLaborAttachment weekEndingDate={formatDateLocal(selectedFriday)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM, yyyy", { locale: es })}
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
                  Cerrada
                </span>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={!canClose || isWeekClosed || entries.length === 0 || closeWeek.isPending}
                    variant="default"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Cerrar Semana
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cerrar Semana?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        <p>Esto hará lo siguiente:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Bloquear todas las entradas de esta semana</li>
                          <li>Crear una transacción por RD$ {weeklyTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</li>
                          <li>Descargar un resumen en PDF</li>
                        </ul>
                        <p className="mt-3 font-medium">Esta acción no se puede deshacer.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => closeWeek.mutate()}>
                      Cerrar Semana
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={generatePDF} disabled={entries.length === 0}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add Entry Form */}
      {!isWeekClosed && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agregar Entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEntry} className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha</label>
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
                <label className="text-sm font-medium">Operación *</label>
                <Input
                  value={newEntry.operation_description}
                  onChange={(e) => setNewEntry({ ...newEntry, operation_description: e.target.value })}
                  placeholder="Descripción del trabajo..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium"># Trabajadores *</label>
                <Input
                  type="number"
                  min="1"
                  value={newEntry.workers_count}
                  onChange={(e) => setNewEntry({ ...newEntry, workers_count: e.target.value })}
                  placeholder="1"
                  className="w-28"
                />
              </div>
              <div className="space-y-1 min-w-[140px]">
                <label className="text-sm font-medium">Nombre *</label>
                <Input
                  value={newEntry.worker_name}
                  onChange={(e) => setNewEntry({ ...newEntry, worker_name: e.target.value })}
                  placeholder="Nombre..."
                  required
                />
              </div>
              <div className="space-y-1 min-w-[140px]">
                <label className="text-sm font-medium">Campo (opcional)</label>
                <Input
                  value={newEntry.field_name}
                  onChange={(e) => setNewEntry({ ...newEntry, field_name: e.target.value })}
                  placeholder="Campo..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Monto (RD$) *</label>
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
                Agregar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead className="text-center"># Trab.</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                {!isWeekClosed && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No hay entradas para esta semana
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(parseDateLocal(entry.work_date), "EEE dd/MM", { locale: es })}
                      </TableCell>
                      <TableCell>{entry.operation_description}</TableCell>
                      <TableCell className="text-center">{entry.workers_count}</TableCell>
                      <TableCell>{entry.worker_name || "-"}</TableCell>
                      <TableCell>{entry.field_name || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        RD$ {Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      {!isWeekClosed && (
                        <TableCell>
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
                      Total Semanal:
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
            <CardTitle className="text-base">Resumen por Trabajador</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByWorker.map((group) => (
                  <>
                    {group.entries.map((entry, idx) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(parseDateLocal(entry.work_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{entry.operation_description}</TableCell>
                        <TableCell>{idx === 0 ? group.name : ""}</TableCell>
                        <TableCell className="text-right font-mono">
                          RD$ {Number(entry.amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="font-semibold text-right">Subtotal {group.name}:</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        RD$ {group.subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="text-right">TOTAL:</TableCell>
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
          El botón de cerrar estará disponible el viernes ({format(selectedFriday, "d MMM", { locale: es })})
        </p>
      )}
    </div>
  );
}
