import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Download, FileSpreadsheet, FileText, ChevronDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function PlantHoursView() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", start_hour_meter: "", finish_hour_meter: "", notes: "" });
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["industrial-plant-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("industrial_plant_hours")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("industrial_plant_hours").insert({
        date: form.date || null,
        start_hour_meter: form.start_hour_meter ? Number(form.start_hour_meter) : null,
        finish_hour_meter: form.finish_hour_meter ? Number(form.finish_hour_meter) : null,
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrial-plant-hours"] });
      setOpen(false);
      setForm({ date: "", start_hour_meter: "", finish_hour_meter: "", notes: "" });
      toast({ title: "Registro agregado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("industrial_plant_hours").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrial-plant-hours"] });
      toast({ title: "Registro eliminado" });
    },
  });

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Horas Planta");
    ws.columns = [
      { header: "Fecha", key: "date", width: 14 },
      { header: "Inicio", key: "start", width: 12 },
      { header: "Final", key: "finish", width: 12 },
      { header: "Horas", key: "hours", width: 10 },
      { header: "Notas", key: "notes", width: 30 },
    ];
    rows.forEach((r) => {
      const hrs = r.start_hour_meter != null && r.finish_hour_meter != null
        ? Number(r.finish_hour_meter) - Number(r.start_hour_meter) : null;
      ws.addRow({ date: r.date, start: r.start_hour_meter, finish: r.finish_hour_meter, hours: hrs, notes: r.notes });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "horas_planta.xlsx"; a.click();
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text("Horas Planta", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Fecha", "Inicio", "Final", "Horas", "Notas"]],
      body: rows.map((r) => {
        const hrs = r.start_hour_meter != null && r.finish_hour_meter != null
          ? (Number(r.finish_hour_meter) - Number(r.start_hour_meter)).toFixed(1) : "";
        return [r.date || "", r.start_hour_meter ?? "", r.finish_hour_meter ?? "", hrs, r.notes || ""];
      }),
    });
    doc.save("horas_planta.pdf");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Registro — Horas Planta</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>Fecha</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Horómetro Inicio</Label><Input type="number" step="0.1" value={form.start_hour_meter} onChange={(e) => setForm({ ...form, start_hour_meter: e.target.value })} /></div>
              <div><Label>Horómetro Final</Label><Input type="number" step="0.1" value={form.finish_hour_meter} onChange={(e) => setForm({ ...form, finish_hour_meter: e.target.value })} /></div>
              <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>Guardar</Button>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Exportar <ChevronDown className="h-3 w-3 ml-1" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" /> Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={exportPdf}><FileText className="h-4 w-4 mr-2" /> PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Final</TableHead>
              <TableHead>Horas</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>
            ) : rows.map((r) => {
              const hrs = r.start_hour_meter != null && r.finish_hour_meter != null
                ? (Number(r.finish_hour_meter) - Number(r.start_hour_meter)).toFixed(1) : "—";
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.date || "—"}</TableCell>
                  <TableCell>{r.start_hour_meter ?? "—"}</TableCell>
                  <TableCell>{r.finish_hour_meter ?? "—"}</TableCell>
                  <TableCell>{hrs}</TableCell>
                  <TableCell>{r.notes || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
