import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, FileText, ArrowLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplierId: string | null;
  supplierName: string;
}

interface Contract {
  id: string;
  contract_number: string | null;
  description: string;
  total_amount: number;
  currency: string;
  default_account_code: string;
  cost_center: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
}

interface AccountRow {
  account_code: string;
  account_name: string;
  spanish_description: string | null;
  account_type: string;
}

const emptyForm = {
  contract_number: "",
  description: "",
  total_amount: "",
  currency: "DOP",
  default_account_code: "",
  cost_center: "general",
  start_date: "",
  end_date: "",
  status: "active",
  notes: "",
};

export function SupplierContractsDialog({ open, onOpenChange, supplierId, supplierName }: Props) {
  const { selectedEntityId, requireEntity } = useEntity();
  const { user } = useAuth();
  const role = user?.role;
  const canWrite = role === "admin" || role === "management" || role === "accountant" || role === "supervisor";
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Contract | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["supplier-contracts", supplierId, selectedEntityId],
    enabled: !!supplierId && open,
    queryFn: async () => {
      let q = supabase.from("supplier_contracts" as any)
        .select("*").eq("supplier_id", supplierId!).order("created_at", { ascending: false }) as any;
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Contract[];
    },
  });

  // Balances
  const { data: balances = {} } = useQuery({
    queryKey: ["supplier-contract-balances", contracts.map(c => c.id).join(",")],
    enabled: contracts.length > 0,
    queryFn: async () => {
      const out: Record<string, { advanced: number; available: number }> = {};
      for (const c of contracts) {
        const { data, error } = await supabase.rpc("get_contract_balance" as any, { p_contract_id: c.id });
        if (!error && data && Array.isArray(data) && data[0]) {
          out[c.id] = {
            advanced: Number((data[0] as any).advanced_to_date || 0),
            available: Number((data[0] as any).available || 0),
          };
        }
      }
      return out;
    },
  });

  // Eligible accounts: expense (5xxx, 6xxx, 7xxx) + project assets (16xx CIP)
  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts-contract-eligible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("account_code, account_name, spanish_description, account_type")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return (data || []) as AccountRow[];
    },
  });

  const eligibleAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const c = a.account_code;
      // expenses: 4xxx-7xxx, project asset: 16xx (CIP), other long-term: 17xx
      return /^[4567]/.test(c) || /^16/.test(c) || /^17/.test(c);
    });
  }, [accounts]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Suplidor requerido");
      const eid = requireEntity();
      if (!eid) throw new Error("Seleccione una entidad");
      if (!form.description.trim()) throw new Error("Descripción requerida");
      const total = parseFloat(form.total_amount);
      if (!(total > 0)) throw new Error("Monto total inválido");
      if (!form.default_account_code) throw new Error("Cuenta por defecto requerida");

      const payload: Record<string, any> = {
        contract_number: form.contract_number.trim() || null,
        description: form.description.trim(),
        total_amount: total,
        currency: form.currency,
        default_account_code: form.default_account_code,
        cost_center: form.cost_center,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("supplier_contracts" as any)
          .update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.entity_id = eid;
        payload.supplier_id = supplierId;
        payload.created_by = user?.id || null;
        const { error } = await supabase.from("supplier_contracts" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-contracts-active"] });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Contrato actualizado" : "Contrato registrado");
    },
    onError: (e: any) => toast.error(e?.message || "Error"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({
      contract_number: c.contract_number || "",
      description: c.description,
      total_amount: String(c.total_amount),
      currency: c.currency,
      default_account_code: c.default_account_code,
      cost_center: c.cost_center,
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      status: c.status,
      notes: c.notes || "",
    });
    setShowForm(true);
  };

  const fmt = (n: number, cur: string) =>
    `${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contratos · {supplierName}
          </DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-3">
            {canWrite && (
              <div className="flex justify-end">
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nuevo Contrato</Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Anticipado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  {canWrite && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin contratos registrados</TableCell></TableRow>
                ) : contracts.map((c) => {
                  const bal = balances[c.id];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.contract_number || "—"}</TableCell>
                      <TableCell>{c.description}</TableCell>
                      <TableCell className="font-mono text-xs">{c.default_account_code}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(c.total_amount), c.currency)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {bal ? fmt(bal.advanced, c.currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {bal ? fmt(bal.available, c.currency) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {c.status === "active" ? "Activo" : c.status === "draft" ? "Borrador" : c.status === "closed" ? "Cerrado" : "Cancelado"}
                        </Badge>
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />Volver a contratos
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>No. Contrato</Label>
                <Input value={form.contract_number} className="font-mono"
                  onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                  placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="closed">Cerrado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Descripción *</Label>
                <Input value={form.description} autoFocus
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ej. Suministro de fertilizantes ciclo 2026" />
              </div>
              <div className="space-y-2">
                <Label>Monto Total *</Label>
                <Input type="number" step="0.01" value={form.total_amount} className="font-mono"
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Moneda *</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Cuenta por Defecto * (gasto o proyecto)</Label>
                <Select value={form.default_account_code}
                  onValueChange={(v) => setForm({ ...form, default_account_code: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {eligibleAccounts.map((a) => (
                      <SelectItem key={a.account_code} value={a.account_code}>
                        <span className="font-mono mr-2">{a.account_code}</span>
                        {a.spanish_description || a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de Costo</Label>
                <Select value={form.cost_center} onValueChange={(v) => setForm({ ...form, cost_center: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="agricultural">Agrícola</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div></div>
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <Input type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Notas</Label>
                <Textarea rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
