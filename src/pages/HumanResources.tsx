import { useState, useEffect } from "react";
import { TabbedPageLayout, TabGroup } from "@/components/layout/TabbedPageLayout";
import { EmployeeList } from "@/components/hr/EmployeeList";
import { EmployeeFormDialog } from "@/components/hr/EmployeeFormDialog";
import { PayrollView } from "@/components/hr/PayrollView";
import { DayLaborView } from "@/components/hr/DayLaborView";
import { JornalerosView } from "@/components/hr/JornalerosView";
import { ServicesView } from "@/components/hr/ServicesView";
import { ServiceProvidersView } from "@/components/hr/ServiceProvidersView";
import { TSSAutodeterminacionView } from "@/components/hr/TSSAutodeterminacionView";
// IR3 moved to Accounting > DGII tab
import { IR17ReportView } from "@/components/hr/IR17ReportView";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessHrTab, getDefaultHrTabForRole, HrTab } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { UserPlus, FileText, ArrowLeft } from "lucide-react";

export default function HumanResources() {
  const { canModifySettings, user } = useAuth();
  const { t } = useLanguage();
  const userRole = user?.role;
  
  const [activeTab, setActiveTab] = useState<string>(() => 
    userRole ? getDefaultHrTabForRole(userRole) : "payroll"
  );
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [selectedGovReport, setSelectedGovReport] = useState<string | null>(null);

  // Update default tab when role changes
  useEffect(() => {
    if (userRole) {
      const defaultTab = getDefaultHrTabForRole(userRole);
      if (!canAccessHrTab(userRole, activeTab as HrTab)) {
        setActiveTab(defaultTab);
      }
    }
  }, [userRole, activeTab]);

  // Reset gov report selection when switching away from tss tab
  useEffect(() => {
    if (activeTab !== "tss") {
      setSelectedGovReport(null);
    }
  }, [activeTab]);

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployeeId(employeeId);
    setEmployeeDialogOpen(true);
  };

  const handleAddEmployee = () => {
    setEditingEmployeeId(null);
    setEmployeeDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEmployeeDialogOpen(false);
      setEditingEmployeeId(null);
    }
  };

  const canAccessTab = (tab: HrTab) => canAccessHrTab(userRole, tab);

  const govReportOptions = [
    { key: "tss", label: t("hr.govReportOptions.tss"), description: t("hr.govReportOptions.tssDesc") },
    { key: "ir17", label: t("hr.govReportOptions.ir17"), description: t("hr.govReportOptions.ir17Desc") },
  ];

  const renderGovReportContent = () => {
    if (!selectedGovReport) {
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          {govReportOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedGovReport(opt.key)}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-accent hover:border-accent-foreground/20"
            >
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-base font-semibold text-foreground">{opt.label}</span>
              <span className="text-sm text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedGovReport(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("hr.backToReports")}
        </Button>
        {selectedGovReport === "tss" && <TSSAutodeterminacionView />}
        {selectedGovReport === "ir17" && <IR17ReportView />}
      </div>
    );
  };

  // Build tab groups based on permissions
  const mainTabs = [];
  if (canAccessTab("payroll")) {
    mainTabs.push({
      value: "payroll",
      label: t("hr.payroll"),
      content: <PayrollView />,
    });
  }
  if (canAccessTab("day-labor")) {
    mainTabs.push({
      value: "day-labor",
      label: t("hr.dayLabor"),
      content: <DayLaborView />,
    });
  }
  if (canAccessTab("servicios")) {
    mainTabs.push({
      value: "servicios",
      label: t("hr.services"),
      content: <ServicesView />,
    });
  }
  if (canAccessTab("tss")) {
    mainTabs.push({
      value: "tss",
      label: t("hr.govReports"),
      content: renderGovReportContent(),
    });
  }

  const rightTabs = [];
  if (canAccessTab("jornaleros")) {
    rightTabs.push({
      value: "jornaleros",
      label: t("hr.jornaleros"),
      content: <JornalerosView />,
    });
  }
  if (canAccessTab("prestadores")) {
    rightTabs.push({
      value: "prestadores",
      label: t("hr.providers"),
      content: <ServiceProvidersView />,
    });
  }
  if (canAccessTab("employees")) {
    rightTabs.push({
      value: "employees",
      label: t("hr.employees"),
      content: <EmployeeList onEdit={handleEditEmployee} />,
    });
  }

  const tabGroups: TabGroup[] = [{ tabs: mainTabs }];
  if (rightTabs.length > 0) {
    tabGroups.push({ tabs: rightTabs, align: "right" });
  }

  // Add Employee button only visible when on employees tab and has permission
  const actions = activeTab === "employees" && canModifySettings ? (
    <Button size="sm" onClick={handleAddEmployee}>
      <UserPlus className="h-4 w-4 mr-2" />
      {t("hr.addEmployee")}
    </Button>
  ) : null;

  return (
    <>
      <TabbedPageLayout
        title={t("page.hr.title")}
        subtitle={t("page.hr.subtitle")}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabGroups={tabGroups}
        actions={actions}
        helpChapter="11-hr"
      />

      <EmployeeFormDialog
        employeeId={editingEmployeeId}
        open={employeeDialogOpen}
        onOpenChange={handleDialogClose}
      />
    </>
  );
}
