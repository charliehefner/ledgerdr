import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, HandCoins, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateLocal, fmtDate } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BankAcct {
  id: string;
  account_name: string;
  account_type: string;
  currency: string | null;
}
interface Supplier {
  id: string;
  name: string;
  rnc: string | null;
  apodo: string | null;
  currency: string | null;
}
interface Contract {
  id: string;
  contract_number: string | null;
  description: string;
  total_amount: number;
  currency: string;
  status: string;
}

const initialState = {
  date: undefined as Date | undefined,
  supplier_id: "",
  contract_id: "",
  from_account: "",
  amount: "",
  itbis_retenido: "",
  isr_retenido: "",
  description: "",
};

export function SupplierAdvancesView() {
  const { selectedEntityId } = useEntity();
  const { user } = useAuth();
  const role = user?.role;
  const canOverride = role === "admin" || role === "management" || role === "accountant";
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [retOpen, setRetOpen] = useState(false);
  const [overWarning, setOverWarning] = useState<{ over: number; available: number; total: number; cur: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["supplier-advance-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, account_type, currency")
        .eq("is_active", true)
        .order("account_type, account_name");
      if (error) throw error;
      return (data || []) as BankAcct[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-active", selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("suppliers" as any)
        .select("id, name, rnc, apodo, currency")
        .eq("is_active", true)
        .order("name") as any;
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Supplier[];
    },
  });

  const { data: recent = [], refetch } = useQuery({
    queryKey: ["recent-supplier-advances", selectedEntityId],
    queryFn: async () => {
      let q = supabase
        .from("ap_ar_documents")
        .select("id, document_date, contact_name, contact_rnc, total_amount, balance_remaining, currency, status, supplier_id")
        .eq("direction", "payable")
        .eq("document_type", "advance")
        .order("document_date", { ascending: false })
        .limit(25) as any;
      if (selectedEntityId) q = q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const fromAcct = bankAccounts.find((a) => a.id === form.from_account);
  const fromCur = fromAcct?.currency || "DOP";
  const supplier = suppliers.find((s) => s.id === form.supplier_id);

  const amt = parseFloat(form.amount || "0");
  const itbisRet = parseFloat(form.itbis_retenido || "0");
  const isrRet = parseFloat(form.isr_retenido || "0");
  const netoDesembolsar = Math.max(0, amt - itbisRet - isrRet);

  const isValid = () => {
    if (!form.date || !form.supplier_id || !form.from_account || !form.amount) return false;
    if (amt <= 0) return false;
    if (itbisRet < 0 || isrRet < 0) return false;
    if (itbisRet + isrRet > amt) return false;
    return true;
  };

  const banks = bankAccounts.filter((a) => a.account_type === "bank");
  const cards = bankAccounts.filter((a) => a.account_type === "credit_card");
  const petty = bankAccounts.filter((a) => a.account_type === "petty_cash");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) {
      if (itbisRet + isrRet > amt) toast.error("Las retenciones no pueden superar el monto del anticipo");
      else toast.error("Complete los campos requeridos");
      return;
    }
    setSubmitting(true);
    try {
      const description = form.description?.trim()
        || `Anticipo a ${supplier?.name || "Suplidor"}${supplier?.rnc ? ` (${supplier.rnc})` : ""}`;

      const { data, error } = await supabase.rpc("create_transaction_with_ap_ar" as any, {
        p_transaction_date: formatDateLocal(form.date!),
        p_master_acct_code: "1690",
        p_description: description,
        p_currency: fromCur,
        p_amount: amt,
        p_itbis: 0,
        p_itbis_retenido: itbisRet,
        p_isr_retenido: isrRet,
        p_pay_method: form.from_account,
        p_name: supplier?.name || null,
        p_rnc: supplier?.rnc || null,
        p_is_internal: false,
        p_cost_center: "general",
        p_transaction_direction: "purchase",
        p_entity_id: selectedEntityId || null,
        p_supplier_id: supplier?.id || null,
      });
      if (error) throw error;

      // Patch advance doc to ensure supplier_id link (in case RPC version mismatch)
      const result = data as { id: string } | null;
      if (result?.id && supplier?.id) {
        await supabase
          .from("ap_ar_documents")
          .update({ supplier_id: supplier.id } as any)
          .eq("document_number", String(result.id))
          .eq("document_type", "advance");
      }

      toast.success("Anticipo registrado");
      setForm(initialState);
      setRetOpen(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["existingTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const acctName = (id: string | null | undefined) => {
    if (!id) return "—";
    const a = bankAccounts.find((b) => b.id === id);
    return a ? `${a.account_name} (${a.currency || "DOP"})` : id;
  };

  const renderAccountOptions = () => (
    <>
      {banks.length > 0 && (
        <SelectGroup>
          <SelectLabel className="text-xs font-semibold text-muted-foreground">Bancos</SelectLabel>
          {banks.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.account_name} ({a.currency || "DOP"})
            </SelectItem>
          ))}
        </SelectGroup>
      )}
      {cards.length > 0 && (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-muted-foreground">Tarjetas de Crédito</SelectLabel>
            {cards.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.account_name} ({a.currency || "DOP"})
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      )}
      {petty.length > 0 && (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-muted-foreground">Caja Chica</SelectLabel>
            {petty.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.account_name} ({a.currency || "DOP"})
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary" />
            Nuevo Anticipo a Suplidor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" type="button"
                      className={cn("w-full justify-start text-left font-normal", !form.date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.date ? format(form.date, "PPP") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar mode="single" selected={form.date}
                      onSelect={(d) => setForm((f) => ({ ...f, date: d }))} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Suplidor *</Label>
                <Select value={form.supplier_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[320px]">
                    {suppliers.length === 0 ? (
                      <SelectItem value="__none" disabled>Registre suplidores en Configuración</SelectItem>
                    ) : suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.rnc ? ` — ${s.rnc}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cuenta Origen *</Label>
                <Select value={form.from_account || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, from_account: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {renderAccountOptions()}
                  </SelectContent>
                </Select>
                {fromAcct && <p className="text-xs text-muted-foreground">Moneda: {fromCur}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Monto Anticipo ({fromCur}) *</Label>
                <Input type="number" step="0.01" value={form.amount} className="font-mono"
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-2 md:col-span-2 flex items-end">
                <div className="text-sm">
                  <span className="text-muted-foreground">Neto a desembolsar: </span>
                  <span className="font-mono font-semibold">
                    {netoDesembolsar.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {fromCur}
                  </span>
                </div>
              </div>
            </div>

            <Collapsible open={retOpen} onOpenChange={setRetOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                  {retOpen ? "▾" : "▸"} Retenciones (opcional)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="grid gap-4 md:grid-cols-2 p-3 rounded-md bg-muted/30 border">
                  <div className="space-y-2">
                    <Label>ITBIS Retenido</Label>
                    <Input type="number" step="0.01" value={form.itbis_retenido} className="font-mono"
                      onChange={(e) => setForm((f) => ({ ...f, itbis_retenido: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>ISR Retenido</Label>
                    <Input type="number" step="0.01" value={form.isr_retenido} className="font-mono"
                      onChange={(e) => setForm((f) => ({ ...f, isr_retenido: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  En general las retenciones se registran con la factura, no con el anticipo.
                  Use estos campos solo si la retención se causa al momento del pago.
                </p>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea value={form.description} rows={2}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Concepto del anticipo" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => { setForm(initialState); setRetOpen(false); }} disabled={submitting}>
                Limpiar
              </Button>
              <Button type="submit" disabled={submitting || !isValid()}>
                {submitting ? "Guardando…" : "Registrar Anticipo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anticipos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay anticipos a suplidores registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Suplidor</TableHead>
                  <TableHead>RNC</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(new Date(r.document_date))}
                    </TableCell>
                    <TableCell>{r.contact_name}</TableCell>
                    <TableCell className="font-mono">{r.contact_rnc || "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.total_amount).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.currency}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.balance_remaining).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.status === "paid" ? "secondary" : r.status === "partial" ? "default" : "outline"}>
                        {r.status === "open" ? "Abierto" : r.status === "partial" ? "Parcial" : r.status === "paid" ? "Aplicado" : r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
