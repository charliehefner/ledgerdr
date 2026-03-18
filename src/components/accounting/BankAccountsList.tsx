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
import { Plus, Pencil, Landmark } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type BankAccount = {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  currency: string | null;
  is_active: boolean | null;
  chart_account_id: string | null;
  account_type: string;
};

type ChartAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

const emptyForm = {
  account_name: "",
  bank_name: "",
  account_number: "",
  currency: "DOP",
  chart_account_id: "",
};

export function BankAccountsList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["treasury-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("*")
        .eq("account_type", "bank")
        .order("account_name");
      if (error) throw error;
      return data as unknown as BankAccount[];
    },
  });

  const { data: glBalances = [] } = useQuery({
    queryKey: ["bank-gl-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_balances_from_journals", {});
      if (error) throw error;
      return data || [];
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        account_name: form.account_name,
        bank_name: form.bank_name,
        account_number: form.account_number || null,
        currency: form.currency,
        chart_account_id: form.chart_account_id || null,
        account_type: "bank",
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
      queryClient.invalidateQueries({ queryKey: ["treasury-bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success(editingId ? t("treasury.bank.accountUpdated") : t("treasury.bank.accountCreated"));
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = async (acct: BankAccount) => {
    const { error } = await supabase
      .from("bank_accounts")
      .update({ is_active: !acct.is_active } as any)
      .eq("id", acct.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["treasury-bank-accounts"] });
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (acct: BankAccount) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("treasury.bank.title")}</h3>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t("treasury.bank.newAccount")}</Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("treasury.bank.loading")}</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Landmark} title={t("treasury.bank.emptyTitle")} description={t("treasury.bank.emptyDesc")} />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("treasury.bank.col.name")}</TableHead>
                <TableHead>{t("treasury.bank.col.bank")}</TableHead>
                <TableHead>{t("treasury.bank.col.number")}</TableHead>
                <TableHead>{t("treasury.bank.col.currency")}</TableHead>
                <TableHead>{t("treasury.bank.col.glAccount")}</TableHead>
                <TableHead className="text-right">{t("treasury.bank.col.glBalance")}</TableHead>
                <TableHead>{t("treasury.bank.col.status")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(acct => {
                const chartCode = chartAccounts.find(c => c.id === acct.chart_account_id)?.account_code;
                const glEntry = chartCode ? (glBalances as any[]).find((b: any) => b.account_code === chartCode) : null;
                const glBalance = glEntry ? Number(glEntry.balance) : null;
                return (
                <TableRow key={acct.id}>
                  <TableCell className="font-medium">{acct.account_name}</TableCell>
                  <TableCell>{acct.bank_name}</TableCell>
                  <TableCell className="text-muted-foreground">{acct.account_number || "—"}</TableCell>
                  <TableCell>{acct.currency || "DOP"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {chartCode || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {glBalance !== null ? glBalance.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={acct.is_active ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(acct)}
                    >
                      {acct.is_active ? t("treasury.bank.active") : t("treasury.bank.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(acct)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}

            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("treasury.bank.editTitle") : t("treasury.bank.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{t("treasury.bank.accountName")}</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder={t("treasury.bank.accountNamePlaceholder")} /></div>
            <div><Label>{t("treasury.bank.bankName")}</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder={t("treasury.bank.bankNamePlaceholder")} /></div>
            <div><Label>{t("treasury.bank.accountNumber")}</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
            <div>
              <Label>{t("treasury.bank.col.currency")}</Label>
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
            <Button onClick={() => saveMutation.mutate()} disabled={!form.account_name || !form.bank_name || saveMutation.isPending}>
              {saveMutation.isPending ? t("treasury.bank.saving") : editingId ? t("treasury.bank.update") : t("treasury.bank.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
