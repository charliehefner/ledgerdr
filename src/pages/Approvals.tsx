import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface PendingApproval {
  request_id: string;
  applies_to: string;
  record_id: string;
  description: string;
  amount: number;
  currency: string;
  submitted_by: string;
  submitted_at: string;
  entity_name: string;
}

export default function Approvals() {
  const { selectedEntityId } = useEntity();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "approve" | "reject";
    requestId: string;
    description: string;
  }>({ open: false, action: "approve", requestId: "", description: "" });
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: pendingItems = [], isLoading } = useQuery({
    queryKey: ["pending-approvals", selectedEntityId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "get_pending_approvals",
        { p_entity_id: selectedEntityId || null }
      );
      if (error) throw error;
      return (data || []) as PendingApproval[];
    },
    refetchInterval: 30000, // Poll every 30s
  });

  const openAction = (
    action: "approve" | "reject",
    requestId: string,
    description: string
  ) => {
    setNote("");
    setActionDialog({ open: true, action, requestId, description });
  };

  const handleAction = async () => {
    setProcessing(true);
    try {
      const rpcName =
        actionDialog.action === "approve"
          ? "approve_request"
          : "reject_request";
      const { error } = await (supabase.rpc as any)(rpcName, {
        p_request_id: actionDialog.requestId,
        p_note: note || null,
      });
      if (error) throw error;
      toast.success(
        actionDialog.action === "approve"
          ? "Solicitud aprobada"
          : "Solicitud rechazada"
      );
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approval-count"] });
      setActionDialog((d) => ({ ...d, open: false }));
    } catch (err: any) {
      toast.error("Error: " + (err.message || "No se pudo procesar"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="flex items-center gap-3 rounded-lg border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aprobaciones</h1>
            <p className="text-muted-foreground">
              Revise y apruebe transacciones y asientos pendientes
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Solicitudes Pendientes
              {pendingItems.length > 0 && (
                <Badge variant="destructive">{pendingItems.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : pendingItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-12"
                      >
                        <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        No hay aprobaciones pendientes
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingItems.map((item) => (
                      <TableRow key={item.request_id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">
                          {formatDate(item.submitted_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.applies_to === "transaction"
                              ? "Transacción"
                              : "Asiento"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">
                          {item.description || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(item.amount, item.currency || "DOP")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.submitted_by || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.entity_name || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() =>
                                openAction(
                                  "approve",
                                  item.request_id,
                                  item.description
                                )
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() =>
                                openAction(
                                  "reject",
                                  item.request_id,
                                  item.description
                                )
                              }
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approve / Reject Dialog */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "approve"
                ? "Aprobar Solicitud"
                : "Rechazar Solicitud"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {actionDialog.description}
            </p>
            <div className="space-y-2">
              <Label>Nota de revisión (opcional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Agregar comentario..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog((d) => ({ ...d, open: false }))}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              variant={
                actionDialog.action === "approve" ? "default" : "destructive"
              }
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionDialog.action === "approve" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
