import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Network } from "lucide-react";

interface EntityGroup {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

interface GroupForm {
  name: string;
  code: string;
}

const emptyForm: GroupForm = { name: "", code: "" };

export function EntityGroupsManager() {
  const [groups, setGroups] = useState<EntityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GroupForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});

  const fetchGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entity_groups")
      .select("id, name, code, created_at")
      .order("code");
    if (error) {
      toast.error("Error cargando grupos");
      console.error(error);
    } else {
      setGroups(data || []);
      // Count entities per group
      const counts: Record<string, number> = {};
      for (const g of data || []) {
        const { count } = await supabase
          .from("entities")
          .select("id", { count: "exact", head: true })
          .eq("entity_group_id", g.id);
        counts[g.id] = count || 0;
      }
      setEntityCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (g: EntityGroup) => {
    setEditingId(g.id);
    setForm({ name: g.name, code: g.code });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Nombre y código son requeridos");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("entity_groups")
          .update({ name: form.name.trim() })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Grupo actualizado");
      } else {
        const { error } = await supabase.from("entity_groups").insert({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
        });
        if (error) {
          if (error.code === "23505") {
            toast.error("El código ya existe. Use un código único.");
            return;
          }
          throw error;
        }
        toast.success("Grupo creado");
      }
      setDialogOpen(false);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Grupos de Entidades</h3>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Agrupe entidades para compartir cuentas bancarias y generar asientos intercompañía automáticos.
        Las entidades sin grupo permanecen independientes.
      </p>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Entidades</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No hay grupos creados. Las entidades funcionan de manera independiente.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono font-medium">{g.code}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{entityCounts[g.id] || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
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
            <DialogTitle>{editingId ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="JORD Holdings"
              />
            </div>
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="JORD"
                disabled={!!editingId}
                className="font-mono"
              />
              {!editingId && (
                <p className="text-xs text-muted-foreground">
                  Identificador único corto. No se puede cambiar después.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
