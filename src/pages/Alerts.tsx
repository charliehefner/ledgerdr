import { useState } from "react";
import { Bell, SettingsIcon } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { HelpPanelButton } from "@/components/layout/HelpPanelButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertSector } from "@/components/alerts/AlertSector";
import { AlertCard } from "@/components/alerts/AlertCard";
import { AlertConfigDialog } from "@/components/alerts/AlertConfigDialog";
import {
  useAlertConfigurations,
  useHrAlerts,
  useFuelAlerts,
  useEquipmentAlerts,
  useInventoryAlerts,
  useOperationsAlerts,
  useOperationsGpsAlerts,
  useApArOverdueAlerts,
  usePayrollApproachingAlerts,
} from "@/components/alerts/useAlertData";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";

export default function Alerts() {
  const [configOpen, setConfigOpen] = useState(false);
  const { user } = useAuth();
  const { selectedEntityId } = useEntity();
  const { data: configs, isLoading: configsLoading } = useAlertConfigurations();

  const hr = useHrAlerts(configs);
  const fuel = useFuelAlerts(configs);
  const equipment = useEquipmentAlerts(configs);
  const inventory = useInventoryAlerts(configs);
  const operations = useOperationsAlerts(configs);
  const gpsOps = useOperationsGpsAlerts(configs);
  const apAr = useApArOverdueAlerts(configs, selectedEntityId);
  const payroll = usePayrollApproachingAlerts(configs);

  const isLoading = configsLoading || hr.isLoading || fuel.isLoading || equipment.isLoading || inventory.isLoading || operations.isLoading || gpsOps.isLoading || apAr.isLoading || payroll.isLoading;

  const allOpsAlerts = [...operations.alerts, ...gpsOps.alerts];
  const totalAlerts = hr.alerts.length + fuel.alerts.length + equipment.alerts.length + inventory.alerts.length + allOpsAlerts.length + apAr.alerts.length + payroll.alerts.length;

  const isAdmin = user?.role === "admin";

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Alertas Internas</h1>
                <HelpPanelButton chapter="10-administration" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Cargando..." : `${totalAlerts} alerta${totalAlerts !== 1 ? "s" : ""} activa${totalAlerts !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <SettingsIcon className="h-4 w-4 mr-1.5" />
              Configurar
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <AlertSector title="Recursos Humanos" alertCount={hr.alerts.length}>
              {hr.alerts.map((a, i) => (
                <AlertCard key={i} severity={a.severity} title={a.title} detail={a.detail} />
              ))}
            </AlertSector>

            <AlertSector title="Equipos" alertCount={equipment.alerts.length}>
              {equipment.alerts.map((a, i) => (
                <AlertCard key={i} severity={a.severity} title={a.title} detail={a.detail} />
              ))}
            </AlertSector>

            <AlertSector title="Combustible" alertCount={fuel.alerts.length}>
              {fuel.alerts.map((a, i) => (
                <AlertCard key={i} severity={a.severity} title={a.title} detail={a.detail} />
              ))}
            </AlertSector>

            <AlertSector title="Inventario" alertCount={inventory.alerts.length}>
              {inventory.alerts.map((a, i) => (
                <AlertCard key={i} severity={a.severity} title={a.title} detail={a.detail} />
              ))}
            </AlertSector>

            <AlertSector title="Operaciones" alertCount={allOpsAlerts.length}>
              {allOpsAlerts.map((a, i) => (
                <AlertCard key={i} severity={a.severity} title={a.title} detail={a.detail} />
              ))}
            </AlertSector>
          </div>
        )}
      </div>

      <AlertConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </MainLayout>
  );
}
