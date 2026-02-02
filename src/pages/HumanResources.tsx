import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeList } from "@/components/hr/EmployeeList";
import { EmployeeForm } from "@/components/hr/EmployeeForm";
import { PayrollView } from "@/components/hr/PayrollView";
import { DayLaborView } from "@/components/hr/DayLaborView";
import { JornalerosView } from "@/components/hr/JornalerosView";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessHrTab, getDefaultHrTabForRole, HrTab } from "@/lib/permissions";

export default function HumanResources() {
  const { canModifySettings, user } = useAuth();
  const { t } = useLanguage();
  const userRole = user?.role;
  
  const [activeTab, setActiveTab] = useState<string>(() => 
    userRole ? getDefaultHrTabForRole(userRole) : "payroll"
  );
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);

  // Update default tab when role changes
  useEffect(() => {
    if (userRole) {
      const defaultTab = getDefaultHrTabForRole(userRole);
      if (!canAccessHrTab(userRole, activeTab as HrTab)) {
        setActiveTab(defaultTab);
      }
    }
  }, [userRole]);

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployee(employeeId);
    setActiveTab("add-employee");
  };

  const handleFormComplete = () => {
    setEditingEmployee(null);
    setActiveTab("employees");
  };

  const canAccessTab = (tab: HrTab) => canAccessHrTab(userRole, tab);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("page.hr.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("page.hr.subtitle")}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full justify-between">
            <div className="flex">
              {canAccessTab("payroll") && (
                <TabsTrigger value="payroll" colorScheme="primary">{t("hr.payroll")}</TabsTrigger>
              )}
              {canAccessTab("day-labor") && (
                <TabsTrigger value="day-labor" colorScheme="accent">{t("hr.dayLabor")}</TabsTrigger>
              )}
            </div>
            <div className="flex">
              {canAccessTab("jornaleros") && (
                <TabsTrigger value="jornaleros" colorScheme="muted">Jornaleros</TabsTrigger>
              )}
              {canAccessTab("employees") && (
                <TabsTrigger value="employees" colorScheme="secondary">{t("hr.employees")}</TabsTrigger>
              )}
              {canAccessTab("add-employee") && canModifySettings && (
                <TabsTrigger value="add-employee" colorScheme="accent">
                  {editingEmployee ? t("hr.editEmployee") : t("hr.addEmployee")}
                </TabsTrigger>
              )}
            </div>
          </TabsList>

          {canAccessTab("payroll") && (
            <TabsContent value="payroll" className="space-y-4">
              <PayrollView />
            </TabsContent>
          )}

          {canAccessTab("day-labor") && (
            <TabsContent value="day-labor" className="space-y-4">
              <DayLaborView />
            </TabsContent>
          )}

          {canAccessTab("jornaleros") && (
            <TabsContent value="jornaleros" className="space-y-4">
              <JornalerosView />
            </TabsContent>
          )}

          {canAccessTab("employees") && (
            <TabsContent value="employees" className="space-y-4">
              <EmployeeList onEdit={handleEditEmployee} />
            </TabsContent>
          )}

          {canAccessTab("add-employee") && canModifySettings && (
            <TabsContent value="add-employee" className="space-y-4">
              <EmployeeForm 
                employeeId={editingEmployee} 
                onComplete={handleFormComplete}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
