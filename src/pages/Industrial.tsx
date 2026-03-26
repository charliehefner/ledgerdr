import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { Factory, Gauge, Truck } from "lucide-react";
import { PlantHoursView } from "@/components/industrial/PlantHoursView";
import { CarretasView } from "@/components/industrial/CarretasView";
import { TrucksView } from "@/components/industrial/TrucksView";

export default function Industrial() {
  const [activeTab, setActiveTab] = useState("plant-hours");

  return (
    <TabbedPageLayout
      title="Industrial"
      subtitle="Horas planta, carretas y camiones"
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerIcon={<Factory className="h-5 w-5 text-primary" />}
      headerAccent
      tabGroups={[
        {
          tabs: [
            {
              value: "plant-hours",
              label: "Horas Planta",
              icon: <Gauge className="h-4 w-4" />,
              content: <PlantHoursView />,
            },
            {
              value: "carretas",
              label: "Carretas",
              icon: <Factory className="h-4 w-4" />,
              content: <CarretasView />,
            },
            {
              value: "trucks",
              label: "Camiones",
              icon: <Truck className="h-4 w-4" />,
              content: <TrucksView />,
            },
          ],
        },
      ]}
    />
  );
}
