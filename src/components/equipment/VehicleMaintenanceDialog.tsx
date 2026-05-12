import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { fmtDate, parseDateLocal } from "@/lib/dateUtils";
import { toast } from "sonner";
import { useEntity } from "@/contexts/EntityContext";

interface Props {
  vehicleId: string | null;
  vehicleName: string;
  currentKm: number;
  maintenanceInterval: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  km_reading: number;
  maintenance_type: string;
  notes: string | null;
  created_at: string;
}

export function VehicleMaintenanceDialog({
  vehicleId, vehicleName, currentKm, maintenanceInterval, open, onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const { selectedEntityId } = useEntity();
  const [form, setForm] = useState({
    maintenance_date: new Date().toISOString().slice(0, 10),
    km_reading: String(currentKm || 0),
    maintenance_type: "",
    notes: "",
  });

  const { data: records = [] } = useQuery({
    queryKey: ["vehicle-maintenance", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];
      const { data, error } = await supabase
        .from("vehicle_maintenance" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MaintenanceRecord[];
    },
    enabled: !!vehicleId && open,
  });

  const lastKm = records.length > 0 ? Math.max(...records.map(r => Number(r.km_reading))) : 0;
  const kmSince = currentKm - lastKm;
  const kmRemaining = maintenanceInterval - kmSince;
  const isOverdue = kmRemaining <= 0;
  const isDueSoon = kmRemaining > 0 && kmRemaining <= maintenanceInterval * 0.1;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!vehicleId) return;
      const { error } = await supabase.from("vehicle_maintenance" as any).insert({
        vehicle_id: vehicleId,
        maintenance_date: form.maintenance_date,
        km_reading: parseFloat(form.km_reading) || 0,
        maintenance_type: form.maintenance_type,
        notes: form.notes || null,
        ...(selectedEntityId ? { entity_id: selectedEntityId } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle-maintenance"] });
      qc.invalidateQueries({ queryKey: ["vehicles-latest-maintenance"] });
      qc.invalidateQueries({ queryKey: ["alert-vehicle-maintenance"] });
      setForm({ ...form, maintenance_type: "", notes: "" });
      toast.success("Mantenimiento registrado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_maintenance" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle-maintenance"] });
      qc.invalidateQueries({ queryKey: ["vehicles-latest-maintenance"] });
      qc.invalidateQueries({ queryKey: ["alert-vehicle-maintenance"] });
      toast.success("Eliminado");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mantenimiento — {vehicleName}</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border p-3 flex items-center gap-3 text-sm">
          {isOverdue ? (
            <><AlertTriangle className="h-4 w-4 text-destructive" /><span className="font-medium text-destructive">Mantenimiento vencido por {Math.abs(Math.round(kmRemaining)).toLocaleString()} km</span></>
          ) : isDueSoon ? (
            <><Clock className="h-4 w-4 text-amber-600" /><span className="font-medium text-amber-700">Faltan {Math.round(kmRemaining).toLocaleString()} km</span></>
          ) : (
            <><CheckCircle className="h-4 w-4 text-emerald-600" /><span>Faltan {Math.round(kmRemaining).toLocaleString()} km para próximo mantenimiento</span></>
          )}
          <span className="text-muted-foreground ml-auto">
            Km actual: {Number(currentKm).toLocaleString()} · Intervalo: {maintenanceInterval.toLocaleString()} km
          </span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (form.maintenance_type) addMutation.mutate(); }} className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={form.maintenance_date} onChange={(e) => setForm({ ...form, maintenance_date: e.target.value })} />
          </div>
          <div>
            <Label>Km</Label>
            <Input type="number" value={form.km_reading} onChange={(e) => setForm({ ...form, km_reading: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Tipo de mantenimiento *</Label>
            <Input value={form.maintenance_type} onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })} placeholder="ej. Cambio de aceite" />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" disabled={addMutation.isPending || !form.maintenance_type}>
              <Plus className="h-4 w-4 mr-1" /> Registrar
            </Button>
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>
            ) : records.map(r => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(parseDateLocal(r.maintenance_date))}</TableCell>
                <TableCell>{r.maintenance_type}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.km_reading).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.notes}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
