import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, UserCheck, UserX, Search, Truck, FileText } from "lucide-react";
import { SupplierContractsDialog } from "./SupplierContractsDialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";

interface Supplier {
  id: string;
  name: string;
  rnc: string | null;
  apodo: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  currency: string | null;
  default_dgii_bs_type: string | null;
  notes: string | null;
  is_active: boolean;
  credit_limit?: number | null;
}

const BANKS = [
  "Popular", "BHD", "Reservas", "Santa Cruz", "Scotiabank",
  "BanReservas", "Banesco", "Asociación Popular", "Otro",
];

const emptyForm = {
  name: "", rnc: "", apodo: "", contact_person: "", phone: "", email: "", address: "",
  bank: "", bank_account_type: "current", bank_account_number: "",
  currency: "DOP", default_dgii_bs_type: "", notes: "",
  credit_limit: "0",
};

export function SuppliersView() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedEntityId, requireEntity } = useEntity();
  const role = user?.role;
  const canWrite = role === "admin" || role === "management" || role === "accountant" || role === "supervisor";

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contractsFor, setContractsFor] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", showInactive, selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("suppliers" as any).select("*").order("name") as any;
      if (!showInactive) q = q.eq("is_active", true);
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Supplier[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (data: typeof emptyForm & { id?: string }) => {
      const payload: Record<string, any> = {
        name: data.name.trim(),
        rnc: data.rnc.trim() || null,
        apodo: data.apodo.trim() || null,
        contact_person: data.contact_person.trim() || null,
        phone: data.phone.trim() || null,
        email: data.email.trim() || null,
        address: data.address.trim() || null,
        bank: data.bank || null,
        bank_account_type: data.bank_account_type || null,
        bank_account_number: data.bank_account_number.trim() || null,
        currency: data.currency || "DOP",
        default_dgii_bs_type: data.default_dgii_bs_type || null,
        notes: data.notes.trim() || null,
        credit_limit: parseFloat(data.credit_limit || "0") || 0,
      };
      if (data.id) {
        const { error } = await supabase.from("suppliers" as any).update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const eid = requireEntity();
        if (!eid) throw new Error("Seleccione una entidad");
        payload.entity_id = eid;
        const { error } = await supabase.from("suppliers" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Suplidor actualizado" : "Suplidor agregado");
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.includes("suppliers_rnc_unique_per_entity")) {
        toast.error("Ya existe un suplidor con este RNC en esta entidad");
      } else toast.error(msg || "Error");
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("suppliers" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
    onError: (e: any) => toast.error(e?.message || "Error"),
  });

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.apodo || "").toLowerCase().includes(q) ||
      (s.rnc || "").includes(search)
    );
  });

  const openDialog = (s?: Supplier) => {
    if (s) {
      setEditing(s);
      setForm({
        name: s.name, rnc: s.rnc || "", apodo: s.apodo || "",
        contact_person: s.contact_person || "", phone: s.phone || "",
        email: s.email || "", address: s.address || "",
        bank: s.bank || "", bank_account_type: s.bank_account_type || "current",
        bank_account_number: s.bank_account_number || "",
        currency: s.currency || "DOP",
        default_dgii_bs_type: s.default_dgii_bs_type || "",
        notes: s.notes || "",
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    saveMut.mutate({ ...form, id: editing?.id });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">Suplidores</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Registro maestro de suplidores para AP, anticipos y compras.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={showInactive ? "secondary" : "outline"} size="sm"
                onClick={() => setShowInactive(!showInactive)}>
                {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
              </Button>
              {canWrite && (
                <Button onClick={() => openDialog()}>
                  <Plus className="h-4 w-4 mr-2" />Nuevo Suplidor
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, apodo o RNC"
          value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Apodo</TableHead>
                <TableHead>RNC</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>B/S</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                {canWrite && <TableHead className="w-32 text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {search ? "Sin resultados" : "No hay suplidores registrados"}
                </TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.apodo || "—"}</TableCell>
                  <TableCell className="font-mono">{s.rnc || "—"}</TableCell>
                  <TableCell>{s.contact_person || "—"}</TableCell>
                  <TableCell>{s.bank || "—"}</TableCell>
                  <TableCell>{s.currency || "DOP"}</TableCell>
                  <TableCell>{s.default_dgii_bs_type || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" title="Contratos" onClick={() => setContractsFor(s)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openDialog(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={s.is_active ? "Desactivar" : "Activar"}
                          onClick={() => toggleMut.mutate({ id: s.id, is_active: !s.is_active })}>
                          {s.is_active ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-primary" />}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Suplidor" : "Nuevo Suplidor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nombre / Razón Social *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="space-y-2">
                <Label>RNC / Cédula</Label>
                <Input value={form.rnc} onChange={(e) => setForm({ ...form, rnc: e.target.value })}
                  placeholder="000000000" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Apodo</Label>
                <Input value={form.apodo} onChange={(e) => setForm({ ...form, apodo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Persona de Contacto</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo Bienes/Servicios (default DGII)</Label>
                <Select value={form.default_dgii_bs_type || "none"}
                  onValueChange={(v) => setForm({ ...form, default_dgii_bs_type: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin definir —</SelectItem>
                    <SelectItem value="B">Bienes</SelectItem>
                    <SelectItem value="S">Servicios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Información Bancaria</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Select value={form.bank || "none"} onValueChange={(v) => setForm({ ...form, bank: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Ninguno —</SelectItem>
                      {BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Cuenta</Label>
                  <Select value={form.bank_account_type}
                    onValueChange={(v) => setForm({ ...form, bank_account_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Ahorros</SelectItem>
                      <SelectItem value="current">Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOP">DOP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>No. de Cuenta</Label>
                  <Input value={form.bank_account_number} className="font-mono"
                    onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierContractsDialog
        open={!!contractsFor}
        onOpenChange={(o) => { if (!o) setContractsFor(null); }}
        supplierId={contractsFor?.id || null}
        supplierName={contractsFor?.name || ""}
      />
    </div>
  );
}
