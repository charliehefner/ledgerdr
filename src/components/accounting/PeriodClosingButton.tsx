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
      // 1. Get trial balance for the period to find revenue/expense accounts
      const { data: tbData, error: tbError } = await supabase.rpc("trial_balance", {
        p_start: startDate,
        p_end: endDate,
      });
      if (tbError) throw tbError;

      // Filter only revenue (3x-8x) and expense (4x-6x) accounts with balances
      const closingAccounts = (tbData || []).filter((row: any) => {
        const prefix = parseInt(row.account_code?.substring(0, 1) || "0");
        return prefix >= 3 && prefix <= 8 && Math.abs(row.balance_base || 0) > 0.005;
      });

      if (closingAccounts.length === 0) {
        throw new Error("No hay cuentas de resultado con saldo para cerrar.");
      }

      // 2. Find the retained earnings account (usually 2601 or similar)
      const { data: reAccounts, error: reError } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .is("deleted_at", null)
        .ilike("account_code", "26%")
        .eq("allow_posting", true)
        .order("account_code")
        .limit(1);
      if (reError) throw reError;

      // Fallback: try 3990 or any equity account
      let retainedEarningsAcct = reAccounts?.[0];
      if (!retainedEarningsAcct) {
        const { data: fallback } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name")
          .is("deleted_at", null)
          .eq("account_type", "equity")
          .eq("allow_posting", true)
          .order("account_code")
          .limit(1);
        retainedEarningsAcct = fallback?.[0];
      }

      if (!retainedEarningsAcct) {
        throw new Error("No se encontró una cuenta de utilidades retenidas (26xx). Por favor cree una en el plan de cuentas.");
      }

      // 3. Build account_id lookup
      const accountCodes = closingAccounts.map((a: any) => a.account_code);
      const { data: coaRecords, error: coaErr } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code")
        .is("deleted_at", null)
        .in("account_code", accountCodes);
      if (coaErr) throw coaErr;

      const codeToId = new Map<string, string>();
      (coaRecords || []).forEach((r: any) => codeToId.set(r.account_code, r.id));

      // 4. Create closing journal as DRAFT
      const { data: journal, error: jError } = await supabase
        .from("journals")
        .insert({
          journal_date: endDate,
          journal_type: "CLJ",
          currency: "DOP",
          description: `Asiento de cierre — ${periodName}`,
          posted: false,
          created_by: user?.id,
          period_id: periodId,
        })
        .select("id")
        .single();
      if (jError) throw jError;

      // 5. Build lines: reverse each revenue/expense account balance
      let netIncome = 0;
      const lines: any[] = [];

      closingAccounts.forEach((acct: any) => {
        const accountId = codeToId.get(acct.account_code);
        if (!accountId) return;

        const bal = acct.balance_base || 0;
        netIncome += bal;

        // Reverse the balance: if balance is debit (positive), credit it; vice versa
        lines.push({
          journal_id: journal.id,
          account_id: accountId,
          debit: bal < 0 ? Math.abs(bal) : 0,
          credit: bal > 0 ? bal : 0,
        });
      });

      // Add retained earnings line for the net
      lines.push({
        journal_id: journal.id,
        account_id: retainedEarningsAcct.id,
        debit: netIncome > 0 ? netIncome : 0,
        credit: netIncome < 0 ? Math.abs(netIncome) : 0,
      });

      const { error: linesError } = await supabase
        .from("journal_lines")
        .insert(lines);
      if (linesError) throw linesError;

      return { journalId: journal.id, lineCount: lines.length };
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
