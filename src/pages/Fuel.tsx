import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FuelTanksView } from "@/components/fuel/FuelTanksView";
import { AgricultureFuelView } from "@/components/fuel/AgricultureFuelView";
import { IndustryFuelView } from "@/components/fuel/IndustryFuelView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Fuel() {
  const [activeTab, setActiveTab] = useState("agriculture");
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("page.fuel.title")}</h1>
          <p className="text-muted-foreground">
            {t("page.fuel.subtitle")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="agriculture" colorScheme="primary">{t("fuel.agriculture")}</TabsTrigger>
            <TabsTrigger value="industry" colorScheme="secondary">{t("fuel.industry")}</TabsTrigger>
            <TabsTrigger value="tanks" colorScheme="accent">{t("fuel.tanks")}</TabsTrigger>
          </TabsList>

          <TabsContent value="agriculture" className="mt-6">
            <AgricultureFuelView />
          </TabsContent>

          <TabsContent value="industry" className="mt-6">
            <IndustryFuelView />
          </TabsContent>

          <TabsContent value="tanks" className="mt-6">
            <FuelTanksView />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
