import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Plus, Pencil, Wallet } from "lucide-react";
import { format } from "date-fns";

type PettyCashAccount = {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  currency: string | null;
  is_active: boolean | null;
  chart_account_id: string | null;
  account_type: string;
};

type ChartAccount = { id: string; account_code: string; account_name: string };

type Transaction = {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  name: string | null;
  currency: string;
};

const emptyForm = { account_name: "", bank_name: "Caja Chica", account_number: "", currency: "DOP", chart_account_id: "" };

export function PettyCashView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["treasury-petty-cash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("*")
        .eq("account_type", "petty_cash")
        .order("account_name");
      if (error) throw error;
      return data as unknown as PettyCashAccount[];
    },
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ["chart-accounts-postable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data as ChartAccount[];
    },
  });

  // Get petty cash account IDs for filtering transfers TO petty cash
  const pettyCashIds = accounts.map(a => a.id);

  // Fetch recent petty cash transactions (expenses FROM + transfers TO)
  const { data: recentTx = [] } = useQuery({
    queryKey: ["petty-cash-transactions", pettyCashIds],
    queryFn: async () => {
      if (pettyCashIds.length === 0) {
        // Still fetch pay_method=petty_cash even if no petty cash accounts exist
        const { data, error } = await supabase
          .from("transactions")
          .select("id, transaction_date, description, amount, name, currency, pay_method, destination_acct_code")
          .eq("pay_method", "petty_cash")
          .order("transaction_date", { ascending: false })
          .limit(50);
        if (error) throw error;
        return data as (Transaction & { pay_method?: string; destination_acct_code?: string })[];
      }
      const orFilter = `pay_method.eq.petty_cash,destination_acct_code.in.(${pettyCashIds.join(",")})`;
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, description, amount, name, currency, pay_method, destination_acct_code")
        .or(orFilter)
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as (Transaction & { pay_method?: string; destination_acct_code?: string })[];
    },
  });

  const isRecharge = (tx: { pay_method?: string; destination_acct_code?: string }) =>
    tx.pay_method !== "petty_cash" && pettyCashIds.includes(tx.destination_acct_code || "");

  const totalExpenses = recentTx.filter(tx => !isRecharge(tx)).reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalRecharges = recentTx.filter(tx => isRecharge(tx)).reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        account_name: form.account_name,
        bank_name: form.bank_name || "Caja Chica",
        account_number: form.account_number || null,
        currency: form.currency,
        chart_account_id: form.chart_account_id || null,
        account_type: "petty_cash",
      };
      if (editingId) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-petty-cash"] });
      toast.success(editingId ? "Fondo actualizado" : "Fondo creado");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (acct: PettyCashAccount) => {
    setEditingId(acct.id);
    setForm({
      account_name: acct.account_name,
      bank_name: acct.bank_name,
      account_number: acct.account_number || "",
      currency: acct.currency || "DOP",
      chart_account_id: acct.chart_account_id || "",
    });
    setDialogOpen(true);
  };

  const fmtNum = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Petty Cash Funds */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Fondos de Caja Chica</h3>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo Fondo</Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={Wallet} title="Sin fondos de caja chica" description="Cree un fondo de caja chica para comenzar." />
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Cuenta Contable</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(acct => (
                  <TableRow key={acct.id}>
                    <TableCell className="font-medium">{acct.account_name}</TableCell>
                    <TableCell>{acct.currency || "DOP"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {chartAccounts.find(c => c.id === acct.chart_account_id)?.account_code || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={acct.is_active ? "default" : "outline"}>
                        {acct.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(acct)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Recent Petty Cash Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transacciones Recientes (Caja Chica)</h3>
          <div className="flex gap-3">
            <Badge variant="outline" className="text-base px-3 py-1">
              Gastos: {fmtNum(totalExpenses)}
            </Badge>
            <Badge variant="outline" className="text-base px-3 py-1 border-primary/50 text-primary">
              Recargas: {fmtNum(totalRecharges)}
            </Badge>
          </div>
        </div>

        {recentTx.length === 0 ? (
          <EmptyState icon={Wallet} title="Sin transacciones" description="Las transacciones con método de pago 'Caja Chica' aparecerán aquí." />
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTx.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.transaction_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={isRecharge(tx) ? "default" : "outline"}>
                        {isRecharge(tx) ? "Recarga" : "Gasto"}
                      </Badge>
                    </TableCell>
                    <TableCell>{tx.name || "—"}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(tx.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Fund Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Fondo" : "Nuevo Fondo de Caja Chica"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Nombre *</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Ej: Caja Chica Principal" /></div>
            <div>
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="DOP">DOP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cuenta Contable (GL)</Label>
              <Select value={form.chart_account_id} onValueChange={v => setForm(f => ({ ...f, chart_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                <SelectContent className="bg-popover max-h-[200px]">
                  {chartAccounts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.account_code} — {c.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.account_name || saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
