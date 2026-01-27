import { useState } from "react";
import { format, startOfMonth, setDate, endOfMonth, differenceInMonths } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollPeriodSelector } from "./PayrollPeriodSelector";
import { PayrollTimeGrid } from "./PayrollTimeGrid";
import { PayrollSummary } from "./PayrollSummary";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";

interface PayrollPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
}

// Calculate Nomina number: Jan 16-31, 2026 = Nomina 90
// Each month has 2 nominas (1-15 and 16-31)
function calculateNominaNumber(startDate: Date): number {
  const referenceDate = new Date(2026, 0, 16); // Jan 16, 2026
  const referenceNomina = 90;
  
  // Calculate months difference from reference
  const monthsDiff = differenceInMonths(startOfMonth(startDate), startOfMonth(referenceDate));
  
  // Each month has 2 nominas
  const nominasFromMonths = monthsDiff * 2;
  
  // Adjust for which half of month (1-15 = first, 16+ = second)
  const isSecondHalf = startDate.getDate() >= 16;
  const referenceIsSecondHalf = true; // Jan 16 is second half
  
  const halfAdjustment = (isSecondHalf ? 1 : 0) - (referenceIsSecondHalf ? 1 : 0);
  
  return referenceNomina + nominasFromMonths + halfAdjustment;
}

function getCurrentPeriod(): { startDate: Date; endDate: Date } {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const monthStart = startOfMonth(today);

  if (dayOfMonth <= 15) {
    return {
      startDate: setDate(monthStart, 1),
      endDate: setDate(monthStart, 15),
    };
  } else {
    return {
      startDate: setDate(monthStart, 16),
      endDate: endOfMonth(today),
    };
  }
}

export function PayrollView() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("timesheet");

  // Fetch or create period
  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: [
      "payroll-period",
      format(selectedPeriod.startDate, "yyyy-MM-dd"),
      format(selectedPeriod.endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const startStr = format(selectedPeriod.startDate, "yyyy-MM-dd");
      const endStr = format(selectedPeriod.endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("start_date", startStr)
        .eq("end_date", endStr)
        .maybeSingle();

      if (error) throw error;
      return data as PayrollPeriod | null;
    },
  });

  // Create period mutation
  const createPeriod = useMutation({
    mutationFn: async () => {
      const startStr = format(selectedPeriod.startDate, "yyyy-MM-dd");
      const endStr = format(selectedPeriod.endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("payroll_periods")
        .insert({
          start_date: startStr,
          end_date: endStr,
          status: "open",
          is_current: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-period"] });
      toast.success("Período de nómina creado");
    },
    onError: (error) => {
      toast.error("Error al crear período: " + error.message);
    },
  });

  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setDetailDialogOpen(true);
  };

  const nominaNumber = calculateNominaNumber(selectedPeriod.startDate);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Hoja de Tiempo Nómina {nominaNumber}</CardTitle>
          <div className="flex items-center gap-4">
            <PayrollPeriodSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
            {!periodData && !periodLoading && (
              <Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Período
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {periodLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando período...
            </div>
          ) : !periodData ? (
            <div className="text-center py-8 text-muted-foreground">
              No existe un período para este rango de fechas. Haga clic en "Crear Período" para comenzar.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Estado:</span>
                <span
                  className={`font-medium ${
                    periodData.status === "open"
                      ? "text-green-600"
                      : periodData.status === "closed"
                      ? "text-yellow-600"
                      : "text-blue-600"
                  }`}
                >
                  {periodData.status === "open" ? "ABIERTO" : periodData.status === "closed" ? "CERRADO" : periodData.status.toUpperCase()}
                </span>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="timesheet">Hoja de Tiempo</TabsTrigger>
                  <TabsTrigger value="summary">Resumen y Cierre</TabsTrigger>
                </TabsList>
                
                <TabsContent value="timesheet" className="mt-4">
                  <PayrollTimeGrid
                    periodId={periodData.id}
                    startDate={selectedPeriod.startDate}
                    endDate={selectedPeriod.endDate}
                    onEmployeeClick={handleEmployeeClick}
                  />
                </TabsContent>
                
                <TabsContent value="summary" className="mt-4">
                  <PayrollSummary
                    periodId={periodData.id}
                    periodStatus={periodData.status}
                    startDate={selectedPeriod.startDate}
                    endDate={selectedPeriod.endDate}
                    nominaNumber={nominaNumber}
                    onPeriodClosed={() => setActiveTab("timesheet")}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeDetailDialog
        employeeId={selectedEmployeeId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
