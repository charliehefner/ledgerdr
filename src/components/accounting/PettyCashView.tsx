import { useState, useMemo } from "react";
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
import { Plus, Pencil, Wallet, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ReplenishmentDialog } from "./ReplenishmentDialog";
import { useLanguage } from "@/contexts/LanguageContext";

type PettyCashAccount = {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  currency: string | null;
  is_active: boolean | null;
  chart_account_id: string | null;
  account_type: string;
  fixed_amount: number | null;
};

type ChartAccount = { id: string; account_code: string; account_name: string };

type Transaction = {
  id: string;
  legacy_id: number | null;
  transaction_date: string;
  description: string;
  amount: number;
  name: string | null;
  currency: string;
  pay_method?: string;
  destination_acct_code?: string;
};

const emptyForm = { account_name: "", bank_name: "Caja Chica", account_number: "", currency: "DOP", chart_account_id: "", fixed_amount: "" };

export function PettyCashView() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [replenishFund, setReplenishFund] = useState<PettyCashAccount | null>(null);
  const [selectedFundId, setSelectedFundId] = useState<string>("all");

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

  const chartAccountIds = accounts.filter(a => a.chart_account_id).map(a => a.chart_account_id!);
  const { data: glBalances = [] } = useQuery({
    queryKey: ["petty-cash-gl-balances", chartAccountIds],
    queryFn: async () => {
      if (chartAccountIds.length === 0) return [];
      const { data, error } = await supabase.rpc("account_balances_from_journals");
      if (error) throw error;
      return data || [];
    },
    enabled: chartAccountIds.length > 0,
  });

  const glBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach(acct => {
      if (!acct.chart_account_id) return;
      const chartAcct = chartAccounts.find(c => c.id === acct.chart_account_id);
      if (!chartAcct) return;
      const bal = glBalances.find((b: any) => b.account_code === chartAcct.account_code);
      if (bal) map.set(acct.id, bal.balance);
    });
    return map;
  }, [accounts, chartAccounts, glBalances]);

  const pettyCashIds = accounts.map(a => a.id);

  const { data: recentTx = [] } = useQuery({
    queryKey: ["petty-cash-transactions", pettyCashIds],
    queryFn: async () => {
      if (pettyCashIds.length === 0) return [] as Transaction[];
      const idList = pettyCashIds.join(",");
      const orFilter = `pay_method.in.(${idList}),destination_acct_code.in.(${idList})`;
      const { data, error } = await supabase
        .from("transactions")
        .select("id, legacy_id, transaction_date, description, amount, name, currency, pay_method, destination_acct_code")
        .or(orFilter)
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const isRecharge = (tx: Transaction) =>
    !pettyCashIds.includes(tx.pay_method || "") && pettyCashIds.includes(tx.destination_acct_code || "");

  const filteredTx = useMemo(() => {
    if (selectedFundId === "all") return recentTx;
    return recentTx.filter(tx =>
      tx.pay_method === selectedFundId || tx.destination_acct_code === selectedFundId
    );
  }, [recentTx, selectedFundId]);

  const totalExpenses = filteredTx.filter(tx => !isRecharge(tx)).reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalRecharges = filteredTx.filter(tx => isRecharge(tx)).reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const txWithBalance = (() => {
    if (filteredTx.length === 0) return [];
    const selectedAcct = selectedFundId !== "all"
      ? accounts.find(a => a.id === selectedFundId)
      : accounts[0];
    const startingBalance = selectedAcct?.fixed_amount || 0;
    const chronological = [...filteredTx].reverse();
    let balance = startingBalance;
    const withBal = chronological.map(tx => {
      if (isRecharge(tx)) {
        balance += tx.amount;
      } else {
        balance -= tx.amount;
      }
      return { ...tx, balance };
    });
    return withBal.reverse();
  })();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        account_name: form.account_name,
        bank_name: form.bank_name || "Caja Chica",
        account_number: form.account_number || null,
        currency: form.currency,
        chart_account_id: form.chart_account_id || null,
        account_type: "petty_cash",
        fixed_amount: form.fixed_amount ? parseFloat(form.fixed_amount) : null,
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
      toast.success(editingId ? t("treasury.pc.fundUpdated") : t("treasury.pc.fundCreated"));
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
      fixed_amount: acct.fixed_amount?.toString() || "",
    });
    setDialogOpen(true);
  };

  const fmtNum = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Petty Cash Funds */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("treasury.pc.title")}</h3>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t("treasury.pc.newFund")}</Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">{t("treasury.bank.loading")}</div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={Wallet} title={t("treasury.pc.emptyTitle")} description={t("treasury.pc.emptyDesc")} />
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("treasury.pc.col.name")}</TableHead>
                  <TableHead>{t("treasury.pc.col.currency")}</TableHead>
                   <TableHead className="text-right">{t("treasury.pc.col.fixedAmount")}</TableHead>
                   <TableHead className="text-right">{t("treasury.pc.col.glBalance")}</TableHead>
                   <TableHead>{t("treasury.pc.col.glAccount")}</TableHead>
                  <TableHead>{t("treasury.pc.col.status")}</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(acct => (
                  <TableRow key={acct.id}>
                    <TableCell className="font-medium">{acct.account_name}</TableCell>
                    <TableCell>{acct.currency || "DOP"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {acct.fixed_amount ? fmtNum(acct.fixed_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {glBalanceMap.has(acct.id)
                        ? fmtNum(glBalanceMap.get(acct.id)!)
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {chartAccounts.find(c => c.id === acct.chart_account_id)?.account_code || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={acct.is_active ? "default" : "outline"}>
                        {acct.is_active ? t("treasury.pc.active") : t("treasury.pc.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(acct)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {acct.fixed_amount && acct.fixed_amount > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("treasury.pc.replenishFund")}
                          onClick={() => setReplenishFund(acct)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
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
          <h3 className="text-lg font-semibold">{t("treasury.pc.recentTitle")}</h3>
          <div className="flex gap-3">
            <Badge variant="outline" className="text-base px-3 py-1">
              {t("treasury.pc.expenses")}: {fmtNum(totalExpenses)}
            </Badge>
            <Badge variant="outline" className="text-base px-3 py-1 border-primary/50 text-primary">
              {t("treasury.pc.recharges")}: {fmtNum(totalRecharges)}
            </Badge>
          </div>
        </div>

        {recentTx.length === 0 ? (
          <EmptyState icon={Wallet} title={t("treasury.pc.noTxTitle")} description={t("treasury.pc.noTxDesc")} />
        ) : (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("treasury.pc.col.id")}</TableHead>
                  <TableHead>{t("treasury.pc.col.date")}</TableHead>
                  <TableHead>{t("treasury.pc.col.type")}</TableHead>
                  <TableHead>{t("treasury.pc.col.txName")}</TableHead>
                  <TableHead>{t("treasury.pc.col.description")}</TableHead>
                  <TableHead className="text-right">{t("treasury.pc.col.amount")}</TableHead>
                  <TableHead className="text-right">{t("treasury.pc.col.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txWithBalance.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{tx.legacy_id ?? "—"}</TableCell>
                    <TableCell>{format(new Date(tx.transaction_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={isRecharge(tx) ? "default" : "outline"}>
                        {isRecharge(tx) ? t("treasury.pc.recharge") : t("treasury.pc.expense")}
                      </Badge>
                    </TableCell>
                    <TableCell>{tx.name || "—"}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(tx.amount)}</TableCell>
                    <TableCell className={`text-right font-mono ${tx.balance < 0 ? "text-destructive" : ""}`}>
                      {fmtNum(tx.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Fund Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? t("treasury.pc.editTitle") : t("treasury.pc.newTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{t("treasury.pc.fundName")}</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder={t("treasury.pc.fundNamePlaceholder")} /></div>
            <div>
              <Label>{t("treasury.pc.fixedAmountLabel")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.fixed_amount}
                onChange={e => setForm(f => ({ ...f, fixed_amount: e.target.value }))}
                placeholder="10000.00"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("treasury.pc.fixedAmountHint")}</p>
            </div>
            <div>
              <Label>{t("treasury.pc.col.currency")}</Label>
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
              <Label>{t("treasury.bank.glAccountLabel")}</Label>
              <Select value={form.chart_account_id} onValueChange={v => setForm(f => ({ ...f, chart_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("treasury.bank.selectAccount")} /></SelectTrigger>
                <SelectContent className="bg-popover max-h-[200px]">
                  {chartAccounts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.account_code} — {c.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("treasury.bank.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.account_name || saveMutation.isPending}>
              {saveMutation.isPending ? t("treasury.bank.saving") : editingId ? t("treasury.bank.update") : t("treasury.bank.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replenishment Dialog */}
      <ReplenishmentDialog
        open={!!replenishFund}
        onOpenChange={open => { if (!open) setReplenishFund(null); }}
        fund={replenishFund}
      />
    </div>
  );
}
