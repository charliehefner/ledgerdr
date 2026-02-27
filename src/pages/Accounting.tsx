import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { AccountingReportsView } from "@/components/accounting/AccountingReportsView";
import { FixedAssetsView } from "@/components/equipment/FixedAssetsView";
import { JournalView } from "@/components/accounting/JournalView";
import { PeriodsView } from "@/components/accounting/PeriodsView";
import { DGIIReportsView } from "@/components/accounting/DGIIReportsView";
import { RecurringEntriesView } from "@/components/accounting/RecurringEntriesView";
import { BankReconciliationView } from "@/components/accounting/BankReconciliationView";
import { AuditLogView } from "@/components/accounting/AuditLogView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("reports");
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
              value: "reports",
              label: t("accounting.reports"),
              content: <AccountingReportsView />,
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
            {
              value: "recurring",
              label: "Recurrentes",
              content: <RecurringEntriesView />,
            },
            {
              value: "bank-recon",
              label: "Conciliación",
              content: <BankReconciliationView />,
            },
            {
              value: "periods",
              label: t("accounting.periods"),
              content: <PeriodsView />,
            },
            {
              value: "dgii",
              label: "DGII",
              content: <DGIIReportsView />,
            },
            {
              value: "audit",
              label: t("audit.tab"),
              content: <AuditLogView />,
            },
          ],
        },
      ]}
    />
  );
}
