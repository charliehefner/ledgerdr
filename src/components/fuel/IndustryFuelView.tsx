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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Fuel, CalendarIcon, Download, ChevronDown, FileSpreadsheet, FileText, Droplets } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseDateLocal, fmtDate } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntityFilter } from "@/hooks/useEntityFilter";

interface FuelTank {
  id: string;
  name: string;
  current_level_gallons: number;
}

interface PlantHourRow {
  id: string;
  date: string;
  start_hour_meter: number | null;
  finish_hour_meter: number | null;
  estimated_diesel_liters: number | null;
  notes: string | null;
}

export function IndustryFuelView() {
  const [activeTab, setActiveTab] = useState("fueling-report");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [isRefillDialogOpen, setIsRefillDialogOpen] = useState(false);
  const [refillForm, setRefillForm] = useState({
    tank_id: "",
    gallons: "",
    notes: "",
  });

  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();

  // Fetch industry tanks
  const { data: tanks = [] } = useQuery({
    queryKey: ["fuelTanks", "industry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, current_level_gallons")
        .eq("use_type", "industry")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelTank[];
    },
  });

  // Fetch plant hours with diesel estimates
  const { data: plantHours = [], isLoading } = useQuery({
    queryKey: ["industrialPlantHoursFuel", selectedEntityId],
    queryFn: async () => {
      let query = supabase
        .from("industrial_plant_hours")
        .select("id, date, start_hour_meter, finish_hour_meter, estimated_diesel_liters, notes")
        .not("estimated_diesel_liters", "is", null)
        .order("date", { ascending: false });

      query = applyEntityFilter(query as any) as typeof query;

      const { data, error } = await query;
      if (error) throw error;
      return data as PlantHourRow[];
    },
  });

  // Filter by date range
  const filteredRows = useMemo(() => {
    if (!dateFrom && !dateTo) return plantHours;
    return plantHours.filter((row) => {
      const d = parseDateLocal(row.date);
      const from = dateFrom ? startOfDay(dateFrom) : new Date(0);
      const to = dateTo ? endOfDay(dateTo) : new Date(9999, 11, 31);
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [plantHours, dateFrom, dateTo]);

  // Summary totals
  const totals = useMemo(() => {
    let totalHours = 0;
    let totalLiters = 0;
    filteredRows.forEach((row) => {
      const hrs = (row.finish_hour_meter ?? 0) - (row.start_hour_meter ?? 0);
      if (hrs > 0) totalHours += hrs;
      totalLiters += row.estimated_diesel_liters ?? 0;
    });
    return { totalHours, totalLiters };
  }, [filteredRows]);

  // Refill mutation (keep existing)
  const refillMutation = useMutation({
    mutationFn: async (data: typeof refillForm) => {
      const gallons = parseFloat(data.gallons);
      const { data: tankRow } = await supabase
        .from("fuel_tanks")
        .select("entity_id")
        .eq("id", data.tank_id)
        .maybeSingle();
      if (!tankRow?.entity_id) throw new Error("Tanque sin entidad asociada");
      const { error } = await supabase.from("fuel_transactions").insert({
        tank_id: data.tank_id,
        transaction_type: "refill",
        gallons,
        notes: data.notes || null,
        entity_id: tankRow.entity_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      toast({ title: "Tank refilled", description: "The tank refill has been recorded." });
      setIsRefillDialogOpen(false);
      setRefillForm({ tank_id: "", gallons: "", notes: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Export fueling report
  const exportToExcel = async () => {
    if (filteredRows.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Industry Fueling Report");

    ws.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Start Hr", key: "start", width: 12 },
      { header: "Finish Hr", key: "finish", width: 12 },
      { header: "Hours Run", key: "hours", width: 12 },
      { header: "Est. Diesel (L)", key: "diesel", width: 16 },
      { header: "Notes", key: "notes", width: 25 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    filteredRows.forEach((row) => {
      const hrs = (row.finish_hour_meter ?? 0) - (row.start_hour_meter ?? 0);
      ws.addRow({
        date: fmtDate(parseDateLocal(row.date)),
        start: row.start_hour_meter ?? "-",
        finish: row.finish_hour_meter ?? "-",
        hours: hrs > 0 ? hrs.toFixed(1) : "-",
        diesel: row.estimated_diesel_liters?.toFixed(1) ?? "-",
        notes: row.notes || "-",
      });
    });

    // Totals
    const totRow = ws.addRow({
      date: "TOTAL",
      start: "",
      finish: "",
      hours: totals.totalHours.toFixed(1),
      diesel: totals.totalLiters.toFixed(1),
      notes: "",
    });
    totRow.font = { bold: true };
    totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Industry_Fueling_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (filteredRows.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Industry Fueling Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${fmtDate(new Date())}`, 14, 22);

    const body = filteredRows.map((row) => {
      const hrs = (row.finish_hour_meter ?? 0) - (row.start_hour_meter ?? 0);
      return [
        fmtDate(parseDateLocal(row.date)),
        row.start_hour_meter?.toString() ?? "-",
        row.finish_hour_meter?.toString() ?? "-",
        hrs > 0 ? hrs.toFixed(1) : "-",
        row.estimated_diesel_liters?.toFixed(1) ?? "-",
        row.notes || "-",
      ];
    });

    body.push([
      "TOTAL", "", "",
      totals.totalHours.toFixed(1),
      totals.totalLiters.toFixed(1),
      "",
    ]);

    autoTable(doc, {
      head: [["Date", "Start Hr", "Finish Hr", "Hours Run", "Est. Diesel (L)", "Notes"]],
      body,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 129, 189] },
      didParseCell: (cellData) => {
        if (cellData.row.index === body.length - 1) {
          cellData.cell.styles.fontStyle = "bold";
          cellData.cell.styles.fillColor = [217, 225, 242];
        }
      },
    });

    doc.save(`Industry_Fueling_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Tank Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="fueling-report">Fueling Report</TabsTrigger>
            <TabsTrigger value="tank-refills">Tank Refills</TabsTrigger>
          </TabsList>

          {activeTab === "fueling-report" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={filteredRows.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover">
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {activeTab === "tank-refills" && (
            <Dialog open={isRefillDialogOpen} onOpenChange={setIsRefillDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Fuel className="mr-2 h-4 w-4" />
                  Record Tank Refill
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Tank Refill</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!refillForm.tank_id || !refillForm.gallons) {
                      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
                      return;
                    }
                    refillMutation.mutate(refillForm);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label>Tank *</Label>
                    <Select value={refillForm.tank_id} onValueChange={(v) => setRefillForm({ ...refillForm, tank_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select tank" /></SelectTrigger>
                      <SelectContent>
                        {tanks.map((tank) => (
                          <SelectItem key={tank.id} value={tank.id}>{tank.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gallons Added *</Label>
                    <Input type="number" step="0.1" value={refillForm.gallons} onChange={(e) => setRefillForm({ ...refillForm, gallons: e.target.value })} placeholder="e.g., 50" />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={refillForm.notes} onChange={(e) => setRefillForm({ ...refillForm, notes: e.target.value })} placeholder="Optional notes" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsRefillDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={refillMutation.isPending}>{refillMutation.isPending ? "Recording..." : "Record Refill"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Fueling Report Tab */}
        <TabsContent value="fueling-report">
          {/* Date filters */}
          <div className="flex items-center gap-4 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "MMM d, yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                Clear
              </Button>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Records</div>
                <div className="text-2xl font-bold">{filteredRows.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Hours Run</div>
                <div className="text-2xl font-bold">{totals.totalHours.toFixed(1)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Droplets className="h-4 w-4" /> Total Est. Diesel (L)
                </div>
                <div className="text-2xl font-bold">{totals.totalLiters.toFixed(1)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Droplets className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No diesel consumption records found.</p>
              <p className="text-sm">Enter estimated diesel in Industrial → Plant Hours to see data here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Start Hr</TableHead>
                  <TableHead className="text-right">Finish Hr</TableHead>
                  <TableHead className="text-right">Hours Run</TableHead>
                  <TableHead className="text-right">Est. Diesel (L)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const hrs = (row.finish_hour_meter ?? 0) - (row.start_hour_meter ?? 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{fmtDate(parseDateLocal(row.date))}</TableCell>
                      <TableCell className="text-right">{row.start_hour_meter ?? "-"}</TableCell>
                      <TableCell className="text-right">{row.finish_hour_meter ?? "-"}</TableCell>
                      <TableCell className="text-right">{hrs > 0 ? hrs.toFixed(1) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{row.estimated_diesel_liters?.toFixed(1) ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.notes || "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">{totals.totalHours.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{totals.totalLiters.toFixed(1)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Tank Refills Tab - shows existing tank refill transactions */}
        <TabsContent value="tank-refills">
          <TankRefillsSection tanks={tanks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Small sub-component showing recent refill transactions for industry tanks */
function TankRefillsSection({ tanks }: { tanks: FuelTank[] }) {
  const { data: refills = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions", "industry", "refills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select("id, transaction_date, gallons, notes, fuel_tanks!tank_id!inner(name, use_type)")
        .eq("fuel_tanks.use_type", "industry")
        .eq("transaction_type", "refill")
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as { id: string; transaction_date: string; gallons: number; notes: string | null; fuel_tanks: { name: string } }[];
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  if (refills.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Fuel className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No tank refills recorded yet.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Tank</TableHead>
          <TableHead className="text-right">Gallons</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {refills.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{fmtDate(parseDateLocal(r.transaction_date))}</TableCell>
            <TableCell>{r.fuel_tanks?.name || "-"}</TableCell>
            <TableCell className="text-right font-medium">{r.gallons.toFixed(1)} gal</TableCell>
            <TableCell className="text-muted-foreground">{r.notes || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
