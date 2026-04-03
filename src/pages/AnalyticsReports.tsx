import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { BarChart3, Scale, TrendingUp, Building2, MapPin, Fuel, Users } from "lucide-react";
import { AgingReportTab } from "@/components/analytics/AgingReportTab";
import { TrialBalanceTab } from "@/components/analytics/TrialBalanceTab";
import { ProfitLossTab } from "@/components/analytics/ProfitLossTab";
import { BalanceSheetTab } from "@/components/analytics/BalanceSheetTab";
import { CostPerFieldTab } from "@/components/analytics/CostPerFieldTab";
import { FuelConsumptionTab } from "@/components/analytics/FuelConsumptionTab";
import { PayrollSummaryTab } from "@/components/analytics/PayrollSummaryTab";
import { useEntity } from "@/contexts/EntityContext";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";

export default function AnalyticsReports() {
  const [activeTab, setActiveTab] = useState("pnl");
  const { selectedEntityId, isAllEntities, isGlobalAdmin } = useEntity();

  return (
    <TabbedPageLayout
      title="Reportes Analíticos"
      subtitle="Estados financieros y analítica operacional"
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
            { value: "pnl", label: "Estado de Resultados", icon: <TrendingUp className="h-4 w-4" />, content: <ProfitLossTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "balance-sheet", label: "Balance General", icon: <Building2 className="h-4 w-4" />, content: <BalanceSheetTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "cost-field", label: "Costo por Campo", icon: <MapPin className="h-4 w-4" />, content: <CostPerFieldTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "aging", label: "Aging CxP/CxC", icon: <BarChart3 className="h-4 w-4" />, content: <AgingReportTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "trial-balance", label: "Balanza Comprobación", icon: <Scale className="h-4 w-4" />, content: <TrialBalanceTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "payroll", label: "Resumen Nómina", icon: <Users className="h-4 w-4" />, content: <PayrollSummaryTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
            { value: "fuel", label: "Consumo Combustible", icon: <Fuel className="h-4 w-4" />, content: <FuelConsumptionTab entityId={selectedEntityId} isAllEntities={isAllEntities} /> },
          ],
        },
      ]}
    />
  );
}
