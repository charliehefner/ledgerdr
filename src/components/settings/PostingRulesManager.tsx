import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, PowerOff, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAccounts, fetchProjects, fetchCbsCodes } from "@/lib/api";
import { getDescription } from "@/lib/getDescription";
import { useEntity } from "@/contexts/EntityContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface RuleConditions {
  vendor_regex?: string;
  description_regex?: string;
  ncf_prefix?: string[];          // e.g. ["B11","B14"]
  amount_min?: number | null;
  amount_max?: number | null;
  currency?: string[];
  transaction_type?: string[];
}

interface RuleActions {
  master_account_code?: string;
  credit_account_code?: string;
  project_code?: string;
  cbs_code?: string;
  cost_center?: "general" | "agricultural" | "industrial";
  append_note?: string;
}

interface PostingRule {
  id: string;
  entity_id: string | null;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  conditions: RuleConditions;
  actions: RuleActions;
  applies_to: "transaction_entry" | "bank_quick_entry" | "both";
}

const emptyForm = {
  name: "",
  description: "",
  priority: 100,
  is_active: true,
  applies_to: "both" as PostingRule["applies_to"],
  scope: "global" as "global" | "entity",
  // conditions
  vendor_regex: "",
  description_regex: "",
  ncf_prefix: "",                   // comma-separated input
  amount_min: "",
  amount_max: "",
  currency: [] as string[],
  transaction_type: [] as string[],
  // actions
  master_account_code: "",
  credit_account_code: "",
  project_code: "",
  cbs_code: "",
  cost_center: "" as "" | "general" | "agricultural" | "industrial",
  append_note: "",
};

// Action fields used for conflict detection (in display order).
const ACTION_FIELD_LABELS: Record<keyof RuleActions, string> = {
  master_account_code: "Cuenta de débito",
  credit_account_code: "Cuenta de crédito",
  project_code: "Proyecto",
  cbs_code: "CBS",
  cost_center: "Centro de costo",
  append_note: "Nota",
};

export function PostingRulesManager() {
  const queryClient = useQueryClient();
  const { selectedEntityId } = useEntity();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PostingRule | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["postingRules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posting_rules" as any)
        .select("*")
        .order("entity_id", { ascending: true, nullsFirst: true })
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PostingRule[];
    },
  });

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: cbsCodes = [] } = useQuery({ queryKey: ["cbsCodes"], queryFn: fetchCbsCodes });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (rule: PostingRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      description: rule.description || "",
      priority: rule.priority,
      is_active: rule.is_active,
      applies_to: rule.applies_to,
      scope: rule.entity_id ? "entity" : "global",
      vendor_regex: rule.conditions?.vendor_regex || "",
      description_regex: rule.conditions?.description_regex || "",
      ncf_prefix: (rule.conditions?.ncf_prefix || []).join(", "),
      amount_min: rule.conditions?.amount_min != null ? String(rule.conditions.amount_min) : "",
      amount_max: rule.conditions?.amount_max != null ? String(rule.conditions.amount_max) : "",
      currency: rule.conditions?.currency || [],
      transaction_type: rule.conditions?.transaction_type || [],
      master_account_code: rule.actions?.master_account_code || "",
      credit_account_code: rule.actions?.credit_account_code || "",
      project_code: rule.actions?.project_code || "",
      cbs_code: rule.actions?.cbs_code || "",
      cost_center: (rule.actions?.cost_center as any) || "",
      append_note: rule.actions?.append_note || "",
    });
    setDialogOpen(true);
  };

  const validateRegex = (pattern: string): string | null => {
    if (!pattern.trim()) return null;
    try {
      // eslint-disable-next-line no-new
      new RegExp(pattern, "i");
      return null;
    } catch (e: any) {
      return e?.message || "Patrón inválido";
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    const vErr = validateRegex(form.vendor_regex);
    const dErr = validateRegex(form.description_regex);
    if (vErr) { toast.error(`Regex de proveedor inválido: ${vErr}`); return; }
    if (dErr) { toast.error(`Regex de descripción inválido: ${dErr}`); return; }

    // Must have at least one condition AND one action, otherwise it would match everything / do nothing
    const conditions: RuleConditions = {};
    if (form.vendor_regex.trim()) conditions.vendor_regex = form.vendor_regex.trim();
    if (form.description_regex.trim()) conditions.description_regex = form.description_regex.trim();
    if (form.ncf_prefix.trim()) {
      conditions.ncf_prefix = form.ncf_prefix.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    }
    if (form.amount_min !== "") conditions.amount_min = Number(form.amount_min);
    if (form.amount_max !== "") conditions.amount_max = Number(form.amount_max);
    if (form.currency.length) conditions.currency = form.currency;
    if (form.transaction_type.length) conditions.transaction_type = form.transaction_type;

    const actions: RuleActions = {};
    if (form.master_account_code) actions.master_account_code = form.master_account_code;
    if (form.credit_account_code) actions.credit_account_code = form.credit_account_code;
    if (form.project_code) actions.project_code = form.project_code;
    if (form.cbs_code) actions.cbs_code = form.cbs_code;
    if (form.cost_center) actions.cost_center = form.cost_center as any;
    if (form.append_note.trim()) actions.append_note = form.append_note.trim();

    if (Object.keys(conditions).length === 0) {
      toast.error("Define al menos una condición (sino la regla coincidiría con todo)");
      return;
    }
    if (Object.keys(actions).length === 0) {
      toast.error("Define al menos una acción (sino la regla no haría nada)");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priority: Number(form.priority) || 100,
      is_active: form.is_active,
      applies_to: form.applies_to,
      entity_id: form.scope === "entity" ? selectedEntityId : null,
      conditions: conditions as any,
      actions: actions as any,
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from("posting_rules" as any)
          .update(payload as any)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Regla actualizada");
      } else {
        const { error } = await supabase
          .from("posting_rules" as any)
          .insert(payload as any);
        if (error) throw error;
        toast.success("Regla creada");
      }
      queryClient.invalidateQueries({ queryKey: ["postingRules"] });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    const { error } = await supabase.from("posting_rules" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Regla eliminada");
    queryClient.invalidateQueries({ queryKey: ["postingRules"] });
  };

  const handleToggleActive = async (rule: PostingRule) => {
    const { error } = await supabase
      .from("posting_rules" as any)
      .update({ is_active: !rule.is_active } as any)
      .eq("id", rule.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["postingRules"] });
  };

  const conditionsSummary = (c: RuleConditions): string => {
    const parts: string[] = [];
    if (c.vendor_regex) parts.push(`vendor ~ /${c.vendor_regex}/i`);
    if (c.description_regex) parts.push(`desc ~ /${c.description_regex}/i`);
    if (c.ncf_prefix?.length) parts.push(`NCF: ${c.ncf_prefix.join("|")}`);
    if (c.amount_min != null) parts.push(`≥ ${c.amount_min}`);
    if (c.amount_max != null) parts.push(`≤ ${c.amount_max}`);
    if (c.currency?.length) parts.push(c.currency.join("/"));
    if (c.transaction_type?.length) parts.push(c.transaction_type.join("/"));
    return parts.length ? parts.join(" · ") : "—";
  };

  const actionsSummary = (a: RuleActions): string => {
    const parts: string[] = [];
    if (a.master_account_code) parts.push(`Db ${a.master_account_code}`);
    if (a.credit_account_code) parts.push(`Cr ${a.credit_account_code}`);
    if (a.project_code) parts.push(`Proy ${a.project_code}`);
    if (a.cbs_code) parts.push(`CBS ${a.cbs_code}`);
    if (a.cost_center) parts.push(`CC ${a.cost_center}`);
    if (a.append_note) parts.push(`Nota`);
    return parts.length ? parts.join(" · ") : "—";
  };

  const accountLabel = (code: string) => {
    const acct = accounts.find((a: any) => a.code === code);
    return acct ? `${code} - ${getDescription(acct)}` : code;
  };

  const toggleCurrency = (cur: string) => {
    setForm(f => ({
      ...f,
      currency: f.currency.includes(cur) ? f.currency.filter(c => c !== cur) : [...f.currency, cur],
    }));
  };
  const toggleType = (typ: string) => {
    setForm(f => ({
      ...f,
      transaction_type: f.transaction_type.includes(typ) ? f.transaction_type.filter(c => c !== typ) : [...f.transaction_type, typ],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reglas de Contabilización</h3>
          <p className="text-sm text-muted-foreground">
            Auto-completar cuenta, proyecto, CBS y centro de costo en transacciones según condiciones (vendedor, descripción, NCF, monto). Las reglas se aplican silenciosamente — el usuario puede editar cualquier campo.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Regla
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Prio</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Alcance</TableHead>
              <TableHead>Condiciones</TableHead>
              <TableHead>Acciones</TableHead>
              <TableHead className="w-[80px]">Estado</TableHead>
              <TableHead className="w-[120px]">Opciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : rules.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay reglas configuradas.</TableCell></TableRow>
            ) : (
              rules.map(rule => (
                <TableRow key={rule.id} className={rule.is_active ? "" : "opacity-50"}>
                  <TableCell className="font-mono text-xs">{rule.priority}</TableCell>
                  <TableCell className="font-medium">
                    {rule.name}
                    {rule.description && (
                      <div className="text-xs text-muted-foreground font-normal">{rule.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.entity_id ? "secondary" : "outline"}>
                      {rule.entity_id ? "Entidad" : "Global"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{conditionsSummary(rule.conditions || {})}</TableCell>
                  <TableCell className="text-xs">{actionsSummary(rule.actions || {})}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(rule)}
                      title={rule.is_active ? "Desactivar" : "Activar"}>
                      {rule.is_active
                        ? <Power className="h-4 w-4 text-emerald-600" />
                        : <PowerOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Regla" : "Nueva Regla de Contabilización"}</DialogTitle>
            <DialogDescription>
              Define condiciones para identificar la transacción y acciones para auto-completar campos.
              Si más de una regla coincide, la de menor prioridad numérica gana por campo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            {/* === Metadata === */}
            <div className="col-span-2 grid grid-cols-4 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: EDESUR → 6210 Electricidad" />
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Input type="number" value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) || 100 }))} />
              </div>
              <div className="space-y-2">
                <Label>Alcance</Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="global">Global (todas las entidades)</SelectItem>
                    <SelectItem value="entity" disabled={!selectedEntityId}>Solo entidad activa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Descripción (opcional)</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Aplica a</Label>
                <Select value={form.applies_to} onValueChange={v => setForm(f => ({ ...f, applies_to: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="both">Transacción + Banco</SelectItem>
                    <SelectItem value="transaction_entry">Solo Transacciones</SelectItem>
                    <SelectItem value="bank_quick_entry">Solo Banco (Quick Entry)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Activa</Label>
              </div>
            </div>

            {/* === Conditions === */}
            <div className="col-span-1 space-y-3 border-r pr-6">
              <h4 className="font-semibold text-sm">Condiciones</h4>
              <p className="text-xs text-muted-foreground">Todas las condiciones presentes deben cumplirse (AND).</p>

              <div className="space-y-2">
                <Label className="text-xs">Vendedor (regex)</Label>
                <Input value={form.vendor_regex}
                  onChange={e => setForm(f => ({ ...f, vendor_regex: e.target.value }))}
                  placeholder="Ej: EDESUR|EDENORTE" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Descripción (regex)</Label>
                <Input value={form.description_regex}
                  onChange={e => setForm(f => ({ ...f, description_regex: e.target.value }))}
                  placeholder="Ej: COMISI[OÓ]N" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Prefijos NCF (separados por coma)</Label>
                <Input value={form.ncf_prefix}
                  onChange={e => setForm(f => ({ ...f, ncf_prefix: e.target.value }))}
                  placeholder="Ej: B11, B14" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Monto mín.</Label>
                  <Input type="number" value={form.amount_min}
                    onChange={e => setForm(f => ({ ...f, amount_min: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Monto máx.</Label>
                  <Input type="number" value={form.amount_max}
                    onChange={e => setForm(f => ({ ...f, amount_max: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Moneda</Label>
                <div className="flex gap-2">
                  {["DOP", "USD", "EUR"].map(cur => (
                    <Button key={cur} size="sm" type="button"
                      variant={form.currency.includes(cur) ? "default" : "outline"}
                      onClick={() => toggleCurrency(cur)}>
                      {cur}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tipo</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: "purchase", l: "Compra" },
                    { v: "sale", l: "Venta" },
                    { v: "payment", l: "Pago/Transf." },
                  ].map(t => (
                    <Button key={t.v} size="sm" type="button"
                      variant={form.transaction_type.includes(t.v) ? "default" : "outline"}
                      onClick={() => toggleType(t.v)}>
                      {t.l}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* === Actions === */}
            <div className="col-span-1 space-y-3">
              <h4 className="font-semibold text-sm">Acciones (auto-completar)</h4>
              <p className="text-xs text-muted-foreground">Solo se aplican a campos vacíos en el formulario.</p>

              <div className="space-y-2">
                <Label className="text-xs">Cuenta principal</Label>
                <Select value={form.master_account_code}
                  onValueChange={v => setForm(f => ({ ...f, master_account_code: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {accounts.map((a: any) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.code} - {getDescription(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Proyecto</Label>
                <Select value={form.project_code}
                  onValueChange={v => setForm(f => ({ ...f, project_code: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {projects.map((p: any) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} - {getDescription(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">CBS</Label>
                <Select value={form.cbs_code}
                  onValueChange={v => setForm(f => ({ ...f, cbs_code: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {cbsCodes.map((c: any) => (
                      <SelectItem key={c.code} value={String(c.code)}>
                        {c.code} - {getDescription(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Centro de costo</Label>
                <Select value={form.cost_center}
                  onValueChange={v => setForm(f => ({ ...f, cost_center: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="agricultural">Agrícola</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Nota a anexar (opcional)</Label>
                <Textarea value={form.append_note} rows={2}
                  onChange={e => setForm(f => ({ ...f, append_note: e.target.value }))}
                  placeholder="Texto agregado al final de la descripción" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Actualizar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Helper hint */}
      {accounts.length > 0 && form.master_account_code && (
        <div className="text-xs text-muted-foreground">
          Cuenta seleccionada: {accountLabel(form.master_account_code)}
        </div>
      )}
    </div>
  );
}
