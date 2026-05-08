import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { CasaMatrizView } from "@/components/accounting/CasaMatrizView";
import { CipProjectsView } from "@/components/accounting/CipProjectsView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";
import { BarChart3, Building2, BookOpen, RotateCcw, Calendar, FileText, Shield, ArrowLeftRight, Landmark, HardHat } from "lucide-react";

export default function Accounting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "reports";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();

  // Sync ?tab=… into state when it changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) setActiveTab(tab);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Forward deep-link params (asset/dep/jid) into specific views via context props
  const assetId = searchParams.get("asset");
  const depId = searchParams.get("dep");
  const journalId = searchParams.get("jid");

  const handleTabChange = (next: string) => {
    setActiveTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };

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
      content: <FixedAssetsView highlightAssetId={assetId} highlightDepId={depId} />,
    },
    {
      value: "cip",
      label: t("accounting.cip"),
      icon: <HardHat className="h-4 w-4" />,
      content: <CipProjectsView highlightCapId={searchParams.get("cap")} />,
    },
    {
      value: "casa-matriz",
      label: t("accounting.casaMatriz"),
      icon: <Landmark className="h-4 w-4" />,
      content: (
        <CasaMatrizView
          highlightAdvId={searchParams.get("adv")}
          highlightRepId={searchParams.get("rep")}
          highlightAccId={searchParams.get("acc")}
          highlightFxrId={searchParams.get("fxr")}
        />
      ),
    },
    {
      value: "journal",
      label: t("accounting.journal"),
      icon: <BookOpen className="h-4 w-4" />,
      content: <JournalView highlightJournalId={journalId} />,
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
      onTabChange={handleTabChange}
      headerIcon={<BookOpen className="h-6 w-6 text-primary" />}
      headerAccent
      helpChapter="06-accounting"
      actions={<FxRevaluationButton />}
      tabGroups={[{ tabs: baseTabs }]}
    />
  );
}
