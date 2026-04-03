import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardCheck, Play, X, CheckCircle, History, Loader2, AlertTriangle, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function PhysicalCountView() {
  const { selectedEntityId } = useEntity();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("active");
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcileNotes, setReconcileNotes] = useState("");
  const [reconcileResult, setReconcileResult] = useState<any[] | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  const canManage = user?.role === "admin" || user?.role === "management";

  // Query open session
  const { data: openSession, isLoading: sessionLoading } = useQuery({
    queryKey: ["stock-count-open-session", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const { data, error } = await supabase
        .from("stock_count_sessions")
        .select("*")
        .eq("entity_id", selectedEntityId)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEntityId,
  });

  // Query count lines for open session
  const { data: countLines, isLoading: linesLoading } = useQuery({
    queryKey: ["stock-count-lines", openSession?.id],
    queryFn: async () => {
      if (!openSession?.id) return [];
      const { data, error } = await supabase
        .from("stock_count_lines")
        .select("*, inventory_items:inventory_items!stock_count_lines_inventory_item_id_fkey(commercial_name)")
        .eq("session_id", openSession.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!openSession?.id,
  });

  // Past sessions
  const { data: pastSessions, isLoading: historyLoading } = useQuery({
    queryKey: ["stock-count-history", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return [];
      const { data, error } = await supabase
        .from("stock_count_sessions")
        .select("*")
        .eq("entity_id", selectedEntityId)
        .neq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEntityId,
  });

  // Detail lines for history view
  const { data: detailLines } = useQuery({
    queryKey: ["stock-count-detail-lines", detailSessionId],
    queryFn: async () => {
      if (!detailSessionId) return [];
      const { data, error } = await supabase
        .from("stock_count_lines")
        .select("*, inventory_items:inventory_items!stock_count_lines_inventory_item_id_fkey(commercial_name)")
        .eq("session_id", detailSessionId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!detailSessionId,
  });

  // Begin count
  const beginMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("begin_stock_count", {
        p_entity_id: selectedEntityId!,
        p_session_name: sessionName,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Conteo físico iniciado");
      setStartDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stock-count-open-session"] });
      queryClient.invalidateQueries({ queryKey: ["stock-count-lines"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al iniciar conteo");
    },
  });

  // Cancel count
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_stock_count", {
        p_session_id: openSession!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteo cancelado");
      setCancelConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stock-count-open-session"] });
      queryClient.invalidateQueries({ queryKey: ["stock-count-history"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al cancelar");
    },
  });

  // Reconcile count
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reconcile_stock_count", {
        p_session_id: openSession!.id,
        p_notes: reconcileNotes || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      setReconcileResult(result as any);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al reconciliar");
    },
  });

  // Save counted quantity on blur
  const handleCountedBlur = useCallback(async (lineId: string, value: string) => {
    const numVal = value === "" ? null : parseFloat(value);
    const { error } = await supabase
      .from("stock_count_lines")
      .update({ counted_quantity: numVal, counted_at: numVal !== null ? new Date().toISOString() : null })
      .eq("id", lineId);
    if (error) {
      toast.error("Error guardando cantidad");
    } else {
      queryClient.invalidateQueries({ queryKey: ["stock-count-lines", openSession?.id] });
    }
  }, [openSession?.id, queryClient]);

  const handleReconcileConfirm = () => {
    setReconcileResult(null);
    setReconcileDialogOpen(false);
    setReconcileNotes("");
    toast.success("Conteo reconciliado y ajustes aplicados");
    queryClient.invalidateQueries({ queryKey: ["stock-count-open-session"] });
    queryClient.invalidateQueries({ queryKey: ["stock-count-history"] });
    queryClient.invalidateQueries({ queryKey: ["stock-count-lines"] });
  };

  const countedCount = countLines?.filter((l) => l.counted_quantity !== null).length ?? 0;
  const totalCount = countLines?.length ?? 0;
  const allCounted = totalCount > 0 && countedCount === totalCount;
  const progressPct = totalCount > 0 ? (countedCount / totalCount) * 100 : 0;

  if (!selectedEntityId) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Seleccione una entidad para gestionar conteos físicos.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active session banner */}
      {sessionLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : openSession ? (
        <Alert className="border-primary/50 bg-primary/5">
          <ClipboardCheck className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="font-semibold">{openSession.session_name}</span>
                <span className="text-muted-foreground ml-2">
                  · Abierto {format(new Date(openSession.opened_at), "dd/MM/yyyy HH:mm")}
                </span>
                <span className="text-muted-foreground ml-2">
                  · {countedCount} de {totalCount} ítems contados
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setActiveTab("active")}>
                  <Play className="h-3 w-3 mr-1" /> Continuar Conteo
                </Button>
                {canManage && (
                  <Button size="sm" variant="destructive" onClick={() => setCancelConfirmOpen(true)}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : canManage ? (
        <Button onClick={() => { setSessionName(format(new Date(), "yyyy-MM-dd")); setStartDialogOpen(true); }}>
          <ClipboardCheck className="h-4 w-4 mr-2" /> Iniciar Conteo Físico
        </Button>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" disabled={!openSession}>
            <ClipboardCheck className="h-4 w-4 mr-1" />
            Conteo Activo
            {openSession && <Badge variant="secondary" className="ml-2 text-xs">{countedCount}/{totalCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* ─── Active Count Tab ─── */}
        <TabsContent value="active" className="space-y-4">
          {!openSession ? (
            <EmptyState icon={ClipboardCheck} title="Sin conteo activo" description="Inicie un conteo físico para verificar el inventario." />
          ) : linesLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress value={progressPct} className="h-3" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  {countedCount} / {totalCount} ({Math.round(progressPct)}%)
                </span>
                <Button
                  onClick={() => setReconcileDialogOpen(true)}
                  disabled={!allCounted || reconcileMutation.isPending}
                >
                  {reconcileMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Reconciliar
                </Button>
              </div>

              <CountEntryTable lines={countLines ?? []} onBlur={handleCountedBlur} />
            </>
          )}
        </TabsContent>

        {/* ─── History Tab ─── */}
        <TabsContent value="history" className="space-y-4">
          {historyLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !pastSessions?.length ? (
            <EmptyState icon={History} title="Sin historial" description="No hay conteos previos." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{format(new Date(s.opened_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium">{s.session_name}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "reconciled" ? "default" : "destructive"}>
                        {s.status === "reconciled" ? "Reconciliado" : "Cancelado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetailSessionId(s.id)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Start Count Dialog ─── */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar Conteo Físico</DialogTitle>
            <DialogDescription>Se creará una sesión con la cantidad del sistema como referencia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Nombre de sesión</Label>
              <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Conteo mensual..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => beginMutation.mutate()} disabled={beginMutation.isPending || !sessionName.trim()}>
              {beginMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirm ─── */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar conteo?</AlertDialogTitle>
            <AlertDialogDescription>Se perderán todas las cantidades contadas. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, continuar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Sí, cancelar conteo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Reconcile Dialog ─── */}
      <Dialog open={reconcileDialogOpen} onOpenChange={(open) => { if (!open) { setReconcileDialogOpen(false); setReconcileResult(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reconcileResult ? "Resultado de Reconciliación" : "Reconciliar Conteo"}</DialogTitle>
            <DialogDescription>
              {reconcileResult
                ? "Los siguientes ajustes fueron aplicados al inventario."
                : "Se ajustará el inventario según las cantidades contadas. ¿Desea agregar una nota?"}
            </DialogDescription>
          </DialogHeader>

          {reconcileResult ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Sistema</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                    <TableHead className="text-right">Variación</TableHead>
                    <TableHead>Ajustado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reconcileResult as any[]).filter((r: any) => r.variance !== 0).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.item_name}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right">{r.system_qty}</TableCell>
                      <TableCell className="text-right">{r.counted_qty}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.variance > 0 ? "text-green-600" : r.variance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {r.variance > 0 ? "+" : ""}{r.variance}
                      </TableCell>
                      <TableCell>{r.adjusted ? <CheckCircle className="h-4 w-4 text-green-600" /> : "-"}</TableCell>
                    </TableRow>
                  ))}
                  {(reconcileResult as any[]).filter((r: any) => r.variance !== 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        Sin variaciones — todo coincide.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <DialogFooter>
                <Button onClick={handleReconcileConfirm}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div>
                <Label className="text-sm">Notas (opcional)</Label>
                <Input value={reconcileNotes} onChange={(e) => setReconcileNotes(e.target.value)} placeholder="Observaciones..." />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReconcileDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => reconcileMutation.mutate()} disabled={reconcileMutation.isPending}>
                  {reconcileMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar y Reconciliar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Detail Dialog for history ─── */}
      <Dialog open={!!detailSessionId} onOpenChange={(open) => { if (!open) setDetailSessionId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Conteo</DialogTitle>
          </DialogHeader>
          {detailLines && detailLines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Sistema</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Variación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{(l as any).inventory_items?.commercial_name ?? "-"}</TableCell>
                    <TableCell>{l.unit}</TableCell>
                    <TableCell className="text-right">{l.system_quantity}</TableCell>
                    <TableCell className="text-right">{l.counted_quantity ?? "-"}</TableCell>
                    <TableCell className={`text-right font-semibold ${(l.variance ?? 0) > 0 ? "text-green-600" : (l.variance ?? 0) < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {l.variance != null ? ((l.variance > 0 ? "+" : "") + l.variance) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin líneas de conteo.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Extracted count entry table for performance ───
function CountEntryTable({
  lines,
  onBlur,
}: {
  lines: any[];
  onBlur: (lineId: string, value: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ítem</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead className="text-right">Cant. Sistema</TableHead>
          <TableHead className="text-right w-36">Cant. Contada</TableHead>
          <TableHead className="text-right">Variación</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <CountEntryRow key={line.id} line={line} onBlur={onBlur} />
        ))}
      </TableBody>
    </Table>
  );
}

function CountEntryRow({ line, onBlur }: { line: any; onBlur: (lineId: string, value: string) => void }) {
  const [localValue, setLocalValue] = useState(
    line.counted_quantity != null ? String(line.counted_quantity) : ""
  );

  const variance = localValue !== "" ? parseFloat(localValue) - line.system_quantity : null;

  return (
    <TableRow>
      <TableCell className="font-medium">{line.inventory_items?.commercial_name ?? "-"}</TableCell>
      <TableCell>{line.unit}</TableCell>
      <TableCell className="text-right text-muted-foreground">{line.system_quantity}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="any"
          className="w-28 ml-auto text-right h-8"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onBlur(line.id, localValue)}
        />
      </TableCell>
      <TableCell className={`text-right font-semibold ${
        variance === null ? "text-muted-foreground" :
        variance > 0 ? "text-green-600" :
        variance < 0 ? "text-destructive" :
        "text-muted-foreground"
      }`}>
        {variance !== null ? ((variance > 0 ? "+" : "") + variance.toFixed(2)) : "-"}
      </TableCell>
    </TableRow>
  );
}
