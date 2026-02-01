import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationsLogView } from "@/components/operations/OperationsLogView";
import { FarmsFieldsView } from "@/components/operations/FarmsFieldsView";
import { OperationTypesView } from "@/components/operations/OperationTypesView";
import { FieldProgressReport } from "@/components/operations/FieldProgressReport";
import { InputUsageReport } from "@/components/operations/InputUsageReport";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Operations() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "log";
  const initialInputId = searchParams.get("inputId");
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("page.operations.title")}</h1>
          <p className="text-muted-foreground">
            {t("page.operations.subtitle")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-between">
            <div className="flex flex-wrap gap-1">
              <TabsTrigger value="log" colorScheme="primary">{t("operations.log")}</TabsTrigger>
              <TabsTrigger value="progress" colorScheme="secondary">{t("operations.fieldProgress")}</TabsTrigger>
              <TabsTrigger value="input-usage" colorScheme="accent">{t("operations.inputUsage")}</TabsTrigger>
            </div>
            <div className="flex gap-1">
              <TabsTrigger value="farms" colorScheme="primary">{t("operations.farmsFields")}</TabsTrigger>
              <TabsTrigger value="types" colorScheme="secondary">{t("operations.operationTypes")}</TabsTrigger>
            </div>
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
