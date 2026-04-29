import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addYears } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Umbrella,
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  Calendar,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";

interface VacationRecord {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
}

interface VacationCountdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  employeeName: string;
  dateOfHire: string;
}

export function VacationCountdownDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  dateOfHire,
}: VacationCountdownDialogProps) {
  const [activeTab, setActiveTab] = useState("status");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { canWriteSection } = useAuth();
  const canModifySettings = canWriteSection("hr");
  const { t, language } = useLanguage();
  const { requireEntity } = useEntity();
  const dateLocale = language === "en" ? enUS : es;

  const { data: vacationHistory = [], isLoading } = useQuery({
    queryKey: ["employee-vacations", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("*")
        .eq("employee_id", employeeId)
        .order("end_date", { ascending: false });
      if (error) throw error;
      return data as VacationRecord[];
    },
    enabled: !!employeeId && open,
  });

  const lastVacation = vacationHistory[0];
  const baseDate = lastVacation
    ? parseDateLocal(lastVacation.end_date)
    : parseDateLocal(dateOfHire);
  const nextVacationDue = addYears(baseDate, 1);
  const today = new Date();
  const daysUntilVacation = differenceInDays(nextVacationDue, today);
  const isOverdue = daysUntilVacation < 0;
  const isDueSoon = daysUntilVacation >= 0 && daysUntilVacation <= 30;

  const addVacationMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("No employee selected");
      const entityId = requireEntity();
      if (!entityId) throw new Error("Selecciona una entidad antes de crear");
      const { error } = await supabase.from("employee_vacations").insert({
        employee_id: employeeId,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
        entity_id: entityId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-vacations-summary"] });
      toast.success(t("vacation.registered"));
      setStartDate("");
      setEndDate("");
      setNotes("");
      setActiveTab("status");
    },
    onError: (error: Error) => {
      toast.error(`${t("vacation.registerError")}: ${error.message}`);
    },
  });

  const deleteVacationMutation = useMutation({
    mutationFn: async (vacationId: string) => {
      const { error } = await supabase
        .from("employee_vacations")
        .delete()
        .eq("id", vacationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-vacations-summary"] });
      toast.success(t("vacation.deleted"));
    },
    onError: (error: Error) => {
      toast.error(`${t("vacation.deleteError")}: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error(t("vacation.fillDates"));
      return;
    }
    if (endDate < startDate) {
      toast.error(t("vacation.endAfterStart"));
      return;
    }
    addVacationMutation.mutate();
  };

  const getStatusBadge = () => {
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="text-sm">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {t("vacation.overdueBy").replace("{days}", String(Math.abs(daysUntilVacation)))}
        </Badge>
      );
    }
    if (isDueSoon) {
      return (
        <Badge variant="secondary" className="bg-warning/20 text-warning-foreground text-sm">
          <Clock className="h-3 w-3 mr-1" />
          {t("vacation.dueSoon").replace("{days}", String(daysUntilVacation))}
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-success/20 text-success-foreground text-sm">
        <CheckCircle className="h-3 w-3 mr-1" />
        {t("vacation.daysRemaining").replace("{days}", String(daysUntilVacation))}
      </Badge>
    );
  };

  const calculateVacationDays = (start: string, end: string) => {
    return differenceInDays(parseDateLocal(end), parseDateLocal(start)) + 1;
  };

  if (!employeeId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Umbrella className="h-5 w-5" />
            {t("vacation.title")} - {employeeName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">{t("vacation.statusTab")}</TabsTrigger>
            <TabsTrigger value="add" disabled={!canModifySettings}>
              {t("vacation.registerTab")}
            </TabsTrigger>
            <TabsTrigger value="history">{t("vacation.historyTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{t("vacation.vacationStatus")}</span>
                  {getStatusBadge()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("vacation.hireDate")}</span>
                  <span className="font-medium">
                    {format(parseDateLocal(dateOfHire), "d MMM yyyy", { locale: dateLocale })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("vacation.lastVacation")}</span>
                  <span className="font-medium">
                    {lastVacation
                      ? format(parseDateLocal(lastVacation.end_date), "d MMM yyyy", { locale: dateLocale })
                      : t("vacation.noRecord")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("vacation.calcBasis")}</span>
                  <span className="font-medium">
                    {lastVacation ? t("vacation.basedOnLastVacation") : t("vacation.basedOnHireDate")}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-muted-foreground font-medium">{t("vacation.nextVacation")}</span>
                  <span
                    className={`font-bold ${
                      isOverdue
                        ? "text-destructive"
                        : isDueSoon
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {format(nextVacationDue, "d MMM yyyy", { locale: dateLocale })}
                  </span>
                </div>
                {isOverdue && (
                  <div className="mt-3 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    {t("vacation.overdueWarning").replace("{days}", String(Math.abs(daysUntilVacation)))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t("vacation.registerVacation")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">{t("vacation.startDate")}</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">{t("vacation.endDate")}</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {startDate && endDate && endDate >= startDate && (
                    <div className="text-sm text-muted-foreground">
                      {t("vacation.duration")}: {t("vacation.durationDays").replace("{days}", String(calculateVacationDays(startDate, endDate)))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t("vacation.notesOptional")}</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("vacation.notesPlaceholder")}
                      rows={2}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={addVacationMutation.isPending}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {addVacationMutation.isPending ? t("vacation.saving") : t("vacation.registerBtn")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("vacation.history")}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : vacationHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {t("vacation.noHistory")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("vacation.start")}</TableHead>
                        <TableHead>{t("vacation.end")}</TableHead>
                        <TableHead>{t("vacation.days")}</TableHead>
                        <TableHead>{t("common.notes")}</TableHead>
                        {canModifySettings && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacationHistory.map((vacation) => (
                        <TableRow key={vacation.id}>
                          <TableCell>
                            {format(parseDateLocal(vacation.start_date), "d MMM yyyy", { locale: dateLocale })}
                          </TableCell>
                          <TableCell>
                            {format(parseDateLocal(vacation.end_date), "d MMM yyyy", { locale: dateLocale })}
                          </TableCell>
                          <TableCell>
                            {calculateVacationDays(vacation.start_date, vacation.end_date)}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {vacation.notes || "—"}
                          </TableCell>
                          {canModifySettings && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteVacationMutation.mutate(vacation.id)}
                                disabled={deleteVacationMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
