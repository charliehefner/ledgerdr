import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { BarChart3, Scale, TrendingUp, Building2, MapPin, Fuel } from "lucide-react";
import { AgingReportTab } from "@/components/analytics/AgingReportTab";
import { TrialBalanceTab } from "@/components/analytics/TrialBalanceTab";
import { ProfitLossTab } from "@/components/analytics/ProfitLossTab";
import { BalanceSheetTab } from "@/components/analytics/BalanceSheetTab";
import { CostPerFieldTab } from "@/components/analytics/CostPerFieldTab";
import { FuelConsumptionTab } from "@/components/analytics/FuelConsumptionTab";

export default function AnalyticsReports() {
  const [activeTab, setActiveTab] = useState("aging");

  return (
    <TabbedPageLayout
      title="Reportes Analíticos"
      subtitle="Financial statements and operational analytics"
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabGroups={[
        {
          tabs: [
            { value: "aging", label: "AP/AR Aging", icon: <BarChart3 className="h-4 w-4" />, content: <AgingReportTab /> },
            { value: "trial-balance", label: "Trial Balance", icon: <Scale className="h-4 w-4" />, content: <TrialBalanceTab /> },
            { value: "pnl", label: "P&L", icon: <TrendingUp className="h-4 w-4" />, content: <ProfitLossTab /> },
            { value: "balance-sheet", label: "Balance Sheet", icon: <Building2 className="h-4 w-4" />, content: <BalanceSheetTab /> },
            { value: "cost-field", label: "Cost per Field", icon: <MapPin className="h-4 w-4" />, content: <CostPerFieldTab /> },
            { value: "fuel", label: "Fuel Consumption", icon: <Fuel className="h-4 w-4" />, content: <FuelConsumptionTab /> },
          ],
        },
      ]}
    />
  );
}
