import { useState, useMemo } from "react";
import { parseDateLocal } from "@/lib/dateUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Tractor, Wrench, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ColumnSelector } from "@/components/ui/column-selector";
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";
import { useLanguage } from "@/contexts/LanguageContext";
import { TractorMaintenanceDialog } from "./TractorMaintenanceDialog";

interface TractorEquipment {
  id: string;
  name: string;
  equipment_type: string;
  current_hour_meter: number;
  is_active: boolean;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  hp: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
  maintenance_interval_hours: number;
}

interface MaintenanceRecord {
  tractor_id: string;
  hour_meter_reading: number;
}

export function TractorsView() {
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTractor, setEditingTractor] = useState<TractorEquipment | null>(null);
  const [selectedTractorForMaintenance, setSelectedTractorForMaintenance] = useState<TractorEquipment | null>(null);
  const [form, setForm] = useState({
    name: "",
    current_hour_meter: "0",
    serial_number: "",
    brand: "",
    model: "",
    hp: "",
    purchase_date: "",
    purchase_price: "",
    maintenance_interval_hours: "500",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tractorColumns: ColumnConfig[] = useMemo(() => [
    { key: "name", label: t("equipment.col.name"), defaultVisible: true },
    { key: "brand_model", label: t("equipment.col.brandModel"), defaultVisible: true },
    { key: "serial", label: t("equipment.col.serial"), defaultVisible: false },
    { key: "hp", label: t("equipment.col.hp"), defaultVisible: true },
    { key: "hour_meter", label: t("equipment.col.hourMeter"), defaultVisible: true },
    { key: "maintenance", label: "Mantenimiento", defaultVisible: true },
    { key: "purchase_date", label: t("equipment.col.purchaseDate"), defaultVisible: false },
    { key: "price", label: t("equipment.col.price"), defaultVisible: false },
    { key: "status", label: t("equipment.col.status"), defaultVisible: true },
    { key: "actions", label: t("equipment.col.actions"), defaultVisible: true },
  ], [t]);

  const {
    visibility,
    toggleColumn,
    resetToDefaults,
    isVisible,
    allColumns,
  } = useColumnVisibility("tractors", tractorColumns);

  const { data: tractors, isLoading } = useQuery({
    queryKey: ["tractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("*")
        .eq("equipment_type", "tractor")
        .order("name");
      if (error) throw error;
      return data as TractorEquipment[];
    },
  });

  // Fetch latest maintenance for each tractor
  const { data: latestMaintenance = [] } = useQuery({
    queryKey: ["tractors-latest-maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tractor_maintenance")
        .select("tractor_id, hour_meter_reading")
        .order("hour_meter_reading", { ascending: false });
      if (error) throw error;
      
      // Get only the latest maintenance per tractor
      const latestByTractor = new Map<string, number>();
      (data as MaintenanceRecord[]).forEach((m) => {
        if (!latestByTractor.has(m.tractor_id)) {
          latestByTractor.set(m.tractor_id, m.hour_meter_reading);
        }
      });
      
      return Array.from(latestByTractor.entries()).map(([tractor_id, hour_meter_reading]) => ({
        tractor_id,
        hour_meter_reading,
      }));
    },
  });

  // Helper to get maintenance status for a tractor
  const getMaintenanceStatus = (tractor: TractorEquipment) => {
    const lastMaint = latestMaintenance.find(m => m.tractor_id === tractor.id);
    const lastHours = lastMaint?.hour_meter_reading ?? 0;
    const hoursSinceMaint = tractor.current_hour_meter - lastHours;
    const hoursUntil = tractor.maintenance_interval_hours - hoursSinceMaint;
    
    return {
      hoursUntil,
      isOverdue: hoursUntil < 0,
      isDueSoon: hoursUntil >= 0 && hoursUntil <= 50,
    };
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record = {
        name: data.name,
        equipment_type: "tractor",
        current_hour_meter: parseFloat(data.current_hour_meter) || 0,
        serial_number: data.serial_number || null,
        brand: data.brand || null,
        model: data.model || null,
        hp: data.hp ? parseFloat(data.hp) : null,
        purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : null,
        maintenance_interval_hours: parseInt(data.maintenance_interval_hours) || 500,
      };

      if (editingTractor) {
        const { error } = await supabase
          .from("fuel_equipment")
          .update(record)
          .eq("id", editingTractor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fuel_equipment").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["fuelEquipment"] });
      toast({
        title: editingTractor ? t("equipment.tractorUpdated") : t("equipment.tractorAdded"),
        description: `${form.name} ${t("equipment.successMessage").replace("{action}", editingTractor ? t("equipment.update").toLowerCase() : t("common.add").toLowerCase())}`,
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

  const handleEdit = (tractor: TractorEquipment) => {
    setEditingTractor(tractor);
    setForm({
      name: tractor.name,
      current_hour_meter: tractor.current_hour_meter.toString(),
      serial_number: tractor.serial_number || "",
      brand: tractor.brand || "",
      model: tractor.model || "",
      hp: tractor.hp?.toString() || "",
      purchase_date: tractor.purchase_date || "",
      purchase_price: tractor.purchase_price?.toString() || "",
      maintenance_interval_hours: tractor.maintenance_interval_hours?.toString() || "500",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTractor(null);
    setForm({
      name: "",
      current_hour_meter: "0",
      serial_number: "",
      brand: "",
      model: "",
      hp: "",
      purchase_date: "",
      purchase_price: "",
      maintenance_interval_hours: "500",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({
        title: t("equipment.validationError"),
        description: t("equipment.enterTractorName"),
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-center py-8">{t("equipment.loadingTractors")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Tractor className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("equipment.tractors")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSelector
            columns={allColumns}
            visibility={visibility}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("equipment.addTractor")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingTractor ? t("equipment.editTractor") : t("equipment.addNewTractor")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>{t("equipment.tractorName")} *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="ej. John Deere 6215R"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.brand")}</Label>
                    <Input
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      placeholder="ej. John Deere"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.model")}</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="ej. 6215R"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.serialNumber")}</Label>
                    <Input
                      value={form.serial_number}
                      onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                      placeholder="ej. 1RW6215RJKD012345"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.hp")}</Label>
                    <Input
                      type="number"
                      value={form.hp}
                      onChange={(e) => setForm({ ...form, hp: e.target.value })}
                      placeholder="ej. 215"
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.hourMeter")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.current_hour_meter}
                      onChange={(e) =>
                        setForm({ ...form, current_hour_meter: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.purchaseDate")}</Label>
                    <Input
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>{t("equipment.form.purchasePrice")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.purchase_price}
                      onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                      placeholder="ej. 150000"
                    />
                  </div>

                  <div>
                    <Label>Intervalo Mant. (hrs)</Label>
                    <Input
                      type="number"
                      value={form.maintenance_interval_hours}
                      onChange={(e) => setForm({ ...form, maintenance_interval_hours: e.target.value })}
                      placeholder="500"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {form.brand?.toLowerCase().includes("volvo") ? "Volvo: recomendado 250 hrs" : "Estándar: 500 hrs"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? t("equipment.saving") : editingTractor ? t("equipment.update") : t("equipment.addTractor")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!tractors || tractors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("equipment.noTractors")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isVisible("name") && <TableHead>{t("equipment.col.name")}</TableHead>}
                {isVisible("brand_model") && <TableHead>{t("equipment.col.brandModel")}</TableHead>}
                {isVisible("serial") && <TableHead>{t("equipment.col.serial")}</TableHead>}
                {isVisible("hp") && <TableHead>{t("equipment.col.hp")}</TableHead>}
                {isVisible("hour_meter") && <TableHead>{t("equipment.col.hourMeter")}</TableHead>}
                {isVisible("maintenance") && <TableHead>Mantenimiento</TableHead>}
                {isVisible("purchase_date") && <TableHead>{t("equipment.col.purchaseDate")}</TableHead>}
                {isVisible("price") && <TableHead>{t("equipment.col.price")}</TableHead>}
                {isVisible("status") && <TableHead>{t("equipment.col.status")}</TableHead>}
                {isVisible("actions") && <TableHead className="w-[100px]">{t("equipment.col.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tractors.map((tractor) => {
                const maintStatus = getMaintenanceStatus(tractor);
                return (
                  <TableRow key={tractor.id}>
                    {isVisible("name") && <TableCell className="font-medium">{tractor.name}</TableCell>}
                    {isVisible("brand_model") && (
                      <TableCell>
                        {tractor.brand || tractor.model
                          ? `${tractor.brand || ""} ${tractor.model || ""}`.trim()
                          : "-"}
                      </TableCell>
                    )}
                    {isVisible("serial") && <TableCell>{tractor.serial_number || "-"}</TableCell>}
                    {isVisible("hp") && <TableCell>{tractor.hp ? `${tractor.hp} HP` : "-"}</TableCell>}
                    {isVisible("hour_meter") && <TableCell>{tractor.current_hour_meter} hrs</TableCell>}
                    {isVisible("maintenance") && (
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-pointer" onClick={() => setSelectedTractorForMaintenance(tractor)}>
                                {maintStatus.isOverdue ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {Math.abs(Math.round(maintStatus.hoursUntil))} hrs vencido
                                  </Badge>
                                ) : maintStatus.isDueSoon ? (
                                  <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                                    <Clock className="h-3 w-3" />
                                    {Math.round(maintStatus.hoursUntil)} hrs
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
                                    <CheckCircle className="h-3 w-3" />
                                    {Math.round(maintStatus.hoursUntil)} hrs
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{maintStatus.isOverdue ? "Mantenimiento vencido" : `Próximo mant. en ${Math.round(maintStatus.hoursUntil)} hrs`}</p>
                              <p className="text-xs text-muted-foreground">Intervalo: cada {tractor.maintenance_interval_hours} hrs</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    )}
                    {isVisible("purchase_date") && (
                      <TableCell>
                        {tractor.purchase_date
                          ? format(parseDateLocal(tractor.purchase_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                    )}
                    {isVisible("price") && (
                      <TableCell>
                        {tractor.purchase_price
                          ? `$${tractor.purchase_price.toLocaleString()}`
                          : "-"}
                      </TableCell>
                    )}
                    {isVisible("status") && (
                      <TableCell>
                        <Badge variant={tractor.is_active ? "default" : "secondary"}>
                          {tractor.is_active ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                    )}
                    {isVisible("actions") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedTractorForMaintenance(tractor)}
                            title="Ver Mantenimiento"
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tractor)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Maintenance Dialog */}
      <TractorMaintenanceDialog
        tractorId={selectedTractorForMaintenance?.id ?? null}
        tractorName={selectedTractorForMaintenance?.name ?? ""}
        currentHourMeter={selectedTractorForMaintenance?.current_hour_meter ?? 0}
        maintenanceInterval={selectedTractorForMaintenance?.maintenance_interval_hours ?? 500}
        open={!!selectedTractorForMaintenance}
        onOpenChange={(open) => !open && setSelectedTractorForMaintenance(null)}
      />
    </div>
  );
}
