import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Fuel, Tractor, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, FileSpreadsheet, FileText, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { useAuth } from "@/contexts/AuthContext";

type SortField = "transaction_date" | "tank" | "tractor" | "hour_meter" | "pump_start" | "pump_end" | "gallons" | null;
type SortDirection = "asc" | "desc";

interface FuelTank {
  id: string;
  name: string;
  current_level_gallons: number;
}

interface FuelEquipment {
  id: string;
  name: string;
  current_hour_meter: number;
}

interface FuelTransaction {
  id: string;
  tank_id: string;
  equipment_id: string;
  transaction_date: string;
  gallons: number;
  pump_start_reading: number;
  pump_end_reading: number;
  hour_meter_reading: number;
  notes: string | null;
  fuel_tanks: { name: string };
  fuel_equipment: { name: string };
}

export function AgricultureFuelView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FuelTransaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<FuelTransaction | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [form, setForm] = useState({
    tank_id: "",
    equipment_id: "",
    pump_start_reading: "",
    pump_end_reading: "",
    hour_meter_reading: "",
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    pump_start_reading: "",
    pump_end_reading: "",
    hour_meter_reading: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Fetch agriculture tanks
  const { data: tanks = [] } = useQuery({
    queryKey: ["fuelTanks", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, current_level_gallons")
        .eq("use_type", "agriculture")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelTank[];
    },
  });

  // Fetch tractors
  const { data: tractors = [] } = useQuery({
    queryKey: ["fuelEquipment", "tractor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelEquipment[];
    },
  });

  // Fetch all transactions (we'll filter by date client-side for flexibility)
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select(`
          *,
          fuel_tanks!inner(name, use_type),
          fuel_equipment!inner(name, equipment_type)
        `)
        .eq("fuel_tanks.use_type", "agriculture")
        .eq("transaction_type", "dispense")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as FuelTransaction[];
    },
  });

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactions;
    
    return transactions.filter((tx) => {
      const txDate = new Date(tx.transaction_date);
      if (startDate && endDate) {
        return isWithinInterval(txDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        });
      }
      if (startDate) {
        return txDate >= startOfDay(startDate);
      }
      if (endDate) {
        return txDate <= endOfDay(endDate);
      }
      return true;
    });
  }, [transactions, startDate, endDate]);

  const dispenseMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const pumpStart = parseFloat(data.pump_start_reading);
      const pumpEnd = parseFloat(data.pump_end_reading);
      const gallons = pumpEnd - pumpStart;
      const hourMeter = parseFloat(data.hour_meter_reading);

      if (gallons <= 0) {
        throw new Error("End reading must be greater than start reading");
      }

      // Get equipment's previous hour meter
      const { data: equipment } = await supabase
        .from("fuel_equipment")
        .select("current_hour_meter")
        .eq("id", data.equipment_id)
        .single();

      // Insert transaction
      const { error: txError } = await supabase.from("fuel_transactions").insert({
        tank_id: data.tank_id,
        equipment_id: data.equipment_id,
        transaction_type: "dispense",
        gallons,
        pump_start_reading: pumpStart,
        pump_end_reading: pumpEnd,
        hour_meter_reading: hourMeter,
        previous_hour_meter: equipment?.current_hour_meter || 0,
        notes: data.notes || null,
      });
      if (txError) throw txError;

      // Update tank level
      const { data: tank } = await supabase
        .from("fuel_tanks")
        .select("current_level_gallons")
        .eq("id", data.tank_id)
        .single();

      if (tank) {
        const { error: tankError } = await supabase
          .from("fuel_tanks")
          .update({ current_level_gallons: Math.max(0, tank.current_level_gallons - gallons) })
          .eq("id", data.tank_id);
        if (tankError) throw tankError;
      }

      // Update equipment hour meter
      const { error: equipError } = await supabase
        .from("fuel_equipment")
        .update({ current_hour_meter: hourMeter })
        .eq("id", data.equipment_id);
      if (equipError) throw equipError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      queryClient.invalidateQueries({ queryKey: ["fuelEquipment"] });
      toast({
        title: "Fueling recorded",
        description: "The fuel dispensing has been recorded.",
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit mutation (admin only)
  const editMutation = useMutation({
    mutationFn: async (data: { id: string; originalTx: FuelTransaction } & typeof editForm) => {
      const pumpStart = parseFloat(data.pump_start_reading);
      const pumpEnd = parseFloat(data.pump_end_reading);
      const newGallons = pumpEnd - pumpStart;
      const hourMeter = parseFloat(data.hour_meter_reading);
      const gallonsDiff = newGallons - data.originalTx.gallons;

      if (newGallons <= 0) {
        throw new Error("End reading must be greater than start reading");
      }

      // Update transaction
      const { error: txError } = await supabase
        .from("fuel_transactions")
        .update({
          pump_start_reading: pumpStart,
          pump_end_reading: pumpEnd,
          hour_meter_reading: hourMeter,
          gallons: newGallons,
          notes: data.notes || null,
        })
        .eq("id", data.id);
      if (txError) throw txError;

      // Update tank level based on difference
      if (gallonsDiff !== 0) {
        const { data: tank } = await supabase
          .from("fuel_tanks")
          .select("current_level_gallons")
          .eq("id", data.originalTx.tank_id)
          .single();

        if (tank) {
          const { error: tankError } = await supabase
            .from("fuel_tanks")
            .update({ current_level_gallons: Math.max(0, tank.current_level_gallons - gallonsDiff) })
            .eq("id", data.originalTx.tank_id);
          if (tankError) throw tankError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      toast({
        title: "Transaction updated",
        description: "The fuel transaction has been updated.",
      });
      handleCloseEditDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation (admin only)
  const deleteMutation = useMutation({
    mutationFn: async (tx: FuelTransaction) => {
      // Restore tank level
      const { data: tank } = await supabase
        .from("fuel_tanks")
        .select("current_level_gallons, capacity_gallons")
        .eq("id", tx.tank_id)
        .single();

      if (tank) {
        const newLevel = Math.min(tank.capacity_gallons, tank.current_level_gallons + tx.gallons);
        const { error: tankError } = await supabase
          .from("fuel_tanks")
          .update({ current_level_gallons: newLevel })
          .eq("id", tx.tank_id);
        if (tankError) throw tankError;
      }

      // Delete transaction
      const { error } = await supabase
        .from("fuel_transactions")
        .delete()
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      toast({
        title: "Transaction deleted",
        description: "The fuel transaction has been deleted.",
      });
      setDeleteTransaction(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setForm({
      tank_id: "",
      equipment_id: "",
      pump_start_reading: "",
      pump_end_reading: "",
      hour_meter_reading: "",
      notes: "",
    });
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingTransaction(null);
    setEditForm({
      pump_start_reading: "",
      pump_end_reading: "",
      hour_meter_reading: "",
      notes: "",
    });
  };

  const handleEdit = (tx: FuelTransaction) => {
    setEditingTransaction(tx);
    setEditForm({
      pump_start_reading: tx.pump_start_reading.toString(),
      pump_end_reading: tx.pump_end_reading.toString(),
      hour_meter_reading: tx.hour_meter_reading.toString(),
      notes: tx.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    if (!editForm.pump_start_reading || !editForm.pump_end_reading || !editForm.hour_meter_reading) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    editMutation.mutate({
      id: editingTransaction.id,
      originalTx: editingTransaction,
      ...editForm,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tank_id || !form.equipment_id || !form.pump_start_reading || !form.pump_end_reading || !form.hour_meter_reading) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    dispenseMutation.mutate(form);
  };

  const calculatedGallons =
    form.pump_start_reading && form.pump_end_reading
      ? Math.max(0, parseFloat(form.pump_end_reading) - parseFloat(form.pump_start_reading))
      : 0;

  const selectedTractor = tractors.find((t) => t.id === form.equipment_id);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === "desc" ? (
      <ArrowDown className="ml-1 h-4 w-4" />
    ) : (
      <ArrowUp className="ml-1 h-4 w-4" />
    );
  };

  const sortedTransactions = useMemo(() => {
    if (!sortField) return filteredTransactions;

    return [...filteredTransactions].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "transaction_date":
          comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
          break;
        case "tank":
          comparison = a.fuel_tanks.name.localeCompare(b.fuel_tanks.name);
          break;
        case "tractor":
          comparison = a.fuel_equipment.name.localeCompare(b.fuel_equipment.name);
          break;
        case "hour_meter":
          comparison = a.hour_meter_reading - b.hour_meter_reading;
          break;
        case "pump_start":
          comparison = a.pump_start_reading - b.pump_start_reading;
          break;
        case "pump_end":
          comparison = a.pump_end_reading - b.pump_end_reading;
          break;
        case "gallons":
          comparison = a.gallons - b.gallons;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredTransactions, sortField, sortDirection]);

  const totalGallons = useMemo(() => {
    return sortedTransactions.reduce((sum, tx) => sum + tx.gallons, 0);
  }, [sortedTransactions]);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fueling Report");

    // Add title
    worksheet.mergeCells("A1:H1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Agriculture Fueling Report";
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center" };

    // Add date range
    worksheet.mergeCells("A2:H2");
    const dateRangeCell = worksheet.getCell("A2");
    const dateRangeText = startDate && endDate 
      ? `Period: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
      : "All dates";
    dateRangeCell.value = dateRangeText;
    dateRangeCell.alignment = { horizontal: "center" };

    // Add headers
    const headers = ["Date/Time", "Tank", "Tractor", "Hour Meter", "Pump Start", "Pump End", "Gallons", "Notes"];
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    });

    // Add data
    sortedTransactions.forEach((tx) => {
      worksheet.addRow([
        format(new Date(tx.transaction_date), "dd/MM/yyyy HH:mm"),
        tx.fuel_tanks.name,
        tx.fuel_equipment.name,
        tx.hour_meter_reading,
        tx.pump_start_reading,
        tx.pump_end_reading,
        tx.gallons,
        tx.notes || "",
      ]);
    });

    // Add total row
    worksheet.addRow([]);
    const totalRow = worksheet.addRow(["", "", "", "", "", "TOTAL:", totalGallons.toFixed(1), ""]);
    totalRow.font = { bold: true };

    // Auto-width columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fueling-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Excel file has been downloaded.",
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Agriculture Fueling Report", 14, 20);
    
    // Date range
    doc.setFontSize(10);
    const dateRangeText = startDate && endDate 
      ? `Period: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
      : "All dates";
    doc.text(dateRangeText, 14, 28);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);

    // Table data
    const tableData = sortedTransactions.map((tx) => [
      format(new Date(tx.transaction_date), "dd/MM/yyyy HH:mm"),
      tx.fuel_tanks.name,
      tx.fuel_equipment.name,
      tx.hour_meter_reading.toString(),
      tx.pump_start_reading.toString(),
      tx.pump_end_reading.toString(),
      tx.gallons.toFixed(1),
      tx.notes || "-",
    ]);

    // Add total row
    tableData.push(["", "", "", "", "", "TOTAL:", totalGallons.toFixed(1), ""]);

    autoTable(doc, {
      startY: 40,
      head: [["Date/Time", "Tank", "Tractor", "Hour Meter", "Pump Start", "Pump End", "Gallons", "Notes"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [80, 80, 80] },
      didParseCell: (data) => {
        // Bold the total row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`fueling-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);

    toast({
      title: "Export Complete",
      description: "PDF file has been downloaded.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {tanks.map((tank) => (
          <Card key={tank.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{tank.name}</CardTitle>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tank.current_level_gallons.toLocaleString()} gal
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Fueling Report</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "Start Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "End Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Export Buttons */}
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={sortedTransactions.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={sortedTransactions.length === 0}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>

          {/* Record Fueling */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Record Fueling
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Tractor Fueling</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Tank *</Label>
                  <Select
                    value={form.tank_id}
                    onValueChange={(value) => setForm({ ...form, tank_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tank" />
                    </SelectTrigger>
                    <SelectContent>
                      {tanks.map((tank) => (
                        <SelectItem key={tank.id} value={tank.id}>
                          {tank.name} ({tank.current_level_gallons} gal available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tractor *</Label>
                  <Select
                    value={form.equipment_id}
                    onValueChange={(value) => setForm({ ...form, equipment_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tractor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tractors.map((tractor) => (
                        <SelectItem key={tractor.id} value={tractor.id}>
                          {tractor.name} ({tractor.current_hour_meter} hrs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTractor && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    <Tractor className="inline h-4 w-4 mr-1" />
                    Last hour meter: {selectedTractor.current_hour_meter} hrs
                  </div>
                )}

                <div>
                  <Label>Current Hour Meter Reading *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.hour_meter_reading}
                    onChange={(e) =>
                      setForm({ ...form, hour_meter_reading: e.target.value })
                    }
                    placeholder="e.g., 1234.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Pump Start Reading *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.pump_start_reading}
                      onChange={(e) =>
                        setForm({ ...form, pump_start_reading: e.target.value })
                      }
                      placeholder="e.g., 5000"
                    />
                  </div>
                  <div>
                    <Label>Pump End Reading *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.pump_end_reading}
                      onChange={(e) =>
                        setForm({ ...form, pump_end_reading: e.target.value })
                      }
                      placeholder="e.g., 5045"
                    />
                  </div>
                </div>

                {calculatedGallons > 0 && (
                  <div className="text-sm font-medium text-primary bg-primary/10 p-2 rounded">
                    Gallons to dispense: {calculatedGallons.toFixed(1)}
                  </div>
                )}

                <div>
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={dispenseMutation.isPending}>
                    {dispenseMutation.isPending ? "Recording..." : "Record"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      {sortedTransactions.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {sortedTransactions.length} records | Total: <span className="font-semibold text-foreground">{totalGallons.toFixed(1)} gallons</span>
        </div>
      )}

      {/* Transactions Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading transactions...</div>
      ) : sortedTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tractor className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No fueling records found.</p>
          <p className="text-sm">Adjust the date range or record a new fueling.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("transaction_date")}
                >
                  Date/Time
                  {getSortIcon("transaction_date")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("tank")}
                >
                  Tank
                  {getSortIcon("tank")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("tractor")}
                >
                  Tractor
                  {getSortIcon("tractor")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("hour_meter")}
                >
                  Hour Meter
                  {getSortIcon("hour_meter")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("pump_start")}
                >
                  Pump Start
                  {getSortIcon("pump_start")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("pump_end")}
                >
                  Pump End
                  {getSortIcon("pump_end")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 hover:bg-transparent"
                  onClick={() => handleSort("gallons")}
                >
                  Gallons
                  {getSortIcon("gallons")}
                </Button>
              </TableHead>
              <TableHead>Notes</TableHead>
              {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  {format(new Date(tx.transaction_date), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>{tx.fuel_tanks.name}</TableCell>
                <TableCell>{tx.fuel_equipment.name}</TableCell>
                <TableCell>{tx.hour_meter_reading} hrs</TableCell>
                <TableCell>{tx.pump_start_reading}</TableCell>
                <TableCell>{tx.pump_end_reading}</TableCell>
                <TableCell className="font-medium">{tx.gallons.toFixed(1)} gal</TableCell>
                <TableCell className="text-muted-foreground">{tx.notes || "-"}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(tx)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTransaction(tx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit Dialog (Admin Only) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Fuel Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editingTransaction && (
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded space-y-1">
                <p><strong>Tank:</strong> {editingTransaction.fuel_tanks.name}</p>
                <p><strong>Tractor:</strong> {editingTransaction.fuel_equipment.name}</p>
                <p><strong>Date:</strong> {format(new Date(editingTransaction.transaction_date), "MMM d, yyyy HH:mm")}</p>
              </div>
            )}

            <div>
              <Label>Current Hour Meter Reading *</Label>
              <Input
                type="number"
                step="0.1"
                value={editForm.hour_meter_reading}
                onChange={(e) =>
                  setEditForm({ ...editForm, hour_meter_reading: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pump Start Reading *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.pump_start_reading}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pump_start_reading: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Pump End Reading *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.pump_end_reading}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pump_end_reading: e.target.value })
                  }
                />
              </div>
            </div>

            {editForm.pump_start_reading && editForm.pump_end_reading && (
              <div className="text-sm font-medium text-primary bg-primary/10 p-2 rounded">
                Gallons: {Math.max(0, parseFloat(editForm.pump_end_reading) - parseFloat(editForm.pump_start_reading)).toFixed(1)}
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseEditDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (Admin Only) */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={(open) => !open && setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fuel Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the fueling record and restore {deleteTransaction?.gallons.toFixed(1)} gallons to the tank. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTransaction && deleteMutation.mutate(deleteTransaction)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
