import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TractorsView } from "@/components/fuel/TractorsView";
import { ImplementsView } from "@/components/fuel/ImplementsView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Equipment() {
  const [activeTab, setActiveTab] = useState("tractors");
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("page.equipment.title")}</h1>
          <p className="text-muted-foreground">
            {t("page.equipment.subtitle")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tractors">{t("equipment.tractors")}</TabsTrigger>
            <TabsTrigger value="implements">{t("equipment.implements")}</TabsTrigger>
          </TabsList>

          <TabsContent value="tractors" className="mt-6">
            <TractorsView />
          </TabsContent>

          <TabsContent value="implements" className="mt-6">
            <ImplementsView />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
