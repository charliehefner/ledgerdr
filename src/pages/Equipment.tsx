import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { TractorsView } from "@/components/fuel/TractorsView";
import { ImplementsView } from "@/components/fuel/ImplementsView";
import { HourMeterSequenceView } from "@/components/equipment/HourMeterSequenceView";
import { VehiclesView } from "@/components/equipment/VehiclesView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Equipment() {
  const [activeTab, setActiveTab] = useState("tractors");
  const { t } = useLanguage();

  return (
    <TabbedPageLayout
      title={t("page.equipment.title")}
      subtitle={t("page.equipment.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      helpChapter="10-equipment"
      tabGroups={[
        {
          tabs: [
            {
              value: "tractors",
              label: t("equipment.tractors"),
              content: <TractorsView />,
            },
            {
              value: "implements",
              label: t("equipment.implements"),
              content: <ImplementsView />,
            },
            {
              value: "horometer",
              label: t("equipment.hourMeter"),
              content: <HourMeterSequenceView />,
            },
          ],
        },
      ]}
    />
  );
}
