import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BookCheck, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: string;
}

export function PeriodClosingButton({ periodId, periodName, startDate, endDate, status }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const closingMutation = useMutation({
    mutationFn: async () => {
      const { data: journalId, error } = await supabase.rpc("generate_closing_journal", {
        p_period_id: periodId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: user?.id,
      });
      if (error) throw error;
      return { journalId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({
        title: "Asiento de Cierre Creado",
        description: `Se creó un asiento borrador (CLJ) con ${result.lineCount} líneas. Revíselo y publíquelo cuando esté listo.`,
      });
      setConfirmOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Only show for open/closed periods
  if (status === "reported" || status === "locked") return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={closingMutation.isPending}
      >
        {closingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookCheck className="h-4 w-4 mr-1" />}
        Generar Cierre
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar Asiento de Cierre</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará un asiento de cierre <strong>borrador</strong> para el período "{periodName}" ({startDate} — {endDate}).
              Las cuentas de resultado (ingresos y gastos) se cerrarán contra utilidades retenidas.
              Puede revisar y modificar el asiento antes de publicarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => closingMutation.mutate()}>
              Generar Borrador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
