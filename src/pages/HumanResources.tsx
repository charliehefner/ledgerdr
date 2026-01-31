import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeList } from "@/components/hr/EmployeeList";
import { EmployeeForm } from "@/components/hr/EmployeeForm";
import { PayrollView } from "@/components/hr/PayrollView";
import { DayLaborView } from "@/components/hr/DayLaborView";
import { useAuth } from "@/contexts/AuthContext";

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState("payroll");
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const { canModifySettings } = useAuth();

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
          <h1 className="text-3xl font-bold text-foreground">Recursos Humanos</h1>
          <p className="text-muted-foreground mt-1">Gestionar nómina y registros de empleados</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full justify-between">
            <div className="flex">
              <TabsTrigger value="payroll" colorScheme="primary">Nómina</TabsTrigger>
              <TabsTrigger value="day-labor" colorScheme="secondary">Jornales</TabsTrigger>
            </div>
            <div className="flex">
              <TabsTrigger value="employees" colorScheme="accent">Directorio de Empleados</TabsTrigger>
              {canModifySettings && (
                <TabsTrigger value="add-employee" colorScheme="muted">
                  {editingEmployee ? "Editar Empleado" : "Agregar Empleado"}
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
