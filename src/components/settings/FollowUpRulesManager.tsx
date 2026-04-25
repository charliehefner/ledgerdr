import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface FollowUpRule {
  id: string;
  trigger_operation_type_id: string;
  followup_text: string;
  days_offset: number;
  alert_days_prior: number;
  default_driver_id: string | null;
  is_active: boolean;
  created_at: string;
}

export function FollowUpRulesManager() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowUpRule | null>(null);
  const [form, setForm] = useState({
    trigger_operation_type_id: "",
    followup_text: "",
    days_offset: "3",
    alert_days_prior: "1",
    default_driver_id: "",
  });

  // Fetch operation types
  const { data: operationTypes = [] } = useQuery({
    queryKey: ["operationTypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch tractorista employees for driver dropdown
  const { data: drivers = [] } = useQuery({
    queryKey: ["tractorista-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, position")
        .eq("is_active", true)
        .eq("position", "Tractorista")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing rules
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["operation-followups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_followups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FollowUpRule[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const record = {
        trigger_operation_type_id: form.trigger_operation_type_id,
        followup_text: form.followup_text,
        days_offset: parseInt(form.days_offset) || 3,
        alert_days_prior: parseInt(form.alert_days_prior) || 1,
        default_driver_id: form.default_driver_id || null,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("operation_followups")
          .update(record)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("operation_followups")
          .insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-followups"] });
      toast.success(editingRule ? "Regla actualizada" : "Regla creada");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("operation_followups")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-followups"] });
      toast.success("Regla eliminada");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("operation_followups")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-followups"] });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setForm({
      trigger_operation_type_id: "",
      followup_text: "",
      days_offset: "3",
      alert_days_prior: "1",
      default_driver_id: "",
    });
  };

  const handleEdit = (rule: FollowUpRule) => {
    setEditingRule(rule);
    setForm({
      trigger_operation_type_id: rule.trigger_operation_type_id,
      followup_text: rule.followup_text,
      days_offset: String(rule.days_offset),
      alert_days_prior: String(rule.alert_days_prior ?? 1),
      default_driver_id: rule.default_driver_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.trigger_operation_type_id || !form.followup_text) {
      toast.error("Complete los campos requeridos");
      return;
    }
    saveMutation.mutate();
  };

  const getOperationName = (id: string) =>
    operationTypes.find((t) => t.id === id)?.name || "—";

  const getDriverName = (id: string | null) =>
    id ? drivers.find((d) => d.id === id)?.name || "—" : "Sin asignar";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Seguimientos Automáticos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Reglas para programar operaciones de seguimiento en Operaciones
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Regla
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? "Editar Regla" : "Nueva Regla de Seguimiento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Operación Disparadora *</Label>
                <Select
                  value={form.trigger_operation_type_id}
                  onValueChange={(v) => setForm({ ...form, trigger_operation_type_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar operación" /></SelectTrigger>
                  <SelectContent>
                    {operationTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Texto del Seguimiento *</Label>
                <Input
                  value={form.followup_text}
                  onChange={(e) => setForm({ ...form, followup_text: e.target.value })}
                  placeholder="Ej: Herbicida - {field}"
                />
                <p className="text-xs text-muted-foreground">
                  Use <code>{"{field}"}</code> para insertar el nombre del campo automáticamente
                </p>
              </div>

              <div className="space-y-2">
                <Label>Días después de la operación</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.days_offset}
                  onChange={(e) => setForm({ ...form, days_offset: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Días de alerta previa</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.alert_days_prior}
                  onChange={(e) => setForm({ ...form, alert_days_prior: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Cuántos días antes de la fecha programada debe mostrarse la alerta
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tractorista por defecto</Label>
                <Select
                  value={form.default_driver_id}
                  onValueChange={(v) => setForm({ ...form, default_driver_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar tractorista" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleCloseDialog}>{t("common.cancel")}</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? t("common.saving") : editingRule ? t("common.update") : t("common.create")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay reglas configuradas. Agregue una para automatizar seguimientos.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operación</TableHead>
                <TableHead>Seguimiento</TableHead>
                <TableHead className="text-center">Días</TableHead>
                <TableHead className="text-center">Alerta (días antes)</TableHead>
                <TableHead>Tractorista</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{getOperationName(rule.trigger_operation_type_id)}</TableCell>
                  <TableCell>{rule.followup_text}</TableCell>
                  <TableCell className="text-center">{rule.days_offset}</TableCell>
                  <TableCell className="text-center">{rule.alert_days_prior ?? 1}</TableCell>
                  <TableCell>{getDriverName(rule.default_driver_id)}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rule.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
