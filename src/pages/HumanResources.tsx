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
import { IR3ReportView } from "@/components/hr/IR3ReportView";
import { IR17ReportView } from "@/components/hr/IR17ReportView";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessHrTab, getDefaultHrTabForRole, HrTab } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function HumanResources() {
  const { canModifySettings, user } = useAuth();
  const { t } = useLanguage();
  const userRole = user?.role;
  
  const [activeTab, setActiveTab] = useState<string>(() => 
    userRole ? getDefaultHrTabForRole(userRole) : "payroll"
  );
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  // Update default tab when role changes
  useEffect(() => {
    if (userRole) {
      const defaultTab = getDefaultHrTabForRole(userRole);
      if (!canAccessHrTab(userRole, activeTab as HrTab)) {
        setActiveTab(defaultTab);
      }
    }
  }, [userRole, activeTab]);

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
      label: "Servicios",
      content: <ServicesView />,
    });
  }
  if (canAccessTab("tss")) {
    mainTabs.push({
      value: "tss",
      label: "Reportes Gob.",
      content: (
        <div className="space-y-6">
          <TSSAutodeterminacionView />
          <IR3ReportView />
          <IR17ReportView />
        </div>
      ),
    });
  }

  const rightTabs = [];
  if (canAccessTab("jornaleros")) {
    rightTabs.push({
      value: "jornaleros",
      label: "Jornaleros",
      content: <JornalerosView />,
    });
  }
  if (canAccessTab("prestadores")) {
    rightTabs.push({
      value: "prestadores",
      label: "Prestadores",
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
      />

      <EmployeeFormDialog
        employeeId={editingEmployeeId}
        open={employeeDialogOpen}
        onOpenChange={handleDialogClose}
      />
    </>
  );
}
