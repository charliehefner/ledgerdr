import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CreditCard, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateLocal, fmtDate } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditCreditCardPaymentDialog } from "./EditCreditCardPaymentDialog";

interface BankAcct {
  id: string;
  account_name: string;
  account_type: string;
  currency: string | null;
}

const initialState = {
  date: undefined as Date | undefined,
  from_account: "",
  card_account: "",
  amount: "",
  dest_amount: "",
  description: "",
};

export function CreditCardPaymentsView() {
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...initialState });
  const [formKey, setFormKey] = useState(0);
  const resetForm = () => {
    setForm({ ...initialState });
    setFormKey((k) => k + 1);
  };
  const [submitting, setSubmitting] = useState(false);
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["cc-pay-bank-accounts"],
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

  const banks = bankAccounts.filter((a) => a.account_type === "bank");
  const petty = bankAccounts.filter((a) => a.account_type === "petty_cash");
  const cards = bankAccounts.filter((a) => a.account_type === "credit_card");
  const cardIds = cards.map((c) => c.id);

  const { data: recent = [], refetch: refetchRecent } = useQuery({
    queryKey: ["recent-cc-payments", selectedEntityId, cardIds.join(",")],
    enabled: cardIds.length > 0,
    queryFn: async () => {
      const q = supabase
        .from("transactions")
        .select("*")
        .eq("is_internal", true)
        .in("transaction_direction", ["payment", "investment"])
        .in("destination_acct_code", cardIds)
        .order("transaction_date", { ascending: false })
        .limit(25);
      if (selectedEntityId) q.eq("entity_id", selectedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      const ids = rows.map((r: any) => r.id);
      let postedSet = new Set<string>();
      if (ids.length) {
        const { data: jrows } = await supabase
          .from("journals")
          .select("transaction_source_id, posted")
          .in("transaction_source_id", ids)
          .eq("posted", true);
        postedSet = new Set((jrows || []).map((j: any) => j.transaction_source_id));
      }
      return rows.map((r: any) => ({ ...r, _isPosted: postedSet.has(r.id) }));
    },
  });

  const fromAcct = bankAccounts.find((a) => a.id === form.from_account);
  const cardAcct = bankAccounts.find((a) => a.id === form.card_account);
  const fromCur = fromAcct?.currency || "DOP";
  const toCur = cardAcct?.currency || "DOP";
  const isCrossCurrency = !!fromAcct && !!cardAcct && fromCur !== toCur;

  const acctName = (id: string | null | undefined) => {
    if (!id) return "—";
    const a = bankAccounts.find((b) => b.id === id);
    return a ? `${a.account_name} (${a.currency || "DOP"})` : id;
  };

  const isValid = () => {
    if (!form.date || !form.from_account || !form.card_account || !form.amount) return false;
    if (form.from_account === form.card_account) return false;
    if (parseFloat(form.amount) <= 0) return false;
    if (isCrossCurrency && !form.dest_amount) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) {
      if (isCrossCurrency && !form.dest_amount)
        toast.error("Ingrese monto aplicado a la tarjeta para pago multi-moneda");
      else toast.error(t("txForm.requiredFields"));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_transaction_with_ap_ar" as any, {
        p_transaction_date: formatDateLocal(form.date!),
        p_master_acct_code: "0000",
        p_description:
          form.description ||
          `Pago tarjeta: ${acctName(form.card_account)} desde ${acctName(form.from_account)}`,
        p_currency: fromCur,
        p_amount: parseFloat(form.amount),
        p_pay_method: form.from_account,
        p_is_internal: true,
        p_cost_center: "general",
        p_transaction_direction: "payment",
        p_destination_acct_code: form.card_account,
        p_destination_amount: isCrossCurrency ? parseFloat(form.dest_amount) : null,
        p_entity_id: selectedEntityId || null,
      });
      if (error) throw error;
      toast.success("Pago de tarjeta registrado");
      resetForm();
      await refetchRecent();
      queryClient.invalidateQueries({ queryKey: ["existingTransactions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: any) => {
    setEditTxn(row);
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Nuevo Pago de Tarjeta de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.date ? format(form.date, "PPP") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={form.date}
                      onSelect={(d) => setForm((f) => ({ ...f, date: d }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Banco / Caja Origen *</Label>
                <Select
                  value={form.from_account || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, from_account: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {banks.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">
                          Bancos
                        </SelectLabel>
                        {banks.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_name} ({a.currency || "DOP"})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {petty.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">
                            Caja Chica
                          </SelectLabel>
                          {petty.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.account_name} ({a.currency || "DOP"})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {fromAcct && <p className="text-xs text-muted-foreground">Moneda: {fromCur}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tarjeta de Crédito *</Label>
                <Select
                  value={form.card_account || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, card_account: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {cards.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">
                        No hay tarjetas registradas
                      </div>
                    ) : (
                      cards.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.account_name} ({a.currency || "DOP"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {cardAcct && <p className="text-xs text-muted-foreground">Moneda: {toCur}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Monto Pagado ({fromCur}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="font-mono"
                />
              </div>
              {isCrossCurrency && (
                <>
                  <div className="space-y-2">
                    <Label>Aplicado a Tarjeta ({toCur}) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.dest_amount}
                      onChange={(e) => setForm((f) => ({ ...f, dest_amount: e.target.value }))}
                      placeholder="0.00"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tasa Implícita</Label>
                    <p className="text-sm font-mono text-muted-foreground pt-2">
                      {form.amount && form.dest_amount && parseFloat(form.amount) > 0
                        ? (parseFloat(form.dest_amount) / parseFloat(form.amount)).toFixed(4)
                        : "—"}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Concepto del pago"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={submitting}
              >
                Limpiar
              </Button>
              <Button type="submit" disabled={submitting || !isValid()}>
                {submitting ? "Guardando..." : "Registrar Pago"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay pagos de tarjeta registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground" title={r.id}>
                      {r.legacy_id ?? "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(new Date(r.transaction_date))}
                    </TableCell>
                    <TableCell>{acctName(r.pay_method)}</TableCell>
                    <TableCell>{acctName(r.destination_acct_code)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.amount).toLocaleString("es-DO", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {r.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.description}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(r)}
                        disabled={r._isPosted}
                        title={r._isPosted ? "Asiento ya posteado" : "Editar"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditCreditCardPaymentDialog
        transaction={editTxn}
        bankAccounts={bankAccounts}
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditTxn(null);
        }}
        onSaved={() => {
          refetchRecent();
          queryClient.invalidateQueries({ queryKey: ["existingTransactions"] });
        }}
      />
    </div>
  );
}
