import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface ApprovalPolicy {
  id: string;
  entity_id: string | null;
  applies_to: string;
  amount_threshold: number;
  approver_role: string;
  is_active: boolean;
}

interface FormState {
  applies_to: string;
  amount_threshold: string;
  approver_role: string;
}

const emptyForm: FormState = {
  applies_to: "transaction",
  amount_threshold: "",
  approver_role: "management",
};

export function ApprovalThresholdsManager() {
  const { selectedEntityId } = useEntity();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["approval-policies", selectedEntityId],
    queryFn: async () => {
      let query = supabase
        .from("approval_policies" as any)
        .select("*")
        .order("amount_threshold");

      if (selectedEntityId) {
        query = query.or(`entity_id.eq.${selectedEntityId},entity_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ApprovalPolicy[];
    },
  });

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: ApprovalPolicy) => {
    setEditingId(p.id);
    setForm({
      applies_to: p.applies_to,
      amount_threshold: String(p.amount_threshold),
      approver_role: p.approver_role,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const threshold = parseFloat(form.amount_threshold);
    if (isNaN(threshold) || threshold <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await (supabase.from("approval_policies" as any) as any)
          .update({
            applies_to: form.applies_to,
            amount_threshold: threshold,
            approver_role: form.approver_role,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Umbral actualizado");
      } else {
        const { error } = await (supabase.from("approval_policies" as any) as any).insert({
          entity_id: selectedEntityId || null,
          applies_to: form.applies_to,
          amount_threshold: threshold,
          approver_role: form.approver_role,
        });
        if (error) throw error;
        toast.success("Umbral creado");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["approval-policies"] });
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase.from("approval_policies" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Umbral eliminado");
      queryClient.invalidateQueries({ queryKey: ["approval-policies"] });
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("es-DO", { minimumFractionDigits: 2 });

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    management: "Gerencia",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Umbrales de Aprobación</h3>
          <p className="text-sm text-muted-foreground">
            Transacciones que excedan estos montos requerirán aprobación antes
            de ser procesadas.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Umbral
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aplica a</TableHead>
              <TableHead className="text-right">Monto Umbral (DOP)</TableHead>
              <TableHead>Aprobador</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  No hay umbrales configurados. Todas las transacciones se
                  aprobarán automáticamente.
                </TableCell>
              </TableRow>
            ) : (
              policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="capitalize">
                    {p.applies_to === "transaction"
                      ? "Transacción"
                      : p.applies_to === "ap_ar_document"
                      ? "Factura A/P-A/R"
                      : "Asiento contable"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmt(p.amount_threshold)}
                  </TableCell>
                  <TableCell>
                    {roleLabels[p.approver_role] || p.approver_role}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Umbral" : "Nuevo Umbral de Aprobación"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Aplica a</Label>
              <Select
                value={form.applies_to}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, applies_to: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction">Transacciones</SelectItem>
                  <SelectItem value="journal">Asientos Contables</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto Umbral (DOP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount_threshold}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount_threshold: e.target.value }))
                }
                placeholder="50000.00"
              />
              <p className="text-xs text-muted-foreground">
                Transacciones por encima de este monto requerirán aprobación
              </p>
            </div>
            <div className="space-y-2">
              <Label>Rol Aprobador</Label>
              <Select
                value={form.approver_role}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, approver_role: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="management">Gerencia</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
