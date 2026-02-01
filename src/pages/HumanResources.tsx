import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeList } from "@/components/hr/EmployeeList";
import { EmployeeForm } from "@/components/hr/EmployeeForm";
import { PayrollView } from "@/components/hr/PayrollView";
import { DayLaborView } from "@/components/hr/DayLaborView";
import { JornalerosView } from "@/components/hr/JornalerosView";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState("payroll");
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const { canModifySettings } = useAuth();
  const { t } = useLanguage();

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployee(employeeId);
    setActiveTab("add-employee");
  };

  const handleFormComplete = () => {
    setEditingEmployee(null);
    setActiveTab("employees");
  };

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
              <TabsTrigger value="payroll" colorScheme="primary">{t("hr.payroll")}</TabsTrigger>
              <TabsTrigger value="day-labor" colorScheme="accent">{t("hr.dayLabor")}</TabsTrigger>
            </div>
            <div className="flex">
              <TabsTrigger value="jornaleros" colorScheme="muted">Jornaleros</TabsTrigger>
              <TabsTrigger value="employees" colorScheme="secondary">{t("hr.employees")}</TabsTrigger>
              {canModifySettings && (
                <TabsTrigger value="add-employee" colorScheme="accent">
                  {editingEmployee ? t("hr.editEmployee") : t("hr.addEmployee")}
                </TabsTrigger>
              )}
            </div>
          </TabsList>

          <TabsContent value="payroll" className="space-y-4">
            <PayrollView />
          </TabsContent>

          <TabsContent value="day-labor" className="space-y-4">
            <DayLaborView />
          </TabsContent>

          <TabsContent value="jornaleros" className="space-y-4">
            <JornalerosView />
          </TabsContent>

          <TabsContent value="employees" className="space-y-4">
            <EmployeeList onEdit={handleEditEmployee} />
          </TabsContent>

          {canModifySettings && (
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
