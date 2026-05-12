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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Eye, Wrench, Car, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, parseDateLocal } from "@/lib/dateUtils";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { VehicleMaintenanceDialog } from "./VehicleMaintenanceDialog";

interface Vehicle {
  id: string;
  vehicle_type: "motorcycle" | "pickup" | "car";
  name: string;
  brand: string | null;
  model: string | null;
  vin: string | null;
  license_plate: string | null;
  maintenance_interval_km: number;
  insurance_expiration: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  current_km: number;
  is_active: boolean;
}

const emptyForm = {
  vehicle_type: "pickup",
  name: "",
  brand: "",
  model: "",
  vin: "",
  license_plate: "",
  maintenance_interval_km: "5000",
  insurance_expiration: "",
  purchase_date: "",
  purchase_cost: "",
  current_km: "0",
};

const typeLabel = (t: string) =>
  t === "motorcycle" ? "Motocicleta" : t === "pickup" ? "Pickup" : "Carro";

export function VehiclesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [viewing, setViewing] = useState<Vehicle | null>(null);
  const [maintenanceFor, setMaintenanceFor] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", selectedEntityId],
    queryFn: async () => {
      let q: any = supabase.from("vehicles" as any).select("*").order("name");
      q = applyEntityFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Vehicle[];
    },
  });

  const { data: latestMaintenance = [] } = useQuery({
    queryKey: ["vehicles-latest-maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_maintenance" as any)
        .select("vehicle_id, km_reading")
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      const map = new Map<string, number>();
      ((data || []) as any[]).forEach((m) => {
        const cur = map.get(m.vehicle_id) ?? 0;
        if (m.km_reading > cur) map.set(m.vehicle_id, m.km_reading);
      });
      return Array.from(map.entries()).map(([vehicle_id, km]) => ({ vehicle_id, km }));
    },
  });

  const getStatus = (v: Vehicle) => {
    const last = latestMaintenance.find((m) => m.vehicle_id === v.id)?.km ?? 0;
    const since = Number(v.current_km) - last;
    const remaining = v.maintenance_interval_km - since;
    return {
      remaining,
      isOverdue: remaining <= 0,
      isDueSoon: remaining > 0 && remaining <= v.maintenance_interval_km * 0.1,
    };
  };

  const overdue = useMemo(
    () => (vehicles || []).filter((v) => v.is_active && getStatus(v).isOverdue),
    [vehicles, latestMaintenance]
  );

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record: any = {
        vehicle_type: data.vehicle_type,
        name: data.name.trim(),
        brand: data.brand || null,
        model: data.model || null,
        vin: data.vin || null,
        license_plate: data.license_plate || null,
        maintenance_interval_km: parseInt(data.maintenance_interval_km) || 5000,
        insurance_expiration: data.insurance_expiration || null,
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost ? parseFloat(data.purchase_cost) : null,
      };
      if (editing) {
        const { error } = await supabase.from("vehicles" as any).update(record).eq("id", editing.id);
        if (error) throw error;
      } else {
        if (!selectedEntityId) throw new Error("Selecciona una entidad antes de crear");
        record.entity_id = selectedEntityId;
        record.current_km = parseFloat(data.current_km) || 0;
        const { error } = await supabase.from("vehicles" as any).insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicles-active"] });
      toast({ title: editing ? "Vehículo actualizado" : "Vehículo agregado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      vehicle_type: v.vehicle_type,
      name: v.name,
      brand: v.brand || "",
      model: v.model || "",
      vin: v.vin || "",
      license_plate: v.license_plate || "",
      maintenance_interval_km: String(v.maintenance_interval_km),
      insurance_expiration: v.insurance_expiration || "",
      purchase_date: v.purchase_date || "",
      purchase_cost: v.purchase_cost?.toString() || "",
      current_km: v.current_km.toString(),
    });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="text-center py-8">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Vehículos</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(o) => (o ? setIsDialogOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Vehículo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name) {
                  toast({ title: "Nombre requerido", variant: "destructive" });
                  return;
                }
                mutation.mutate(form);
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <Label>Tipo *</Label>
                <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Motocicleta</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="car">Carro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ej. Pickup Finca 1" />
              </div>
              <div>
                <Label>Marca</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div>
                <Label>VIN #</Label>
                <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
              </div>
              <div>
                <Label>Placa</Label>
                <Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} />
              </div>
              <div>
                <Label>Intervalo Mant. (km)</Label>
                <Input type="number" value={form.maintenance_interval_km} onChange={(e) => setForm({ ...form, maintenance_interval_km: e.target.value })} />
              </div>
              <div>
                <Label>Vencimiento seguro</Label>
                <Input type="date" value={form.insurance_expiration} onChange={(e) => setForm({ ...form, insurance_expiration: e.target.value })} />
              </div>
              <div>
                <Label>Fecha compra</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div>
                <Label>Costo compra</Label>
                <Input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Km al registro {editing && <span className="text-xs text-muted-foreground">(solo lectura)</span>}</Label>
                <Input type="number" value={form.current_km} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, current_km: e.target.value })} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" disabled={mutation.isPending}>{editing ? "Actualizar" : "Agregar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            ¡{overdue.length} vehículo{overdue.length > 1 ? "s" : ""} con mantenimiento vencido!{" "}
            <span className="font-normal">{overdue.map(v => v.name).join(", ")}</span>
          </p>
        </div>
      )}

      {!vehicles || vehicles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Sin vehículos registrados</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead>Km a mantenimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => {
              const s = getStatus(v);
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.brand || "—"}</TableCell>
                  <TableCell>{typeLabel(v.vehicle_type)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(v.current_km).toLocaleString()}</TableCell>
                  <TableCell>
                    {s.isOverdue ? (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Vencido {Math.abs(Math.round(s.remaining)).toLocaleString()} km</Badge>
                    ) : s.isDueSoon ? (
                      <Badge className="bg-amber-500 hover:bg-amber-600 gap-1"><Clock className="h-3 w-3" />{Math.round(s.remaining).toLocaleString()} km</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />{Math.round(s.remaining).toLocaleString()} km</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.is_active ? "default" : "secondary"}>
                      {v.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setViewing(v)} title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setMaintenanceFor(v)} title="Mantenimiento">
                      <Wrench className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Detail panel */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Tipo" value={typeLabel(viewing.vehicle_type)} />
              <Detail label="Marca" value={viewing.brand} />
              <Detail label="Modelo" value={viewing.model} />
              <Detail label="VIN" value={viewing.vin} />
              <Detail label="Placa" value={viewing.license_plate} />
              <Detail label="Km actual" value={Number(viewing.current_km).toLocaleString()} />
              <Detail label="Intervalo mantenimiento" value={`${viewing.maintenance_interval_km.toLocaleString()} km`} />
              <Detail
                label="Vencimiento seguro"
                value={viewing.insurance_expiration ? fmtDate(parseDateLocal(viewing.insurance_expiration)) : null}
              />
              <Detail
                label="Fecha compra"
                value={viewing.purchase_date ? fmtDate(parseDateLocal(viewing.purchase_date)) : null}
              />
              <Detail
                label="Costo compra"
                value={viewing.purchase_cost ? Number(viewing.purchase_cost).toLocaleString() : null}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {maintenanceFor && (
        <VehicleMaintenanceDialog
          vehicleId={maintenanceFor.id}
          vehicleName={maintenanceFor.name}
          currentKm={Number(maintenanceFor.current_km)}
          maintenanceInterval={maintenanceFor.maintenance_interval_km}
          open={!!maintenanceFor}
          onOpenChange={(o) => !o && setMaintenanceFor(null)}
        />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}
