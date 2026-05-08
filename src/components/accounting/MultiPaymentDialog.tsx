import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";

interface OpenDoc {
  id: string;
  document_number: string | null;
  contact_name: string;
  document_date: string;
  due_date: string | null;
  currency: string;
  balance_remaining: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "payable" | "receivable";
  documents: OpenDoc[];
}

type SelState = Record<string, { checked: boolean; amount: string }>;

export function MultiPaymentDialog({ open, onOpenChange, direction, documents }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const submitLockRef = useRef(false);

  const [currency, setCurrency] = useState<string>("DOP");
  const [contact, setContact] = useState<string>("__all__");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [sel, setSel] = useState<SelState>({});

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, chart_account_id, currency")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const contacts = useMemo(() => {
    const set = new Set(documents.map(d => d.contact_name));
    return Array.from(set).sort();
  }, [documents]);

  const filtered = useMemo(() => {
    return documents
      .filter(d => d.currency === currency)
      .filter(d => contact === "__all__" || d.contact_name === contact)
      .sort((a, b) => (a.due_date || a.document_date).localeCompare(b.due_date || b.document_date));
  }, [documents, currency, contact]);

  const selected = filtered.filter(d => sel[d.id]?.checked);
  const total = selected.reduce((s, d) => s + (parseFloat(sel[d.id]?.amount || "0") || 0), 0);

  const toggle = (doc: OpenDoc, on: boolean) => {
    setSel(prev => ({
      ...prev,
      [doc.id]: { checked: on, amount: on ? doc.balance_remaining.toFixed(2) : "" },
    }));
  };

  const setAmount = (id: string, value: string) => {
    setSel(prev => ({ ...prev, [id]: { ...(prev[id] || { checked: true, amount: "" }), amount: value } }));
  };

  const reset = () => {
    setSel({});
    setBankAccountId("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setContact("__all__");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bankAccountId) throw new Error(t("payment.selectAccount"));
      const apps = selected.map(d => {
        const amt = parseFloat(sel[d.id]?.amount || "0");
        if (!amt || amt <= 0) throw new Error(`Monto inválido para ${d.document_number || d.contact_name}`);
        if (amt > d.balance_remaining + 0.005) throw new Error(`Monto excede saldo de ${d.document_number || d.contact_name}`);
        return { document_id: d.id, amount: amt };
      });
      if (apps.length === 0) throw new Error("Seleccione al menos un documento");

      const { data, error } = await supabase.rpc("apply_ap_ar_payment_multi" as any, {
        p_applications: apps,
        p_payment_date: paymentDate,
        p_bank_account_id: bankAccountId,
        p_user_id: user?.id || null,
        p_exchange_rate: null,
        p_notes: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`Pago aplicado a ${res?.count || selected.length} documento(s)`);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => { submitLockRef.current = false; },
  });

  const handleOpen = (o: boolean) => { if (!o) reset(); onOpenChange(o); };
  const handleSubmit = () => {
    if (submitLockRef.current || mutation.isPending) return;
    submitLockRef.current = true;
    mutation.mutate();
  };

  const labelTitle = direction === "payable" ? "Pago múltiple a proveedores" : "Cobro múltiple de clientes";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{labelTitle}</DialogTitle>
          <DialogDescription>
            Aplique un solo pago/cobro a varios documentos. Se crea un asiento balanceado y una transacción consolidada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="DOP">DOP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{direction === "payable" ? "Proveedor" : "Cliente"}</Label>
            <Select value={contact} onValueChange={setContact}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="__all__">Todos</SelectItem>
                {contacts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cuenta bancaria</Label>
            <Select value={bankAccountId || undefined} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent className="bg-popover">
                {bankAccounts.filter(b => !b.currency || b.currency === currency).map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.account_name} — {b.bank_name} ({b.currency || "DOP"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg overflow-auto max-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Documento</TableHead>
                <TableHead>{direction === "payable" ? "Proveedor" : "Cliente"}</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right w-40">A aplicar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Sin documentos abiertos para esta selección
                </TableCell></TableRow>
              ) : filtered.map(d => {
                const s = sel[d.id];
                return (
                  <TableRow key={d.id} className={s?.checked ? "bg-accent/30" : ""}>
                    <TableCell>
                      <Checkbox checked={!!s?.checked} onCheckedChange={(v) => toggle(d, !!v)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.document_number || "—"}</TableCell>
                    <TableCell>{d.contact_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(d.document_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{d.due_date ? formatDate(d.due_date) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(d.balance_remaining, d.currency)}</TableCell>
                    <TableCell className="text-right">
                      {s?.checked ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={d.balance_remaining}
                          value={s.amount}
                          onChange={e => setAmount(d.id, e.target.value)}
                          className="font-mono text-right h-8"
                        />
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
          <div className="text-sm">
            <span className="text-muted-foreground">{selected.length} documento(s) seleccionado(s)</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total a {direction === "payable" ? "pagar" : "cobrar"}</div>
            <div className="text-lg font-mono font-bold">{formatCurrency(total, currency)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={selected.length === 0 || total <= 0 || !bankAccountId || mutation.isPending}
          >
            {mutation.isPending ? t("payment.saving") : `Aplicar ${formatCurrency(total, currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
