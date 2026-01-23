import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeList } from "@/components/hr/EmployeeList";
import { EmployeeForm } from "@/components/hr/EmployeeForm";
import { useAuth } from "@/contexts/AuthContext";

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState("employees");
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
          <h1 className="text-3xl font-bold text-foreground">Human Resources</h1>
          <p className="text-muted-foreground mt-1">Manage employee information and records</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="employees">Employee Directory</TabsTrigger>
            {canModifySettings && (
              <TabsTrigger value="add-employee">
                {editingEmployee ? "Edit Employee" : "Add Employee"}
              </TabsTrigger>
            )}
          </TabsList>

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
