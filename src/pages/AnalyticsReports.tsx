import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { MapPin, Fuel, Users } from "lucide-react";
import { CostPerFieldTab } from "@/components/analytics/CostPerFieldTab";
import { FuelConsumptionTab } from "@/components/analytics/FuelConsumptionTab";
import { PayrollSummaryTab } from "@/components/analytics/PayrollSummaryTab";
import { useEntity } from "@/contexts/EntityContext";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";

export default function AnalyticsReports() {
  const [activeTab, setActiveTab] = useState("cost-field");
  const { selectedEntityId, isAllEntities, isGlobalAdmin } = useEntity();

  return (
    <TabbedPageLayout
      title="Analítica Operacional"
      subtitle="Reportes operacionales. Para estados financieros (P&L, Balance General, Balanza de Comprobación, Aging, Flujo de Caja), ver Contabilidad → Reportes."
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerExtra={
        isGlobalAdmin ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Entidad:</span>
            <EntitySwitcher />
          </div>
        ) : null
      }
      tabGroups={[
        {
          tabs: [
            { value: "cost-field", label: "Costo por Campo", icon: <MapPin className="h-4 w-4" />, content: <CostPerFieldTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "payroll", label: "Resumen Nómina", icon: <Users className="h-4 w-4" />, content: <PayrollSummaryTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "fuel", label: "Consumo Combustible", icon: <Fuel className="h-4 w-4" />, content: <FuelConsumptionTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
          ],
        },
      ]}
    />
  );
}
