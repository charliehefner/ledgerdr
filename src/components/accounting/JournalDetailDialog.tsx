import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2, Lock, Save, CheckCircle, ShieldCheck, ShieldX, CheckCircle2 } from "lucide-react";

type JournalLine = {
  id: string;
  account_id: string;
  debit: number | null;
  credit: number | null;
  cbs_code: string | null;
  project_code: string | null;
  description: string | null;
  chart_of_accounts: { account_code: string; account_name: string } | null;
};

type Journal = {
  id: string;
  journal_number: string | null;
  journal_date: string;
  description: string | null;
  currency: string | null;
  posted: boolean | null;
  posted_by: string | null;
  posted_at: string | null;
  journal_lines: JournalLine[];
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by?: string | null;
  is_reconciled?: boolean | null;
  reference_description?: string | null;
};

type EditableLine = {
  id: string;
  account_id: string;
  debit: string;
  credit: string;
  project_code: string;
  cbs_code: string;
  description: string;
  isNew?: boolean;
};

interface JournalDetailDialogProps {
  journal: Journal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalDetailDialog({ journal, open, onOpenChange }: JournalDetailDialogProps) {
  const { user, canWriteSection } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = canWriteSection("accounting");
  const isDraft = !journal?.posted;
  const isEditable = canWrite && isDraft;
  const isApproved = journal?.approval_status === "approved";
  const canApprove = canWrite && isDraft && journal?.created_by !== user?.id;

  const [description, setDescription] = useState("");
  const [referenceDescription, setReferenceDescription] = useState("");
  const [journalType, setJournalType] = useState("GJ");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart_of_accounts_posting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (journal) {
      setDescription(journal.description || "");
      setReferenceDescription(journal.reference_description || "");
      setJournalType((journal as any).journal_type || "GJ");
      setLines(
        journal.journal_lines.map((l) => ({
          id: l.id,
          account_id: l.account_id,
          debit: l.debit ? String(l.debit) : "",
          credit: l.credit ? String(l.credit) : "",
          project_code: l.project_code || "",
          cbs_code: l.cbs_code || "",
          description: l.description || "",
        }))
      );
    }
  }, [journal]);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [lines]);

  const fmtNum = (n: number) =>
    n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, account_id: "", debit: "", credit: "", project_code: "", cbs_code: "", description: "", isNew: true },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof EditableLine, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: value };
        if (field === "debit" && value) updated.credit = "";
        if (field === "credit" && value) updated.debit = "";
        return updated;
      })
    );
  };

  const handleSave = async () => {
    if (!journal || !isEditable) return;
    if (!totals.balanced) {
      toast({ title: "Error", description: "Débitos y créditos no están balanceados.", variant: "destructive" });
      return;
    }
    if (lines.some((l) => !l.account_id)) {
      toast({ title: "Error", description: "Todas las líneas necesitan una cuenta.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Update journal description, type, and reference
      const { error: jErr } = await supabase
        .from("journals")
        .update({ description, journal_type: journalType, reference_description: referenceDescription || null } as any)
        .eq("id", journal.id);
      if (jErr) throw jErr;

      // Delete existing lines
      const existingIds = journal.journal_lines.map((l) => l.id);
      if (existingIds.length > 0) {
        const { error: delErr } = await supabase
          .from("journal_lines")
          .delete()
          .in("id", existingIds);
        if (delErr) throw delErr;
      }

      // Insert all lines with project_code and cbs_code
      const newLines = lines.map((l) => ({
        journal_id: journal.id,
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        project_code: l.project_code || null,
        cbs_code: l.cbs_code || null,
        description: l.description || null,
      }));
      const { error: insErr } = await supabase.from("journal_lines").insert(newLines);
      if (insErr) throw insErr;

      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: "Guardado", description: "Asiento actualizado correctamente." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!journal || !canWrite) return;
    if (!totals.balanced) {
      toast({ title: "Error", description: "Débitos y créditos no están balanceados.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await handleSave();

      const { error } = await supabase
        .from("journals")
        .update({
          posted: true,
          posted_by: user?.id,
          posted_at: new Date().toISOString(),
        })
        .eq("id", journal.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: "Publicado", description: "Asiento aprobado y publicado." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!journal || !canApprove) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("journals")
        .update({
          approval_status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        } as any)
        .eq("id", journal.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: "Aprobado", description: "Asiento aprobado. Puede ser publicado." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!journal || !canApprove) return;
    const reason = window.prompt("Motivo de rechazo:");
    if (!reason) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("journals")
        .update({
          approval_status: "rejected",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        } as any)
        .eq("id", journal.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: "Rechazado", description: "Asiento rechazado." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!journal || !canWrite) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("journals")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", journal.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: "Eliminado", description: "Asiento eliminado." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!journal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-lg">
              {journal.journal_number || "Sin número"}
            </DialogTitle>
            <Badge variant="secondary">{(journal as any).journal_type || "GJ"}</Badge>
            <Badge variant={journal.posted ? "default" : "outline"}>
              {journal.posted ? "Publicado" : "Borrador"}
            </Badge>
            {!journal.posted && (
              <Badge variant="outline" className={
                journal.approval_status === "approved" ? "bg-green-100 text-green-800 border-green-200" :
                journal.approval_status === "rejected" ? "bg-red-100 text-red-800 border-red-200" :
                "bg-yellow-100 text-yellow-800 border-yellow-200"
              }>
                {journal.approval_status === "approved" ? "Aprobado" : journal.approval_status === "rejected" ? "Rechazado" : "Pendiente"}
              </Badge>
            )}
            {journal.is_reconciled && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conciliado
              </Badge>
            )}
          </div>
          <DialogDescription className="flex gap-4 text-sm">
            <span>{format(new Date(journal.journal_date), "dd/MM/yyyy")}</span>
            <span>{journal.currency || "DOP"}</span>
            {journal.posted && journal.posted_at && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" />
                Publicado el {format(new Date(journal.posted_at), "dd/MM/yyyy HH:mm")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Journal Type (editable for drafts) */}
        {isEditable && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo de Asiento</label>
            <Select value={journalType} onValueChange={setJournalType}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GJ">GJ – General</SelectItem>
                <SelectItem value="PJ">PJ – Compras</SelectItem>
                <SelectItem value="SJ">SJ – Ventas</SelectItem>
                <SelectItem value="PRJ">PRJ – Nómina</SelectItem>
                <SelectItem value="CDJ">CDJ – Desembolsos</SelectItem>
                <SelectItem value="CRJ">CRJ – Recibos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Descripción</label>
          {isEditable ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{description || "—"}</p>
          )}
        </div>

        {/* Reference Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Referencia</label>
          {isEditable ? (
            <Input
              value={referenceDescription}
              onChange={(e) => setReferenceDescription(e.target.value)}
              placeholder="Ej: Factura #001, Cheque #123"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{referenceDescription || "—"}</p>
          )}
        </div>

        {/* Lines Table */}
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Cuenta</th>
                <th className="text-left p-2 font-medium w-[140px]">Descripción</th>
                <th className="text-left p-2 font-medium w-[100px]">Proyecto</th>
                <th className="text-left p-2 font-medium w-[80px]">CBS</th>
                <th className="text-right p-2 font-medium w-[130px]">Débito</th>
                <th className="text-right p-2 font-medium w-[130px]">Crédito</th>
                {isEditable && <th className="w-[40px]" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} className="border-b border-border/30">
                  <td className="p-2">
                    {isEditable ? (
                      <Select
                        value={line.account_id}
                        onValueChange={(v) => updateLine(idx, "account_id", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.account_code} — {a.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="font-mono text-xs">
                        {accounts.find((a) => a.id === line.account_id)?.account_code ||
                          journal.journal_lines[idx]?.chart_of_accounts?.account_code ||
                          "—"}{" "}
                        —{" "}
                        {accounts.find((a) => a.id === line.account_id)?.account_name ||
                          journal.journal_lines[idx]?.chart_of_accounts?.account_name ||
                          ""}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditable ? (
                      <Input
                        className="h-8 text-xs"
                        value={line.project_code}
                        onChange={(e) => updateLine(idx, "project_code", e.target.value)}
                        placeholder="Proyecto"
                      />
                    ) : (
                      <span className="text-xs">{line.project_code || ""}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditable ? (
                      <Input
                        className="h-8 text-xs"
                        value={line.cbs_code}
                        onChange={(e) => updateLine(idx, "cbs_code", e.target.value)}
                        placeholder="CBS"
                      />
                    ) : (
                      <span className="text-xs">{line.cbs_code || ""}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditable ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-right text-xs"
                        value={line.debit}
                        onChange={(e) => updateLine(idx, "debit", e.target.value)}
                      />
                    ) : (
                      <div className="text-right">{line.debit ? fmtNum(parseFloat(line.debit)) : ""}</div>
                    )}
                  </td>
                  <td className="p-2">
                    {isEditable ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-right text-xs"
                        value={line.credit}
                        onChange={(e) => updateLine(idx, "credit", e.target.value)}
                      />
                    ) : (
                      <div className="text-right">{line.credit ? fmtNum(parseFloat(line.credit)) : ""}</div>
                    )}
                  </td>
                  {isEditable && (
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium bg-muted/30">
                <td colSpan={3} className="p-2 text-right">Totales</td>
                <td className={`p-2 text-right ${!totals.balanced ? "text-destructive" : ""}`}>
                  {fmtNum(totals.totalDebit)}
                </td>
                <td className={`p-2 text-right ${!totals.balanced ? "text-destructive" : ""}`}>
                  {fmtNum(totals.totalCredit)}
                </td>
                {isEditable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>

        {!totals.balanced && (
          <p className="text-xs text-destructive">
            Diferencia: {fmtNum(Math.abs(totals.totalDebit - totals.totalCredit))}
          </p>
        )}

        {isEditable && (
          <Button variant="outline" size="sm" onClick={addLine} className="w-fit">
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
          </Button>
        )}

        {/* Approval status info */}
        {journal && !journal.posted && journal.rejection_reason && (
          <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
            Rechazado: {journal.rejection_reason}
          </p>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditable && (
            <>
              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={saving}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar asiento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará el asiento {journal.journal_number || ""}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Save */}
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !totals.balanced}>
                <Save className="h-3.5 w-3.5 mr-1" /> Guardar cambios
              </Button>

              {/* Approve / Reject (maker-checker) */}
              {canApprove && !isApproved && (
                <>
                  <Button size="sm" variant="outline" onClick={handleReject} disabled={saving}>
                    <ShieldX className="h-3.5 w-3.5 mr-1" /> Rechazar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleApprove} disabled={saving || !totals.balanced}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Aprobar
                  </Button>
                </>
              )}

              {/* Post - only if approved */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={saving || !totals.balanced || !isApproved}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Contabilizar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Contabilizar asiento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Una vez contabilizado, el asiento no se podrá modificar. Esta acción es irreversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePost}>Contabilizar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
