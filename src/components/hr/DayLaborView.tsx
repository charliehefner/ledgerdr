import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isFriday, isAfter, startOfDay, eachDayOfInterval, getDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Trash2, FileDown, Lock, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { createTransaction } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DayLaborEntry {
  id: string;
  work_date: string;
  week_ending_date: string;
  operation_description: string;
  worker_name: string;
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
    work_date: format(new Date(), "yyyy-MM-dd"),
    operation_description: "",
    worker_name: "",
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
    queryKey: ["day-labor", format(selectedFriday, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_labor_entries")
        .select("*")
        .eq("week_ending_date", format(selectedFriday, "yyyy-MM-dd"))
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
        week_ending_date: format(selectedFriday, "yyyy-MM-dd"),
        operation_description: entry.operation_description,
        worker_name: entry.worker_name,
        amount: parseFloat(entry.amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      setNewEntry({
        work_date: format(new Date(), "yyyy-MM-dd"),
        operation_description: "",
        worker_name: "",
        amount: "",
      });
      toast({ title: "Entry added" });
    },
    onError: (error) => {
      toast({ title: "Error adding entry", description: error.message, variant: "destructive" });
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
      toast({ title: "Entry deleted" });
    },
    onError: (error) => {
      toast({ title: "Error deleting entry", description: error.message, variant: "destructive" });
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
      format(new Date(entry.work_date), "dd/MM/yyyy"),
      entry.operation_description,
      entry.worker_name,
      `RD$ ${Number(entry.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ]);
    
    // Add total row
    tableData.push([
      "",
      "",
      "TOTAL:",
      `RD$ ${weeklyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      head: [["Fecha", "Operación", "Trabajador", "Monto"]],
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
        .eq("week_ending_date", format(selectedFriday, "yyyy-MM-dd"));

      if (updateError) throw updateError;

      // Create transaction
      const fridayStr = format(selectedFriday, "dd/MM/yyyy");
      await createTransaction({
        transaction_date: format(selectedFriday, "yyyy-MM-dd"),
        master_acct_code: "7010",
        description: `Jornales Semana ${fridayStr}`,
        currency: "DOP",
        amount: weeklyTotal,
        pay_method: "Transfer BHD",
        document: "Receipts",
        name: "Transfer",
        is_internal: true,
        comments: `Day labor for week ending ${fridayStr}. ${entries.length} entries.`,
      });

      // Generate PDF
      generatePDF();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-labor"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      toast({ title: "Week closed successfully", description: "Transaction created and PDF downloaded." });
    },
    onError: (error) => {
      toast({ title: "Error closing week", description: error.message, variant: "destructive" });
    },
  });

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.operation_description || !newEntry.worker_name || !newEntry.amount) {
      toast({ title: "Please fill all fields", variant: "destructive" });
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
                <CardTitle className="text-lg">
                  Jornales - Semana {format(selectedFriday, "dd/MM/yyyy")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(weekStart, "MMM dd")} - {format(weekEnd, "MMM dd, yyyy")}
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
                  Closed
                </span>
              )}
              <Button variant="outline" onClick={generatePDF} disabled={entries.length === 0}>
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={!canClose || isWeekClosed || entries.length === 0 || closeWeek.isPending}
                    variant="default"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Close Week
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close Week?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        <p>This will:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Lock all entries for this week</li>
                          <li>Create a transaction for RD$ {weeklyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</li>
                          <li>Download a PDF summary</li>
                        </ul>
                        <p className="mt-3 font-medium">This action cannot be undone.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => closeWeek.mutate()}>
                      Close Week
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add Entry Form */}
      {!isWeekClosed && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEntry} className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
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
                <label className="text-sm font-medium">Operation</label>
                <Input
                  value={newEntry.operation_description}
                  onChange={(e) => setNewEntry({ ...newEntry, operation_description: e.target.value })}
                  placeholder="Description of work..."
                />
              </div>
              <div className="space-y-1 min-w-[150px]">
                <label className="text-sm font-medium">Worker Name</label>
                <Input
                  value={newEntry.worker_name}
                  onChange={(e) => setNewEntry({ ...newEntry, worker_name: e.target.value })}
                  placeholder="Worker name..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Amount (RD$)</label>
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
                Add
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
                <TableHead>Date</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {!isWeekClosed && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No entries for this week
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(new Date(entry.work_date), "EEE dd/MM")}
                      </TableCell>
                      <TableCell>{entry.operation_description}</TableCell>
                      <TableCell>{entry.worker_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        RD$ {Number(entry.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                    <TableCell colSpan={3} className="text-right">
                      Weekly Total:
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      RD$ {weeklyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    {!isWeekClosed && <TableCell></TableCell>}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info about closing */}
      {!isWeekClosed && !canClose && (
        <p className="text-sm text-muted-foreground text-center">
          The Close button will be available on Friday ({format(selectedFriday, "MMM dd")})
        </p>
      )}
    </div>
  );
}