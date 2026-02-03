import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, Trash2, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface TractorMaintenanceDialogProps {
  tractorId: string | null;
  tractorName: string;
  currentHourMeter: number;
  maintenanceInterval: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MaintenanceRecord {
  id: string;
  tractor_id: string;
  maintenance_date: string;
  hour_meter_reading: number;
  maintenance_type: string;
  notes: string | null;
  created_at: string;
}

export function TractorMaintenanceDialog({
  tractorId,
  tractorName,
  currentHourMeter,
  maintenanceInterval,
  open,
  onOpenChange,
}: TractorMaintenanceDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("status");
  
  // Form state for adding maintenance
  const [maintenanceDate, setMaintenanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hourMeterReading, setHourMeterReading] = useState(currentHourMeter.toString());
  const [maintenanceType, setMaintenanceType] = useState("routine");
  const [notes, setNotes] = useState("");

  // Fetch maintenance history
  const { data: maintenanceHistory = [], isLoading } = useQuery({
    queryKey: ["tractor-maintenance", tractorId],
    queryFn: async () => {
      if (!tractorId) return [];
      const { data, error } = await supabase
        .from("tractor_maintenance")
        .select("*")
        .eq("tractor_id", tractorId)
        .order("hour_meter_reading", { ascending: false });
      if (error) throw error;
      return data as MaintenanceRecord[];
    },
    enabled: !!tractorId && open,
  });

  // Calculate maintenance status
  const lastMaintenance = maintenanceHistory[0];
  const lastMaintenanceHours = lastMaintenance?.hour_meter_reading ?? 0;
  const hoursSinceLastMaintenance = currentHourMeter - lastMaintenanceHours;
  const hoursUntilNextMaintenance = maintenanceInterval - hoursSinceLastMaintenance;
  const isOverdue = hoursUntilNextMaintenance < 0;
  const isDueSoon = hoursUntilNextMaintenance >= 0 && hoursUntilNextMaintenance <= 50;

  // Add maintenance mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tractor_maintenance").insert({
        tractor_id: tractorId,
        maintenance_date: maintenanceDate,
        hour_meter_reading: parseFloat(hourMeterReading),
        maintenance_type: maintenanceType,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractor-maintenance", tractorId] });
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["tractors-latest-maintenance"] });
      toast.success("Mantenimiento registrado");
      // Reset form
      setMaintenanceDate(format(new Date(), "yyyy-MM-dd"));
      setHourMeterReading(currentHourMeter.toString());
      setMaintenanceType("routine");
      setNotes("");
      setActiveTab("history");
    },
    onError: (error) => {
      console.error("Error adding maintenance:", error);
      toast.error("Error al registrar mantenimiento");
    },
  });

  // Delete maintenance mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tractor_maintenance")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractor-maintenance", tractorId] });
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["tractors-latest-maintenance"] });
      toast.success("Registro eliminado");
    },
    onError: (error) => {
      console.error("Error deleting maintenance:", error);
      toast.error("Error al eliminar registro");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hourMeterReading || parseFloat(hourMeterReading) < 0) {
      toast.error("Por favor ingrese una lectura de horómetro válida");
      return;
    }
    addMutation.mutate();
  };

  const getStatusBadge = () => {
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="text-sm">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Vencido por {Math.abs(Math.round(hoursUntilNextMaintenance))} hrs
        </Badge>
      );
    }
    if (isDueSoon) {
      return (
        <Badge variant="secondary" className="bg-warning/20 text-warning-foreground text-sm">
          <Clock className="h-3 w-3 mr-1" />
          Próximo en {Math.round(hoursUntilNextMaintenance)} hrs
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-success/20 text-success-foreground text-sm">
        <CheckCircle className="h-3 w-3 mr-1" />
        OK - {Math.round(hoursUntilNextMaintenance)} hrs restantes
      </Badge>
    );
  };

  if (!tractorId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Mantenimiento - {tractorName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Estado</TabsTrigger>
            <TabsTrigger value="add">Registrar</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Estado de Mantenimiento</span>
                  {getStatusBadge()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horómetro Actual</span>
                  <span className="font-medium">{currentHourMeter.toLocaleString()} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intervalo de Mantenimiento</span>
                  <span className="font-medium">Cada {maintenanceInterval} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último Mantenimiento</span>
                  <span className="font-medium">
                    {lastMaintenance 
                      ? `${lastMaintenanceHours.toLocaleString()} hrs (${format(parseDateLocal(lastMaintenance.maintenance_date), "d MMM yyyy", { locale: es })})`
                      : "Sin registro"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horas desde último mant.</span>
                  <span className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                    {Math.round(hoursSinceLastMaintenance).toLocaleString()} hrs
                  </span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-muted-foreground font-medium">Próximo Mantenimiento</span>
                  <span className={`font-bold ${isOverdue ? "text-destructive" : isDueSoon ? "text-yellow-600" : "text-green-600"}`}>
                    {isOverdue 
                      ? `Vencido hace ${Math.abs(Math.round(hoursUntilNextMaintenance))} hrs`
                      : `En ${Math.round(hoursUntilNextMaintenance)} hrs`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {maintenanceHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Últimos 3 Mantenimientos</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-2">
                    {maintenanceHistory.slice(0, 3).map((m) => (
                      <div key={m.id} className="flex justify-between items-center py-1 border-b last:border-0">
                        <div>
                          <span className="font-medium">{m.hour_meter_reading.toLocaleString()} hrs</span>
                          <span className="text-muted-foreground ml-2">
                            {format(parseDateLocal(m.maintenance_date), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        <Badge variant="outline" className="capitalize">{m.maintenance_type}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Add Maintenance Tab */}
          <TabsContent value="add" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha de Mantenimiento *</Label>
                  <Input
                    type="date"
                    value={maintenanceDate}
                    onChange={(e) => setMaintenanceDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Horómetro al momento del mant. *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={hourMeterReading}
                    onChange={(e) => setHourMeterReading(e.target.value)}
                    placeholder={currentHourMeter.toString()}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Tipo de Mantenimiento</Label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value)}
                >
                  <option value="routine">Rutinario</option>
                  <option value="oil_change">Cambio de Aceite</option>
                  <option value="filter_change">Cambio de Filtros</option>
                  <option value="major_service">Servicio Mayor</option>
                  <option value="repair">Reparación</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles del mantenimiento realizado..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveTab("status")}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  {addMutation.isPending ? "Guardando..." : "Registrar Mantenimiento"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Cargando historial...</div>
            ) : maintenanceHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No hay registros de mantenimiento</p>
                <Button className="mt-4" onClick={() => setActiveTab("add")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Primer Mantenimiento
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Horómetro</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceHistory.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        {format(parseDateLocal(m.maintenance_date), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {m.hour_meter_reading.toLocaleString()} hrs
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {m.maintenance_type === "routine" ? "Rutinario" :
                           m.maintenance_type === "oil_change" ? "Cambio Aceite" :
                           m.maintenance_type === "filter_change" ? "Cambio Filtros" :
                           m.maintenance_type === "major_service" ? "Servicio Mayor" :
                           m.maintenance_type === "repair" ? "Reparación" :
                           m.maintenance_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {m.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(m.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
