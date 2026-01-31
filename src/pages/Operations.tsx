import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationsLogView } from "@/components/operations/OperationsLogView";
import { FarmsFieldsView } from "@/components/operations/FarmsFieldsView";
import { OperationTypesView } from "@/components/operations/OperationTypesView";
import { FieldProgressReport } from "@/components/operations/FieldProgressReport";
import { InputUsageReport } from "@/components/operations/InputUsageReport";
import { FieldInputsReport } from "@/components/operations/FieldInputsReport";

export default function Operations() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "log";
  const initialInputId = searchParams.get("inputId");
  const initialFieldId = searchParams.get("fieldId");
  
  const [activeTab, setActiveTab] = useState(initialTab);

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
          <TabsList className="flex-wrap">
            <TabsTrigger value="log" colorScheme="primary">Operations Log</TabsTrigger>
            <TabsTrigger value="progress" colorScheme="secondary">Progreso de Campos</TabsTrigger>
            <TabsTrigger value="input-usage" colorScheme="accent">Uso de Insumos</TabsTrigger>
            <TabsTrigger value="field-inputs" colorScheme="muted">Insumos por Campo</TabsTrigger>
            <TabsTrigger value="farms" colorScheme="primary">Farms & Fields</TabsTrigger>
            <TabsTrigger value="types" colorScheme="secondary">Operation Types</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-6">
            <OperationsLogView />
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <FieldProgressReport />
          </TabsContent>

          <TabsContent value="input-usage" className="mt-6">
            <InputUsageReport initialInputId={initialInputId} />
          </TabsContent>

          <TabsContent value="field-inputs" className="mt-6">
            <FieldInputsReport initialFieldId={initialFieldId} />
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
