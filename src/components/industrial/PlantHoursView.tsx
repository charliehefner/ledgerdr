import { useState, useMemo } from "react";
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
import { Plus, Download, FileSpreadsheet, FileText, ChevronDown, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { useLanguage } from "@/contexts/LanguageContext";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const firstOfMonthISO = () => {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");
};

export function PlantHoursView() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", start_hour_meter: "", finish_hour_meter: "", estimated_tons: "", estimated_diesel_liters: "", notes: "" });
  const [statsStart, setStatsStart] = useState<string>(firstOfMonthISO());
  const [statsEnd, setStatsEnd] = useState<string>(todayISO());
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();

  const resetForm = () => {
    setForm({ date: "", start_hour_meter: "", finish_hour_meter: "", estimated_tons: "", estimated_diesel_liters: "", notes: "" });
    setEditingId(null);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      date: row.date || "",
      start_hour_meter: row.start_hour_meter != null ? String(row.start_hour_meter) : "",
      finish_hour_meter: row.finish_hour_meter != null ? String(row.finish_hour_meter) : "",
      estimated_tons: row.estimated_tons != null ? String(row.estimated_tons) : "",
      estimated_diesel_liters: row.estimated_diesel_liters != null ? String(row.estimated_diesel_liters) : "",
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["industrial-plant-hours", selectedEntityId],
    queryFn: async () => {
      let query: any = supabase
        .from("industrial_plant_hours")
        .select("*")
        .order("date", { ascending: false });
      query = applyEntityFilter(query);
      const { data, error } = await query;
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
        estimated_tons: form.estimated_tons ? Number(form.estimated_tons) : null,
        estimated_diesel_liters: form.estimated_diesel_liters ? Number(form.estimated_diesel_liters) : null,
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrial-plant-hours"] });
      setOpen(false);
      resetForm();
      toast({ title: t("industrial.recordAdded") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase.from("industrial_plant_hours").update({
        date: form.date || null,
        start_hour_meter: form.start_hour_meter ? Number(form.start_hour_meter) : null,
        finish_hour_meter: form.finish_hour_meter ? Number(form.finish_hour_meter) : null,
        estimated_tons: form.estimated_tons ? Number(form.estimated_tons) : null,
        estimated_diesel_liters: form.estimated_diesel_liters ? Number(form.estimated_diesel_liters) : null,
        notes: form.notes || null,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrial-plant-hours"] });
      setOpen(false);
      resetForm();
      toast({ title: t("industrial.recordUpdated") || "Record updated" });
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
      toast({ title: t("industrial.recordDeleted") });
    },
  });

  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t("industrial.plantHours"));
    ws.columns = [
      { header: t("industrial.date"), key: "date", width: 14 },
      { header: t("industrial.start"), key: "start", width: 12 },
      { header: t("industrial.finish"), key: "finish", width: 12 },
      { header: t("industrial.hours"), key: "hours", width: 10 },
      { header: t("industrial.estimatedTons"), key: "estimated_tons", width: 14 },
      { header: t("industrial.estimatedDiesel"), key: "estimated_diesel_liters", width: 14 },
      { header: t("industrial.notes"), key: "notes", width: 30 },
    ];
    rows.forEach((r: any) => {
      const hrs = r.start_hour_meter != null && r.finish_hour_meter != null
        ? Number(r.finish_hour_meter) - Number(r.start_hour_meter) : null;
      ws.addRow({ date: r.date, start: r.start_hour_meter, finish: r.finish_hour_meter, hours: hrs, estimated_tons: r.estimated_tons, estimated_diesel_liters: r.estimated_diesel_liters, notes: r.notes });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "horas_planta.xlsx"; a.click();
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.text(t("industrial.plantHours"), 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [[t("industrial.date"), t("industrial.start"), t("industrial.finish"), t("industrial.hours"), t("industrial.estimatedTons"), t("industrial.estimatedDiesel"), t("industrial.notes")]],
      body: rows.map((r: any) => {
        const hrs = r.start_hour_meter != null && r.finish_hour_meter != null
          ? (Number(r.finish_hour_meter) - Number(r.start_hour_meter)).toFixed(1) : "";
        return [r.date || "", r.start_hour_meter ?? "", r.finish_hour_meter ?? "", hrs, r.estimated_tons ?? "", r.estimated_diesel_liters ?? "", r.notes || ""];
      }),
    });
    doc.save("horas_planta.pdf");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}><Plus className="h-4 w-4 mr-1" /> {t("industrial.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? (t("industrial.editPlantHours") || "Edit Record") : t("industrial.newPlantHours")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>{t("industrial.date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>{t("industrial.startMeter")}</Label><Input type="number" step="0.1" value={form.start_hour_meter} onChange={(e) => setForm({ ...form, start_hour_meter: e.target.value })} /></div>
              <div><Label>{t("industrial.finishMeter")}</Label><Input type="number" step="0.1" value={form.finish_hour_meter} onChange={(e) => setForm({ ...form, finish_hour_meter: e.target.value })} /></div>
              <div><Label>{t("industrial.estimatedTons")}</Label><Input type="number" step="0.01" value={form.estimated_tons} onChange={(e) => setForm({ ...form, estimated_tons: e.target.value })} /></div>
              <div><Label>{t("industrial.estimatedDiesel")}</Label><Input type="number" step="0.1" value={form.estimated_diesel_liters} onChange={(e) => setForm({ ...form, estimated_diesel_liters: e.target.value })} /></div>
              <div><Label>{t("industrial.notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={() => editingId ? updateMutation.mutate() : addMutation.mutate()} disabled={addMutation.isPending || updateMutation.isPending}>{t("industrial.save")}</Button>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> {t("industrial.export")} <ChevronDown className="h-3 w-3 ml-1" /></Button>
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
              <TableHead>{t("industrial.date")}</TableHead>
              <TableHead>{t("industrial.start")}</TableHead>
              <TableHead>{t("industrial.finish")}</TableHead>
              <TableHead>{t("industrial.hours")}</TableHead>
              <TableHead>{t("industrial.estimatedTons")}</TableHead>
              <TableHead>{t("industrial.estimatedDiesel")}</TableHead>
              <TableHead>{t("industrial.notes")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("industrial.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("industrial.noRecords")}</TableCell></TableRow>
            ) : rows.map((r: any) => {
              const hrs = r.start_hour_meter != null && r.finish_hour_meter != null
                ? (Number(r.finish_hour_meter) - Number(r.start_hour_meter)).toFixed(1) : "—";
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.date || "—"}</TableCell>
                  <TableCell>{r.start_hour_meter ?? "—"}</TableCell>
                  <TableCell>{r.finish_hour_meter ?? "—"}</TableCell>
                  <TableCell>{hrs}</TableCell>
                  <TableCell>{r.estimated_tons ?? "—"}</TableCell>
                  <TableCell>{r.estimated_diesel_liters ?? "—"}</TableCell>
                  <TableCell>{r.notes || "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
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
