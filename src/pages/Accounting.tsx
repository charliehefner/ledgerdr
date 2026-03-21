import { useState } from "react";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { AccountingReportsView } from "@/components/accounting/AccountingReportsView";
import { FixedAssetsView } from "@/components/equipment/FixedAssetsView";
import { JournalView } from "@/components/accounting/JournalView";
import { PeriodsView } from "@/components/accounting/PeriodsView";
import { DGIIReportsView } from "@/components/accounting/DGIIReportsView";
import { RecurringEntriesView } from "@/components/accounting/RecurringEntriesView";
import { AuditLogView } from "@/components/accounting/AuditLogView";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart3, Building2, BookOpen, RotateCcw, Calendar, FileText, Shield } from "lucide-react";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("reports");
  const { t } = useLanguage();

  return (
    <TabbedPageLayout
      title={t("page.accounting.title")}
      subtitle={t("page.accounting.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerIcon={<BookOpen className="h-6 w-6 text-primary" />}
      headerAccent
      helpChapter="06-accounting"
      tabGroups={[
        {
          tabs: [
            {
              value: "reports",
              label: t("accounting.reports"),
              icon: <BarChart3 className="h-4 w-4" />,
              content: <AccountingReportsView />,
            },
            {
              value: "fixed-assets",
              label: t("accounting.fixedAssets"),
              icon: <Building2 className="h-4 w-4" />,
              content: <FixedAssetsView />,
            },
            {
              value: "journal",
              label: t("accounting.journal"),
              icon: <BookOpen className="h-4 w-4" />,
              content: <JournalView />,
            },
            {
              value: "recurring",
              label: t("accounting.recurring"),
              icon: <RotateCcw className="h-4 w-4" />,
              content: <RecurringEntriesView />,
            },
            {
              value: "periods",
              label: t("accounting.periods"),
              icon: <Calendar className="h-4 w-4" />,
              content: <PeriodsView />,
            },
            {
              value: "dgii",
              label: "DGII",
              icon: <FileText className="h-4 w-4" />,
              content: <DGIIReportsView />,
            },
            {
              value: "audit",
              label: t("audit.tab"),
              icon: <Shield className="h-4 w-4" />,
              content: <AuditLogView />,
            },
          ],
        },
      ]}
    />
  );
}
