import { useState } from "react";
import { format, startOfMonth, setDate, endOfMonth, differenceInMonths } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollPeriodSelector } from "./PayrollPeriodSelector";
import { PayrollTimeGrid } from "./PayrollTimeGrid";
import { PayrollSummary } from "./PayrollSummary";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface PayrollPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
}

// Calculate Nomina number: Jan 16-31, 2026 = Nomina 90
function calculateNominaNumber(startDate: Date): number {
  const referenceDate = new Date(2026, 0, 16);
  const referenceNomina = 90;
  const monthsDiff = differenceInMonths(startOfMonth(startDate), startOfMonth(referenceDate));
  const nominasFromMonths = monthsDiff * 2;
  const isSecondHalf = startDate.getDate() >= 16;
  const referenceIsSecondHalf = true;
  const halfAdjustment = (isSecondHalf ? 1 : 0) - (referenceIsSecondHalf ? 1 : 0);
  return referenceNomina + nominasFromMonths + halfAdjustment;
}

function getCurrentPeriod(): { startDate: Date; endDate: Date } {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const monthStart = startOfMonth(today);

  if (dayOfMonth <= 15) {
    return { startDate: setDate(monthStart, 1), endDate: setDate(monthStart, 15) };
  } else {
    return { startDate: setDate(monthStart, 16), endDate: endOfMonth(today) };
  }
}

export function PayrollView() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("timesheet");

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: [
      "payroll-period",
      format(selectedPeriod.startDate, "yyyy-MM-dd"),
      format(selectedPeriod.endDate, "yyyy-MM-dd"),
      selectedEntityId,
    ],
    queryFn: async () => {
      const startStr = format(selectedPeriod.startDate, "yyyy-MM-dd");
      const endStr = format(selectedPeriod.endDate, "yyyy-MM-dd");
      let query: any = supabase
        .from("payroll_periods")
        .select("*")
        .eq("start_date", startStr)
        .eq("end_date", endStr);
      query = applyEntityFilter(query);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as PayrollPeriod | null;
    },
  });

  const createPeriod = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId) throw new Error(t("payroll.entityRequired"));
      const startStr = format(selectedPeriod.startDate, "yyyy-MM-dd");
      const endStr = format(selectedPeriod.endDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("payroll_periods")
        .insert({ start_date: startStr, end_date: endStr, status: "open", is_current: true, entity_id: selectedEntityId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-period"] });
      toast.success(t("payroll.periodCreated"));
    },
    onError: (error) => {
      toast.error(t("payroll.periodCreateError") + error.message);
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
          <CardTitle>{t("payroll.timesheetTitle").replace("{number}", String(nominaNumber))}</CardTitle>
          <div className="flex items-center gap-4">
            <PayrollPeriodSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
            {!periodData && !periodLoading && (
              <Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                {t("payroll.createPeriod")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {periodLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("payroll.loadingPeriod")}
            </div>
          ) : !periodData ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("payroll.noPeriod")}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("payroll.statusLabel")}</span>
                <span
                  className={`font-medium ${
                    periodData.status === "open"
                      ? "text-green-600"
                      : periodData.status === "closed"
                      ? "text-yellow-600"
                      : "text-blue-600"
                  }`}
                >
                  {periodData.status === "open" ? t("payroll.statusOpen") : periodData.status === "closed" ? t("payroll.statusClosed") : periodData.status.toUpperCase()}
                </span>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-between">
                  <TabsTrigger value="timesheet">{t("payroll.timesheet")}</TabsTrigger>
                  {!isOffice && (
                    <TabsTrigger value="summary">{t("payroll.summaryAndClose")}</TabsTrigger>
                  )}
                </TabsList>
                
                <TabsContent value="timesheet" className="mt-4">
                  <PayrollTimeGrid
                    periodId={periodData.id}
                    startDate={selectedPeriod.startDate}
                    endDate={selectedPeriod.endDate}
                    onEmployeeClick={handleEmployeeClick}
                  />
                </TabsContent>
                
                {!isOffice && (
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
                )}
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