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

const fmtDt = (v: string | null) => v ? format(new Date(v), "dd/MM/yyyy HH:mm") : "—";

export function TrucksView() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ datetime_in: "", datetime_out: "", tare: "", payload: "", weigh_ticket_number: "", destination_payload: "", notes: "", identifier: "" });
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["industrial-trucks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("industrial_trucks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("industrial_trucks").insert({
        datetime_in: form.datetime_in || null,
        datetime_out: form.datetime_out || null,
        tare: form.tare ? Number(form.tare) : null,
        payload: form.payload ? Number(form.payload) : null,
        weigh_ticket_number: form.weigh_ticket_number || null,
        destination_payload: form.destination_payload || null,
        notes: form.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrial-trucks"] });
      setOpen(false);
      setForm({ datetime_in: "", datetime_out: "", tare: "", payload: "", weigh_ticket_number: "", destination_payload: "", notes: "" });
      toast({ title: "Registro agregado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("industrial_trucks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["industrial-trucks"] });
      toast({ title: "Registro eliminado" });
    },
  });

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Camiones");
    ws.columns = [
      { header: "Entrada", key: "in", width: 20 },
      { header: "Salida", key: "out", width: 20 },
      { header: "Tara", key: "tare", width: 10 },
      { header: "Payload", key: "payload", width: 10 },
      { header: "Ticket #", key: "ticket", width: 14 },
      { header: "Destino Payload", key: "dest", width: 18 },
      { header: "Notas", key: "notes", width: 25 },
    ];
    rows.forEach((r) => ws.addRow({
      in: r.datetime_in ? fmtDt(r.datetime_in) : "", out: r.datetime_out ? fmtDt(r.datetime_out) : "",
      tare: r.tare, payload: r.payload, ticket: r.weigh_ticket_number, dest: r.destination_payload, notes: r.notes,
    }));
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "camiones.xlsx"; a.click();
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("Camiones", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Entrada", "Salida", "Tara", "Payload", "Ticket #", "Destino Payload", "Notas"]],
      body: rows.map((r) => [fmtDt(r.datetime_in), fmtDt(r.datetime_out), r.tare ?? "", r.payload ?? "", r.weigh_ticket_number || "", r.destination_payload || "", r.notes || ""]),
    });
    doc.save("camiones.pdf");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Agregar</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Camión</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>Fecha/Hora Entrando</Label><Input type="datetime-local" value={form.datetime_in} onChange={(e) => setForm({ ...form, datetime_in: e.target.value })} /></div>
              <div><Label>Fecha/Hora Saliendo</Label><Input type="datetime-local" value={form.datetime_out} onChange={(e) => setForm({ ...form, datetime_out: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tara</Label><Input type="number" step="0.01" value={form.tare} onChange={(e) => setForm({ ...form, tare: e.target.value })} /></div>
                <div><Label>Payload</Label><Input type="number" step="0.01" value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} /></div>
              </div>
              <div><Label>Ticket de Peso #</Label><Input value={form.weigh_ticket_number} onChange={(e) => setForm({ ...form, weigh_ticket_number: e.target.value })} /></div>
              <div><Label>Destino Payload</Label><Input value={form.destination_payload} onChange={(e) => setForm({ ...form, destination_payload: e.target.value })} /></div>
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
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead>Tara</TableHead>
              <TableHead>Payload</TableHead>
              <TableHead>Ticket #</TableHead>
              <TableHead>Destino Payload</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDt(r.datetime_in)}</TableCell>
                <TableCell>{fmtDt(r.datetime_out)}</TableCell>
                <TableCell>{r.tare ?? "—"}</TableCell>
                <TableCell>{r.payload ?? "—"}</TableCell>
                <TableCell>{r.weigh_ticket_number || "—"}</TableCell>
                <TableCell>{r.destination_payload || "—"}</TableCell>
                <TableCell>{r.notes || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
