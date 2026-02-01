import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addYears, parseISO } from "date-fns";
import { es } from "date-fns/locale";
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
  const { canModifySettings } = useAuth();

  // Fetch vacation history
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

  // Calculate vacation status
  const lastVacation = vacationHistory[0];
  const baseDate = lastVacation
    ? parseISO(lastVacation.end_date)
    : parseISO(dateOfHire);
  const nextVacationDue = addYears(baseDate, 1);
  const today = new Date();
  const daysUntilVacation = differenceInDays(nextVacationDue, today);
  const isOverdue = daysUntilVacation < 0;
  const isDueSoon = daysUntilVacation >= 0 && daysUntilVacation <= 30;

  // Add vacation mutation
  const addVacationMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("No employee selected");
      const { error } = await supabase.from("employee_vacations").insert({
        employee_id: employeeId,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-vacations-summary"] });
      toast.success("Vacaciones registradas correctamente");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setActiveTab("status");
    },
    onError: (error: Error) => {
      toast.error(`Error al registrar: ${error.message}`);
    },
  });

  // Delete vacation mutation
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
      toast.success("Registro eliminado");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Por favor complete las fechas");
      return;
    }
    if (endDate < startDate) {
      toast.error("La fecha de fin debe ser posterior a la fecha de inicio");
      return;
    }
    addVacationMutation.mutate();
  };

  const getStatusBadge = () => {
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="text-sm">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Vencido por {Math.abs(daysUntilVacation)} días
        </Badge>
      );
    }
    if (isDueSoon) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-sm">
          <Clock className="h-3 w-3 mr-1" />
          Próximo en {daysUntilVacation} días
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 text-sm">
        <CheckCircle className="h-3 w-3 mr-1" />
        {daysUntilVacation} días restantes
      </Badge>
    );
  };

  const calculateVacationDays = (start: string, end: string) => {
    return differenceInDays(parseISO(end), parseISO(start)) + 1;
  };

  if (!employeeId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Umbrella className="h-5 w-5" />
            Vacaciones - {employeeName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Estado</TabsTrigger>
            <TabsTrigger value="add" disabled={!canModifySettings}>
              Registrar
            </TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Estado de Vacaciones</span>
                  {getStatusBadge()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha de Ingreso</span>
                  <span className="font-medium">
                    {format(parseISO(dateOfHire), "d MMM yyyy", { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última Vacación</span>
                  <span className="font-medium">
                    {lastVacation
                      ? format(parseISO(lastVacation.end_date), "d MMM yyyy", { locale: es })
                      : "Sin registro"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base para Cálculo</span>
                  <span className="font-medium">
                    {lastVacation ? "Última vacación" : "Fecha de ingreso"}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-muted-foreground font-medium">Próximas Vacaciones</span>
                  <span
                    className={`font-bold ${
                      isOverdue
                        ? "text-destructive"
                        : isDueSoon
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {format(nextVacationDue, "d MMM yyyy", { locale: es })}
                  </span>
                </div>
                {isOverdue && (
                  <div className="mt-3 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Las vacaciones están vencidas por {Math.abs(daysUntilVacation)} días.
                    Registre las vacaciones tomadas para actualizar el contador.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Tab */}
          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Vacaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Fecha de Inicio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Fecha de Fin</Label>
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
                      Duración: {calculateVacationDays(startDate, endDate)} días
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas (opcional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observaciones adicionales..."
                      rows={2}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={addVacationMutation.isPending}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {addVacationMutation.isPending ? "Guardando..." : "Registrar Vacaciones"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Historial de Vacaciones</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : vacationHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No hay registros de vacaciones
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>Días</TableHead>
                        <TableHead>Notas</TableHead>
                        {canModifySettings && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacationHistory.map((vacation) => (
                        <TableRow key={vacation.id}>
                          <TableCell>
                            {format(parseISO(vacation.start_date), "d MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(vacation.end_date), "d MMM yyyy", { locale: es })}
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
