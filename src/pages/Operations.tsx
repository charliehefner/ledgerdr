import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationsLogView } from "@/components/operations/OperationsLogView";
import { FarmsFieldsView } from "@/components/operations/FarmsFieldsView";
import { OperationTypesView } from "@/components/operations/OperationTypesView";
import { FieldProgressReport } from "@/components/operations/FieldProgressReport";

export default function Operations() {
  const [activeTab, setActiveTab] = useState("log");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Operations</h1>
          <p className="text-muted-foreground">
            Track field operations across farms
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="log">Operations Log</TabsTrigger>
            <TabsTrigger value="progress">Progreso de Campos</TabsTrigger>
            <TabsTrigger value="farms">Farms & Fields</TabsTrigger>
            <TabsTrigger value="types">Operation Types</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-6">
            <OperationsLogView />
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <FieldProgressReport />
          </TabsContent>

          <TabsContent value="farms" className="mt-6">
            <FarmsFieldsView />
          </TabsContent>

          <TabsContent value="types" className="mt-6">
            <OperationTypesView />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
