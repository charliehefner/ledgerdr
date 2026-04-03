import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Wand2 } from "lucide-react";
import { EntitySetupWizard } from "./EntitySetupWizard";

interface EntityRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  country_code: string;
  currency: string;
  is_active: boolean;
  rnc: string | null;
  tss_nomina_code: string | null;
}

interface FormState {
  name: string;
  code: string;
  description: string;
  country_code: string;
  currency: string;
  is_active: boolean;
  rnc: string;
  tss_nomina_code: string;
}

const emptyForm: FormState = {
  name: "",
  code: "",
  description: "",
  country_code: "DO",
  currency: "DOP",
  is_active: true,
  rnc: "",
  tss_nomina_code: "001",
};

export function EntitiesManager() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [wizardEntity, setWizardEntity] = useState<EntityRow | null>(null);
  const [entityDataCounts, setEntityDataCounts] = useState<Record<string, number>>({});

  const fetchEntities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entities")
      .select("id, name, code, description, country_code, currency, is_active, rnc, tss_nomina_code")
      .order("code");
    if (error) {
      toast.error("Error loading entities");
      console.error(error);
    } else {
      setEntities(data || []);
      // Check data counts for each entity to determine if wizard button should show
      const counts: Record<string, number> = {};
      for (const ent of data || []) {
        const { count: txCount } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", ent.id);
        const { count: empCount } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", ent.id);
        counts[ent.id] = (txCount || 0) + (empCount || 0);
      }
      setEntityDataCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (e: EntityRow) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      code: e.code,
      description: e.description || "",
      country_code: e.country_code,
      currency: e.currency,
      is_active: e.is_active,
      rnc: e.rnc || "",
      tss_nomina_code: e.tss_nomina_code || "001",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Nombre y Código son requeridos");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("entities")
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null,
            is_active: form.is_active,
            rnc: form.rnc.trim() || null,
            tss_nomina_code: form.tss_nomina_code.trim() || "001",
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Entidad actualizada");
        setDialogOpen(false);
        fetchEntities();
      } else {
        const { data: inserted, error } = await supabase.from("entities").insert({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || null,
          country_code: form.country_code.trim() || "DO",
          currency: form.currency.trim() || "DOP",
          rnc: form.rnc.trim() || null,
        }).select().single();
        if (error) {
          if (error.code === "23505") {
            toast.error("El código ya existe. Use un código único.");
          } else {
            throw error;
          }
          return;
        }
        toast.success("Entidad creada");
        setDialogOpen(false);
        await fetchEntities();
        if (inserted) {
          setWizardEntity(inserted as EntityRow);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Entidades</h3>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Entidad
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>RNC</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : entities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay entidades
                </TableCell>
              </TableRow>
            ) : (
              entities.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono font-medium">{e.code}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  <TableCell className="font-mono text-xs">{e.rnc || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{e.country_code}</TableCell>
                  <TableCell>{e.currency}</TableCell>
                  <TableCell>
                    <Badge variant={e.is_active ? "default" : "secondary"}>
                      {e.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
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
            <DialogTitle>{editingId ? "Editar Entidad" : "Nueva Entidad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mi Empresa S.R.L."
              />
            </div>
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="E2"
                disabled={!!editingId}
                className="font-mono"
              />
              {!editingId && (
                <p className="text-xs text-muted-foreground">Identificador único corto. No se puede cambiar después.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>RNC</Label>
              <Input
                value={form.rnc}
                onChange={(e) => setForm((f) => ({ ...f, rnc: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="9 dígitos"
                maxLength={11}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Requerido para reportes DGII (606, 607, 608)</p>
            </div>
            <div className="space-y-2">
              <Label>Código Nómina TSS</Label>
              <Input
                value={form.tss_nomina_code}
                onChange={(e) => setForm((f) => ({ ...f, tss_nomina_code: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="001"
                maxLength={3}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Código de 3 dígitos asignado por la TSS al empleador</p>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            {!editingId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input
                    value={form.country_code}
                    onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
                    placeholder="DO"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    placeholder="DOP"
                    maxLength={3}
                  />
                </div>
              </div>
            )}
            {editingId && (
              <div className="flex items-center justify-between">
                <Label>Activo</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </div>
            )}
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