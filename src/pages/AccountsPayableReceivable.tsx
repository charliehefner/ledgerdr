import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReceivablesView } from "@/components/accounting/ReceivablesView";
import { PayablesView } from "@/components/accounting/PayablesView";

export default function AccountsPayableReceivable() {
  const [activeTab, setActiveTab] = useState("payables");
  const { t } = useLanguage();

  return (
    <TabbedPageLayout
      title={t("page.apar.title")}
      subtitle={t("page.apar.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabGroups={[
        {
          tabs: [
            {
              value: "receivables",
              label: t("apar.receivables"),
              content: <ReceivablesView />,
            },
            {
              value: "payables",
              label: t("apar.payables"),
              content: <PayablesView />,
            },
          ],
        },
      ]}
    />
  );
}
