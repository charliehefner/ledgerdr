import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { useAuth } from "@/contexts/AuthContext";
import { fmtDate } from "@/lib/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AccrualRow {
  id: string;
  accrual_date: string;
  reversal_date: string;
  amount: number;
  currency: string;
  description: string;
  reference: string | null;
  status: string;
  accrual_journal_id: string | null;
  reversal_journal_id: string | null;
  expense_account: { account_code: string; account_name: string } | null;
  liability_account: { account_code: string; account_name: string } | null;
}

const statusVariant = (s: string) => {
  switch (s) {
    case "scheduled":
      return "default" as const;
    case "reversed":
      return "secondary" as const;
    case "cancelled":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

const statusLabel = (s: string) =>
  s === "scheduled"
    ? "Programada"
    : s === "reversed"
    ? "Reversada"
    : s === "cancelled"
    ? "Cancelada"
    : s;

export function AccrualsListDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { selectedEntityId } = useEntity();
  const { canWriteSection } = useAuth();
  const canWrite = canWriteSection("accounting");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: accruals = [], isLoading } = useQuery<AccrualRow[]>({
    queryKey: ["accrual_entries", selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("accrual_entries")
        .select(
          `id, accrual_date, reversal_date, amount, currency, description, reference, status,
           accrual_journal_id, reversal_journal_id,
           expense_account:chart_of_accounts!accrual_entries_expense_account_id_fkey(account_code, account_name),
           liability_account:chart_of_accounts!accrual_entries_liability_account_id_fkey(account_code, account_name)`
        )
        .order("accrual_date", { ascending: false });
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any as AccrualRow[];
    },
    enabled: open,
  });

  const handleCancel = async (row: AccrualRow) => {
    if (row.status !== "scheduled") return;
    if (!confirm(`Cancelar acumulación y eliminar borradores asociados?`)) return;
    setCancellingId(row.id);
    try {
      // Delete draft journals (only if not posted). RLS + triggers prevent deleting posted.
      const journalIds = [row.accrual_journal_id, row.reversal_journal_id].filter(
        Boolean
      ) as string[];
      if (journalIds.length) {
        const { error: jErr } = await supabase
          .from("journals")
          .delete()
          .in("id", journalIds)
          .eq("posted", false);
        if (jErr) throw jErr;
      }
      const { error } = await supabase
        .from("accrual_entries")
        .update({ status: "cancelled" })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Acumulación cancelada");
      qc.invalidateQueries({ queryKey: ["accrual_entries"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cancelar (¿asiento ya posteado?)");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acumulaciones (reverso automático)</DialogTitle>
          <DialogDescription>
            Listado de gastos acumulados con sus asientos de reverso programados.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
        ) : accruals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay acumulaciones"
            description="Cree una nueva acumulación desde el botón 'Acumulación' del libro mayor."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Reverso</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Gasto (DR)</TableHead>
                <TableHead>Pasivo (CR)</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                {canWrite && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accruals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {fmtDate(new Date(r.accrual_date))}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {fmtDate(new Date(r.reversal_date))}
                  </TableCell>
                  <TableCell className="text-xs">{r.reference || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate">
                    {r.description}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.expense_account
                      ? `${r.expense_account.account_code} ${r.expense_account.account_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.liability_account
                      ? `${r.liability_account.account_code} ${r.liability_account.account_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {Number(r.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {r.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>
                      {statusLabel(r.status)}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      {r.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cancellingId === r.id}
                          onClick={() => handleCancel(r)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
