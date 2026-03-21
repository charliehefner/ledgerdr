import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { FuelTanksView } from "@/components/fuel/FuelTanksView";
import { AgricultureFuelView } from "@/components/fuel/AgricultureFuelView";
import { IndustryFuelView } from "@/components/fuel/IndustryFuelView";
import { PendingSubmissionsView } from "@/components/fuel/PendingSubmissionsView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Fuel() {
  const [activeTab, setActiveTab] = useState("agriculture");
  const { t } = useLanguage();

  return (
    <TabbedPageLayout
      title={t("page.fuel.title")}
      subtitle={t("page.fuel.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabGroups={[
        {
          tabs: [
            {
              value: "agriculture",
              label: t("fuel.agriculture"),
              content: <AgricultureFuelView />,
            },
            {
              value: "industry",
              label: t("fuel.industry"),
              content: <IndustryFuelView />,
            },
            {
              value: "tanks",
              label: t("fuel.tanks"),
              content: <FuelTanksView />,
            },
            {
              value: "pending",
              label: "Envíos Pendientes",
              content: <PendingSubmissionsView />,
            },
          ],
        },
      ]}
    />
  );
}
