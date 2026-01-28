import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Banknote, Plus, Trash2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface EmployeeLoan {
  id: string;
  employee_id: string;
  loan_date: string;
  loan_amount: number;
  number_of_payments: number;
  remaining_payments: number;
  payment_amount: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface EmployeeLoansSectionProps {
  employeeId: string;
}

export function EmployeeLoansSection({ employeeId }: EmployeeLoansSectionProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [loanDate, setLoanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loanAmount, setLoanAmount] = useState("");
  const [numberOfPayments, setNumberOfPayments] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch loans for this employee
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["employee-loans", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_loans")
        .select("*")
        .eq("employee_id", employeeId)
        .order("loan_date", { ascending: false });
      if (error) throw error;
      return data as EmployeeLoan[];
    },
    enabled: !!employeeId,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);

  const resetForm = () => {
    setLoanDate(format(new Date(), "yyyy-MM-dd"));
    setLoanAmount("");
    setNumberOfPayments("");
    setNotes("");
  };

  const handleAddLoan = async () => {
    if (!loanAmount || !numberOfPayments) {
      toast.error("Por favor complete todos los campos requeridos");
      return;
    }

    const amount = parseFloat(loanAmount);
    const payments = parseInt(numberOfPayments, 10);

    if (amount <= 0 || payments <= 0) {
      toast.error("El monto y número de pagos deben ser mayores a 0");
      return;
    }

    const paymentAmount = Math.round((amount / payments) * 100) / 100;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("employee_loans").insert({
        employee_id: employeeId,
        loan_date: loanDate,
        loan_amount: amount,
        number_of_payments: payments,
        remaining_payments: payments,
        payment_amount: paymentAmount,
        notes: notes || null,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Préstamo registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["employee-loans", employeeId] });
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error adding loan:", error);
      toast.error("Error al registrar préstamo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLoan = async (loanId: string) => {
    try {
      const { error } = await supabase
        .from("employee_loans")
        .delete()
        .eq("id", loanId);

      if (error) throw error;

      toast.success("Préstamo eliminado");
      queryClient.invalidateQueries({ queryKey: ["employee-loans", employeeId] });
    } catch (error) {
      console.error("Error deleting loan:", error);
      toast.error("Error al eliminar préstamo");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const activeLoans = loans.filter((l) => l.is_active && l.remaining_payments > 0);
  const inactiveLoans = loans.filter((l) => !l.is_active || l.remaining_payments === 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Préstamos</CardTitle>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Préstamo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Préstamo</DialogTitle>
                <DialogDescription>
                  Ingrese los detalles del préstamo. El monto por cuota se calculará automáticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="loan-date">Fecha del Préstamo *</Label>
                    <Input
                      id="loan-date"
                      type="date"
                      value={loanDate}
                      onChange={(e) => setLoanDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loan-amount">Monto (DOP) *</Label>
                    <Input
                      id="loan-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num-payments">Número de Cuotas *</Label>
                    <Input
                      id="num-payments"
                      type="number"
                      min="1"
                      placeholder="Ej: 6"
                      value={numberOfPayments}
                      onChange={(e) => setNumberOfPayments(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto por Cuota</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 font-mono">
                      {loanAmount && numberOfPayments && parseInt(numberOfPayments) > 0
                        ? formatCurrency(parseFloat(loanAmount) / parseInt(numberOfPayments))
                        : "-"}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Motivo del préstamo, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddLoan} disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : "Registrar Préstamo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : loans.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay préstamos registrados.</p>
        ) : (
          <div className="space-y-4">
            {activeLoans.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Préstamos Activos
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Cuota</TableHead>
                        <TableHead className="text-center">Restantes</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeLoans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell>
                            {format(new Date(loan.loan_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(loan.loan_amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-primary font-medium">
                            {formatCurrency(loan.payment_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {loan.remaining_payments}/{loan.number_of_payments}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(loan.payment_amount * loan.remaining_payments)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(loan.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {inactiveLoans.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Préstamos Saldados
                </h4>
                <div className="border rounded-lg overflow-hidden opacity-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Cuota</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveLoans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell>
                            {format(new Date(loan.loan_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(loan.loan_amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(loan.payment_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">Pagado</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(loan.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warning for active loans */}
        {activeLoans.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Total descuento por cuota:{" "}
              <span className="font-semibold">
                {formatCurrency(activeLoans.reduce((sum, l) => sum + l.payment_amount, 0))}
              </span>{" "}
              se aplicará automáticamente en la nómina.
            </p>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar préstamo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el préstamo y su historial de pagos. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirmId && handleDeleteLoan(deleteConfirmId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
