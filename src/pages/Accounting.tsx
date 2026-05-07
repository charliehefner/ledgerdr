import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { AccountingReportsView } from "@/components/accounting/AccountingReportsView";
import { FixedAssetsView } from "@/components/equipment/FixedAssetsView";
import { JournalView } from "@/components/accounting/JournalView";
import { PeriodsView } from "@/components/accounting/PeriodsView";
import { DGIIReportsView } from "@/components/accounting/DGIIReportsView";
import { RecurringEntriesView } from "@/components/accounting/RecurringEntriesView";
import { AuditLogView } from "@/components/accounting/AuditLogView";
import { IntercompanyView } from "@/components/accounting/IntercompanyView";
import { FxRevaluationButton } from "@/components/accounting/FxRevaluationButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";
import { BarChart3, Building2, BookOpen, RotateCcw, Calendar, FileText, Shield, ArrowLeftRight } from "lucide-react";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("reports");
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();

  // Check if the current entity belongs to a group
  const { data: hasGroup } = useQuery({
    queryKey: ["entity-has-group", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return false;
      const { data } = await supabase
        .from("entities")
        .select("entity_group_id")
        .eq("id", selectedEntityId)
        .maybeSingle();
      return !!data?.entity_group_id;
    },
    enabled: !!selectedEntityId,
  });

  const baseTabs = [
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
  ];

  // Conditionally add the Intercompany tab
  if (hasGroup) {
    baseTabs.push({
      value: "intercompany",
      label: t("intercompany.tab"),
      icon: <ArrowLeftRight className="h-4 w-4" />,
      content: <IntercompanyView />,
    });
  }

  baseTabs.push({
    value: "audit",
    label: t("audit.tab"),
    icon: <Shield className="h-4 w-4" />,
    content: <AuditLogView />,
  });

  return (
    <TabbedPageLayout
      title={t("page.accounting.title")}
      subtitle={t("page.accounting.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerIcon={<BookOpen className="h-6 w-6 text-primary" />}
      headerAccent
      helpChapter="06-accounting"
      actions={<FxRevaluationButton />}
      tabGroups={[{ tabs: baseTabs }]}
    />
  );
}
