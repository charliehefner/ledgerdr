import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { ChartOfAccountsView } from "@/components/accounting/ChartOfAccountsView";
import { PeriodsView } from "@/components/accounting/PeriodsView";
import { FixedAssetsView } from "@/components/equipment/FixedAssetsView";
import { JournalView } from "@/components/accounting/JournalView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("chart-of-accounts");
  const { t } = useLanguage();

  return (
    <TabbedPageLayout
      title={t("page.accounting.title")}
      subtitle={t("page.accounting.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabGroups={[
        {
          tabs: [
            {
              value: "chart-of-accounts",
              label: t("accounting.chartOfAccounts"),
              content: <ChartOfAccountsView />,
            },
            {
              value: "periods",
              label: t("accounting.periods"),
              content: <PeriodsView />,
            },
            {
              value: "fixed-assets",
              label: t("accounting.fixedAssets"),
              content: <FixedAssetsView />,
            },
            {
              value: "journal",
              label: t("accounting.journal"),
              content: <JournalView />,
            },
          ],
        },
      ]}
    />
  );
}
