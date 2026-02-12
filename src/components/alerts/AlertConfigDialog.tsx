import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAlertConfigurations } from "./useAlertData";

const ALERT_LABELS: Record<string, { name: string; unit: string | null }> = {
  vacation_upcoming: { name: "Vacaciones próximas", unit: "días" },
  fuel_tank_low: { name: "Tanque de combustible bajo", unit: "%" },
  maintenance_due: { name: "Mantenimiento preventivo", unit: "horas" },
  inventory_low: { name: "Inventario bajo", unit: null },
  overdue_followups: { name: "Seguimientos vencidos", unit: null },
};

interface AlertConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertConfigDialog({ open, onOpenChange }: AlertConfigDialogProps) {
  const { data: configs, isLoading } = useAlertConfigurations();
  const [localConfigs, setLocalConfigs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (configs) setLocalConfigs(configs.map((c) => ({ ...c })));
  }, [configs]);

  const handleToggle = (alertType: string, checked: boolean) => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.alert_type === alertType ? { ...c, is_active: checked } : c))
    );
  };

  const handleThreshold = (alertType: string, value: string) => {
    const numVal = value === "" ? null : Number(value);
    setLocalConfigs((prev) =>
      prev.map((c) => (c.alert_type === alertType ? { ...c, threshold_value: numVal } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const config of localConfigs) {
        await supabase
          .from("alert_configurations")
          .update({ is_active: config.is_active, threshold_value: config.threshold_value })
          .eq("alert_type", config.alert_type);
      }
      queryClient.invalidateQueries({ queryKey: ["alert-configurations"] });
      toast({ title: "Configuración guardada" });
      onOpenChange(false);
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Alertas</DialogTitle>
          <DialogDescription>Active o desactive alertas y ajuste umbrales.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-4">
            {localConfigs.map((config) => {
              const label = ALERT_LABELS[config.alert_type];
              if (!label) return null;
              return (
                <div key={config.alert_type} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(checked) => handleToggle(config.alert_type, checked)}
                    />
                    <span className="text-sm font-medium truncate">{label.name}</span>
                  </div>
                  {label.unit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        value={config.threshold_value ?? ""}
                        onChange={(e) => handleThreshold(config.alert_type, e.target.value)}
                        disabled={!config.is_active}
                      />
                      <span className="text-xs text-muted-foreground">{label.unit}</span>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
