import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { OperationsLogView } from "@/components/operations/OperationsLogView";
import { FieldProgressReport } from "@/components/operations/FieldProgressReport";
import { InputUsageReport } from "@/components/operations/InputUsageReport";
import { ContractedServicesView } from "@/components/operations/ContractedServicesView";
import { FieldsMapView } from "@/components/operations/FieldsMapView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Operations() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "log";
  const initialInputId = searchParams.get("inputId");
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mapExpanded, setMapExpanded] = useState(false);

  const handleTabChange = (tab: string) => {
    if (tab !== "map") setMapExpanded(false);
    setActiveTab(tab);
  };

  return (
    <TabbedPageLayout
      title={t("page.operations.title")}
      subtitle={t("page.operations.subtitle")}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      hideChrome={mapExpanded}
      helpChapter="14-operations"
      tabGroups={[
        {
          tabs: [
            {
              value: "log",
              label: t("operations.log"),
              content: <OperationsLogView />,
            },
            {
              value: "contracts",
              label: t("operations.contracts"),
              content: <ContractedServicesView />,
            },
          ],
        },
        {
          align: "right",
          tabs: [
            {
              value: "progress",
              label: t("operations.fieldProgress"),
              content: <FieldProgressReport />,
            },
            {
              value: "input-usage",
              label: t("operations.inputUsage"),
              content: <InputUsageReport initialInputId={initialInputId} />,
            },
            {
              value: "map",
              label: t("operations.map"),
              content: <FieldsMapView expanded={mapExpanded} onExpandToggle={() => setMapExpanded((v) => !v)} />,
            },
          ],
        },
      ]}
    />
  );
}
