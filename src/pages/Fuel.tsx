import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FuelTanksView } from "@/components/fuel/FuelTanksView";
import { AgricultureFuelView } from "@/components/fuel/AgricultureFuelView";
import { IndustryFuelView } from "@/components/fuel/IndustryFuelView";

export default function Fuel() {
  const [activeTab, setActiveTab] = useState("agriculture");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fuel Management</h1>
          <p className="text-muted-foreground">
            Track fuel tanks and consumption
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="agriculture" colorScheme="primary">Agriculture</TabsTrigger>
            <TabsTrigger value="industry" colorScheme="secondary">Industry</TabsTrigger>
            <TabsTrigger value="tanks" colorScheme="accent">Tanks</TabsTrigger>
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
