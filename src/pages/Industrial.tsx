import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { Factory, Gauge, Truck } from "lucide-react";
import { PlantHoursView } from "@/components/industrial/PlantHoursView";
import { CarretasView } from "@/components/industrial/CarretasView";
import { TrucksView } from "@/components/industrial/TrucksView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Industrial() {
  const [activeTab, setActiveTab] = useState("plant-hours");
  const { t } = useLanguage();

  return (
    <TabbedPageLayout
      title={t("industrial.title")}
      subtitle={t("industrial.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerIcon={<Factory className="h-5 w-5 text-primary" />}
      headerAccent
      tabGroups={[
        {
          tabs: [
            {
              value: "plant-hours",
              label: t("industrial.plantHours"),
              icon: <Gauge className="h-4 w-4" />,
              content: <PlantHoursView />,
            },
            {
              value: "carretas",
              label: t("industrial.carretas"),
              icon: <Factory className="h-4 w-4" />,
              content: <CarretasView />,
            },
            {
              value: "trucks",
              label: t("industrial.trucks"),
              icon: <Truck className="h-4 w-4" />,
              content: <TrucksView />,
            },
          ],
        },
      ]}
    />
  );
}
