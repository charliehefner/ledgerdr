import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TractorsView } from "@/components/fuel/TractorsView";
import { ImplementsView } from "@/components/fuel/ImplementsView";

export default function Equipment() {
  const [activeTab, setActiveTab] = useState("tractors");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Equipment</h1>
          <p className="text-muted-foreground">
            Manage tractors and implements
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tractors" colorScheme="primary">Tractors</TabsTrigger>
            <TabsTrigger value="implements" colorScheme="secondary">Implements</TabsTrigger>
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
