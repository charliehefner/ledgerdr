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

type ExtraSplit =
  | { type: "percent"; value: number }
  | { type: "fixed"; value: number }
  | { type: "remainder" };

interface ExtraLine {
  account_code: string;
  side: "debit" | "credit";
  split: ExtraSplit;
  cost_center?: "general" | "agricultural" | "industrial";
  description?: string;
}

interface AmortizeSpec {
  months: number;
  start_date: string;
  expense_account_code?: string;
  prepaid_account_code?: string;
}

interface RuleActions {
  master_account_code?: string;
  credit_account_code?: string;
  project_code?: string;
  cbs_code?: string;
  cost_center?: "general" | "agricultural" | "industrial";
  append_note?: string;
  extra_lines?: ExtraLine[];
  replace_main_debit?: boolean;
  replace_main_credit?: boolean;
  amortize?: AmortizeSpec;
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

const MAX_EXTRA_LINES = 10;

// Form representation of an extra line (string inputs for editor)
type ExtraLineDraft = {
  account_code: string;
  side: "debit" | "credit";
  split_type: "percent" | "fixed" | "remainder";
  split_value: string;        // string in form, parsed on save
  cost_center: "" | "general" | "agricultural" | "industrial";
  description: string;
};

const emptyExtraLine = (): ExtraLineDraft => ({
  account_code: "",
  side: "debit",
  split_type: "percent",
  split_value: "",
  cost_center: "",
  description: "",
});

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
  // extra lines (Phase 2)
  extra_lines: [] as ExtraLineDraft[],
  replace_main_debit: false,
  replace_main_credit: false,
  // amortization (Phase 2.5)
  amortize_enabled: false,
  amortize_months: "12",
  amortize_start_date: "",
  amortize_expense_account_code: "",   // empty = use master
  amortize_prepaid_account_code: "1480",
};

// Action fields used for conflict detection (string-valued only — extras/flags excluded).
type ConflictField = "master_account_code" | "credit_account_code" | "project_code" | "cbs_code" | "cost_center" | "append_note";
const ACTION_FIELD_LABELS: Record<ConflictField, string> = {
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
  const [overrideConflicts, setOverrideConflicts] = useState(false);

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

  /**
   * Conflict detection: another active rule at the same priority with overlapping
   * scope (same entity, or both global) that sets the SAME action field to a
   * DIFFERENT value than the current form. Soft warning only — accountant can override.
   */
  const conflicts = useMemo(() => {
    if (!dialogOpen) return [];
    const formScopeEntity = form.scope === "entity" ? selectedEntityId : null;
    const currentActions: RuleActions = {
      master_account_code: form.master_account_code || undefined,
      credit_account_code: form.credit_account_code || undefined,
      project_code: form.project_code || undefined,
      cbs_code: form.cbs_code || undefined,
      cost_center: (form.cost_center as any) || undefined,
      append_note: form.append_note.trim() || undefined,
    };

    const out: { rule: PostingRule; fields: { field: ConflictField; theirs: string; mine: string }[] }[] = [];
    for (const r of rules) {
      if (!r.is_active) continue;
      if (editing && r.id === editing.id) continue;
      if (r.priority !== Number(form.priority)) continue;
      // Scope overlap: identical entity (both null = both global)
      if ((r.entity_id ?? null) !== (formScopeEntity ?? null)) continue;

      const theirActions = r.actions || {};
      const fieldHits: { field: ConflictField; theirs: string; mine: string }[] = [];
      (Object.keys(ACTION_FIELD_LABELS) as ConflictField[]).forEach(field => {
        const theirs = theirActions[field];
        const mine = currentActions[field];
        if (theirs && mine && String(theirs) !== String(mine)) {
          fieldHits.push({ field, theirs: String(theirs), mine: String(mine) });
        }
      });
      if (fieldHits.length) out.push({ rule: r, fields: fieldHits });
    }
    return out;
  }, [
    dialogOpen, rules, editing, form.priority, form.scope, selectedEntityId,
    form.master_account_code, form.credit_account_code, form.project_code,
    form.cbs_code, form.cost_center, form.append_note,
  ]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setOverrideConflicts(false);
    setDialogOpen(true);
  };

  const openEdit = (rule: PostingRule) => {
    setEditing(rule);
    setOverrideConflicts(false);
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
      extra_lines: (rule.actions?.extra_lines || []).map((l): ExtraLineDraft => ({
        account_code: l.account_code || "",
        side: l.side === "credit" ? "credit" : "debit",
        split_type: l.split?.type || "percent",
        split_value: l.split?.type === "remainder" ? "" : String((l.split as any)?.value ?? ""),
        cost_center: (l.cost_center as any) || "",
        description: l.description || "",
      })),
      replace_main_debit: !!rule.actions?.replace_main_debit,
      replace_main_credit: !!rule.actions?.replace_main_credit,
      amortize_enabled: !!rule.actions?.amortize,
      amortize_months: rule.actions?.amortize?.months != null ? String(rule.actions.amortize.months) : "12",
      amortize_start_date: rule.actions?.amortize?.start_date || "",
      amortize_expense_account_code: rule.actions?.amortize?.expense_account_code || "",
      amortize_prepaid_account_code: rule.actions?.amortize?.prepaid_account_code || "1480",
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

    // Phase 2: validate + serialize extra lines
    if (form.extra_lines.length > MAX_EXTRA_LINES) {
      toast.error(`Máximo ${MAX_EXTRA_LINES} líneas adicionales por regla`);
      return;
    }
    const extras: ExtraLine[] = [];
    let pctDebit = 0, pctCredit = 0, remDebit = 0, remCredit = 0;
    for (let i = 0; i < form.extra_lines.length; i++) {
      const l = form.extra_lines[i];
      if (!l.account_code) {
        toast.error(`Línea adicional #${i + 1}: falta cuenta`);
        return;
      }
      let split: ExtraSplit;
      if (l.split_type === "remainder") {
        split = { type: "remainder" };
        if (l.side === "debit") remDebit++; else remCredit++;
      } else {
        const v = Number(l.split_value);
        if (!Number.isFinite(v) || v <= 0) {
          toast.error(`Línea adicional #${i + 1}: valor inválido`);
          return;
        }
        if (l.split_type === "percent") {
          if (v > 100) {
            toast.error(`Línea adicional #${i + 1}: porcentaje > 100`);
            return;
          }
          if (l.side === "debit") pctDebit += v; else pctCredit += v;
          split = { type: "percent", value: v };
        } else {
          split = { type: "fixed", value: v };
        }
      }
      extras.push({
        account_code: l.account_code,
        side: l.side,
        split,
        ...(l.cost_center ? { cost_center: l.cost_center } : {}),
        ...(l.description.trim() ? { description: l.description.trim() } : {}),
      });
    }
    if (pctDebit > 100) { toast.error(`Suma de % en débito = ${pctDebit} (máx 100)`); return; }
    if (pctCredit > 100) { toast.error(`Suma de % en crédito = ${pctCredit} (máx 100)`); return; }
    if (remDebit > 1) { toast.error("Solo se permite un 'Resto' por lado (débito)"); return; }
    if (remCredit > 1) { toast.error("Solo se permite un 'Resto' por lado (crédito)"); return; }
    if (extras.length > 0) actions.extra_lines = extras;
    if (form.replace_main_debit && extras.some(e => e.side === "debit")) actions.replace_main_debit = true;
    if (form.replace_main_credit && extras.some(e => e.side === "credit")) actions.replace_main_credit = true;

    // Phase 2.5: amortization
    if (form.amortize_enabled) {
      const months = Number(form.amortize_months);
      if (!Number.isInteger(months) || months < 2 || months > 60) {
        toast.error("Amortización: meses debe ser un entero entre 2 y 60");
        return;
      }
      if (!form.amortize_start_date) {
        toast.error("Amortización: fecha de inicio es requerida");
        return;
      }
      const expense = form.amortize_expense_account_code || form.master_account_code;
      const prepaid = form.amortize_prepaid_account_code || "1480";
      if (!expense) {
        toast.error("Amortización: define una cuenta de gasto (o cuenta principal de débito)");
        return;
      }
      if (expense === prepaid) {
        toast.error("Amortización: la cuenta de gasto y la cuenta de prepago deben ser distintas");
        return;
      }
      actions.amortize = {
        months,
        start_date: form.amortize_start_date,
        ...(form.amortize_expense_account_code ? { expense_account_code: form.amortize_expense_account_code } : {}),
        ...(prepaid !== "1480" ? { prepaid_account_code: prepaid } : { prepaid_account_code: "1480" }),
      };
    }

    if (Object.keys(conditions).length === 0) {
      toast.error("Define al menos una condición (sino la regla coincidiría con todo)");
      return;
    }
    if (Object.keys(actions).length === 0) {
      toast.error("Define al menos una acción (sino la regla no haría nada)");
      return;
    }

    // Soft conflict gate — block first attempt, allow override on second click.
    if (conflicts.length > 0 && !overrideConflicts) {
      toast.warning(
        `Conflicto con ${conflicts.length} regla(s) activa(s) en la misma prioridad. Revise el aviso o presione Guardar de nuevo para continuar.`
      );
      setOverrideConflicts(true);
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
    if (a.extra_lines?.length) parts.push(`+${a.extra_lines.length} líneas`);
    if (a.amortize?.months) parts.push(`Amort ${a.amortize.months}×`);
    return parts.length ? parts.join(" · ") : "—";
  };

  // Helpers for the extras editor
  const addExtraLine = () => {
    setForm(f => f.extra_lines.length >= MAX_EXTRA_LINES
      ? f
      : { ...f, extra_lines: [...f.extra_lines, emptyExtraLine()] });
  };
  const updateExtraLine = (idx: number, patch: Partial<ExtraLineDraft>) => {
    setForm(f => ({
      ...f,
      extra_lines: f.extra_lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };
  const removeExtraLine = (idx: number) => {
    setForm(f => ({ ...f, extra_lines: f.extra_lines.filter((_, i) => i !== idx) }));
  };

  // Live validation summary for the extras editor
  const extrasValidation = useMemo(() => {
    let pctD = 0, pctC = 0, remD = 0, remC = 0, hasD = false, hasC = false;
    const errors: string[] = [];
    form.extra_lines.forEach((l, i) => {
      if (l.side === "debit") hasD = true; else hasC = true;
      if (l.split_type === "remainder") {
        if (l.side === "debit") remD++; else remC++;
      } else {
        const v = Number(l.split_value);
        if (l.split_value !== "" && (!Number.isFinite(v) || v <= 0)) {
          errors.push(`Línea ${i + 1}: valor inválido`);
        } else if (l.split_type === "percent") {
          if (l.side === "debit") pctD += v || 0; else pctC += v || 0;
        }
      }
      if (!l.account_code) errors.push(`Línea ${i + 1}: falta cuenta`);
    });
    if (pctD > 100) errors.push(`% débito = ${pctD} (máx 100)`);
    if (pctC > 100) errors.push(`% crédito = ${pctC} (máx 100)`);
    if (remD > 1) errors.push("Más de un 'Resto' en débito");
    if (remC > 1) errors.push("Más de un 'Resto' en crédito");
    return { pctD, pctC, hasD, hasC, errors };
  }, [form.extra_lines]);



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
                <Label className="text-xs">Cuenta de débito</Label>
                <Select value={form.master_account_code}
                  onValueChange={v => setForm(f => ({ ...f, master_account_code: v === "__clear__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    <SelectItem value="__clear__">— Ninguna —</SelectItem>
                    {accounts.map((a: any) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.code} - {getDescription(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Cuenta de crédito (opcional)</Label>
                <Select value={form.credit_account_code}
                  onValueChange={v => setForm(f => ({ ...f, credit_account_code: v === "__clear__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— Auto (banco / CxP / CxC) —" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    <SelectItem value="__clear__">— Auto (banco / CxP / CxC) —</SelectItem>
                    {accounts.map((a: any) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.code} - {getDescription(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Déjelo vacío para usar la cuenta automática según el tipo de transacción y método de pago. Use esto para reclasificaciones o asientos no estándar.
                </p>
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

          {/* === Phase 2: extra journal lines === */}
          <details className="rounded-md border p-3 mt-2">
            <summary className="cursor-pointer font-semibold text-sm flex items-center gap-2">
              Líneas adicionales (avanzado)
              {form.extra_lines.length > 0 && (
                <Badge variant="secondary">{form.extra_lines.length} línea{form.extra_lines.length === 1 ? "" : "s"}</Badge>
              )}
            </summary>
            <div className="pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Agrega líneas extra al asiento generado. Útil para auto-divisiones de centro de costo (ej. 70% Agrícola / 30% Industrial), retenciones automáticas (ej. 1% ISR sobre B11) o recargos por proveedor. Las reglas se aplican al generar el asiento desde la transacción.
              </p>

              {form.extra_lines.length > 0 && (
                <div className="rounded border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[35%]">Cuenta</TableHead>
                        <TableHead className="text-xs">Lado</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs w-[100px]">Valor</TableHead>
                        <TableHead className="text-xs">CC</TableHead>
                        <TableHead className="text-xs">Descripción</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.extra_lines.map((l, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-1">
                            <Select value={l.account_code}
                              onValueChange={v => updateExtraLine(idx, { account_code: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent className="bg-popover max-h-[280px]">
                                {accounts.map((a: any) => (
                                  <SelectItem key={a.code} value={a.code}>
                                    {a.code} - {getDescription(a)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <Select value={l.side}
                              onValueChange={v => updateExtraLine(idx, { side: v as "debit" | "credit" })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-popover">
                                <SelectItem value="debit">Débito</SelectItem>
                                <SelectItem value="credit">Crédito</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <Select value={l.split_type}
                              onValueChange={v => updateExtraLine(idx, { split_type: v as any, split_value: v === "remainder" ? "" : l.split_value })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-popover">
                                <SelectItem value="percent">% del monto</SelectItem>
                                <SelectItem value="fixed">Monto fijo</SelectItem>
                                <SelectItem value="remainder">Resto</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            {l.split_type === "remainder" ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <Input type="number" className="h-8 text-xs"
                                value={l.split_value}
                                onChange={e => updateExtraLine(idx, { split_value: e.target.value })}
                                placeholder={l.split_type === "percent" ? "70" : "0.00"} />
                            )}
                          </TableCell>
                          <TableCell className="p-1">
                            <Select value={l.cost_center || "__none__"}
                              onValueChange={v => updateExtraLine(idx, { cost_center: v === "__none__" ? "" : (v as any) })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-popover">
                                <SelectItem value="__none__">—</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="agricultural">Agrícola</SelectItem>
                                <SelectItem value="industrial">Industrial</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <Input className="h-8 text-xs" value={l.description}
                              onChange={e => updateExtraLine(idx, { description: e.target.value })}
                              placeholder="(opcional)" />
                          </TableCell>
                          <TableCell className="p-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => removeExtraLine(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button type="button" size="sm" variant="outline"
                  onClick={addExtraLine}
                  disabled={form.extra_lines.length >= MAX_EXTRA_LINES}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
                </Button>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.replace_main_debit}
                    onCheckedChange={v => setForm(f => ({ ...f, replace_main_debit: v }))}
                    disabled={!extrasValidation.hasD} />
                  <Label className="text-xs">Reemplazar débito principal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.replace_main_credit}
                    onCheckedChange={v => setForm(f => ({ ...f, replace_main_credit: v }))}
                    disabled={!extrasValidation.hasC} />
                  <Label className="text-xs">Reemplazar crédito principal</Label>
                </div>
              </div>

              {form.extra_lines.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Suma %: débito = <strong>{extrasValidation.pctD}%</strong> · crédito = <strong>{extrasValidation.pctC}%</strong>
                </div>
              )}

              {extrasValidation.errors.length > 0 && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive space-y-1">
                  {extrasValidation.errors.map((err, i) => <div key={i}>· {err}</div>)}
                </div>
              )}

              <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                <div><strong>Ejemplos:</strong></div>
                <div>· <em>División 70/30:</em> dos líneas débito a la misma cuenta, 70% Agrícola + 30% Industrial, marca "Reemplazar débito principal".</div>
                <div>· <em>Retención 1% ISR:</em> una línea crédito a la cuenta 2170 con 1%. No reemplaza nada — se suma al asiento estándar y reduce el crédito al banco.</div>
                <div>· <em>Recargo fijo:</em> una línea con tipo "Monto fijo".</div>
              </div>
            </div>
          </details>

          {/* === Phase 2.5: amortization === */}
          <details className="rounded-md border p-3 mt-2" open={form.amortize_enabled}>
            <summary className="cursor-pointer font-semibold text-sm flex items-center gap-2">
              Amortización (avanzado)
              {form.amortize_enabled && (
                <Badge variant="secondary">{form.amortize_months || "?"} meses</Badge>
              )}
            </summary>
            <div className="pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Distribuye un gasto pagado por adelantado (alquiler, seguros, suscripciones) en N asientos mensuales. La transacción original se contabiliza como <em>DR Pagado por Adelantado / CR Banco</em>; luego se generan N asientos automáticos <em>DR Gasto / CR Pagado por Adelantado</em> empezando en la fecha de inicio. Solo aplica a compras.
              </p>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.amortize_enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, amortize_enabled: v }))} />
                <Label className="text-xs">Habilitar amortización para esta regla</Label>
              </div>

              {form.amortize_enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Meses (2–60)</Label>
                    <Input type="number" min={2} max={60} className="h-8 text-xs"
                      value={form.amortize_months}
                      onChange={e => setForm(f => ({ ...f, amortize_months: e.target.value }))}
                      placeholder="12" />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha de inicio</Label>
                    <Input type="date" className="h-8 text-xs"
                      value={form.amortize_start_date}
                      onChange={e => setForm(f => ({ ...f, amortize_start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Cuenta de gasto</Label>
                    <Select value={form.amortize_expense_account_code || "__master__"}
                      onValueChange={v => setForm(f => ({ ...f, amortize_expense_account_code: v === "__master__" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover max-h-[280px]">
                        <SelectItem value="__master__">— Usar cuenta principal ({form.master_account_code || "no definida"})</SelectItem>
                        {accounts.map((a: any) => (
                          <SelectItem key={a.code} value={a.code}>{a.code} - {getDescription(a)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Cuenta de prepago (activo)</Label>
                    <Select value={form.amortize_prepaid_account_code || "1480"}
                      onValueChange={v => setForm(f => ({ ...f, amortize_prepaid_account_code: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover max-h-[280px]">
                        {accounts.map((a: any) => (
                          <SelectItem key={a.code} value={a.code}>{a.code} - {getDescription(a)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                <div><strong>Ejemplo:</strong> Alquiler 12 meses pagado por adelantado en mayo, servicio inicia 1 julio:</div>
                <div>· Asiento original: <code>DR 1480 Prepago / CR Banco</code> (monto total)</div>
                <div>· 12 asientos mensuales: <code>DR 6310 Alquileres / CR 1480 Prepago</code> (monto/12 cada uno, fecha jul-1, ago-1, …)</div>
                <div className="text-amber-700 dark:text-amber-400">⚠ Si algún mes cae en un período cerrado, la transacción no se procesa.</div>
              </div>
            </div>
          </details>


          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 mt-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                Conflicto detectado con {conflicts.length} regla{conflicts.length === 1 ? "" : "s"} activa{conflicts.length === 1 ? "" : "s"} en la misma prioridad ({form.priority})
              </div>
              <ul className="text-xs space-y-1 ml-6 list-disc">
                {conflicts.map(c => (
                  <li key={c.rule.id}>
                    <span className="font-medium">{c.rule.name}</span>
                    {c.fields.map(f => (
                      <span key={f.field} className="block ml-2 text-muted-foreground">
                        · {ACTION_FIELD_LABELS[f.field]}: esta regla = <code>{f.mine}</code> · existente = <code>{f.theirs}</code>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Sugerencia: cambie la prioridad para que esta regla gane (menor número) o pierda (mayor número), o ajuste los valores. Si igual quiere guardar, presione <strong>Guardar</strong> de nuevo.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} variant={conflicts.length > 0 && overrideConflicts ? "destructive" : "default"}>
              {conflicts.length > 0 && overrideConflicts
                ? "Guardar de todos modos"
                : editing ? "Actualizar" : "Crear"}
            </Button>
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
