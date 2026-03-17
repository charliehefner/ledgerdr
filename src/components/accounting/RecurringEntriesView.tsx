import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/formatters";
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
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Play, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";

type Template = {
  id: string;
  template_name: string;
  description: string | null;
  frequency: string;
  next_run_date: string;
  is_active: boolean;
  currency: string | null;
};

export function RecurringEntriesView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    template_name: "",
    description: "",
    frequency: "monthly",
    next_run_date: "",
    currency: "DOP",
  });

  const [lines, setLines] = useState<{ account_id: string; debit: string; credit: string }[]>([
    { account_id: "", debit: "", credit: "" },
    { account_id: "", debit: "", credit: "" },
  ]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["recurring-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_journal_templates" as any)
        .select("*")
        .order("next_run_date");
      if (error) throw error;
      return data as unknown as Template[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-for-recurring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .is("deleted_at", null)
        .eq("allow_posting", true)
        .order("account_code");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: template, error } = await supabase
        .from("recurring_journal_templates" as any)
        .insert({
          template_name: form.template_name,
          description: form.description || null,
          frequency: form.frequency,
          next_run_date: form.next_run_date,
          currency: form.currency,
          created_by: user?.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
      if (validLines.length < 2) throw new Error(t("accounting.recur.needTwoLines"));

      const { error: lError } = await supabase
        .from("recurring_journal_template_lines" as any)
        .insert(validLines.map(l => ({
          template_id: (template as any).id,
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })) as any);
      if (lError) throw lError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
      toast({ title: t("accounting.recur.templateCreated") });
      setDialogOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_journal_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
      toast({ title: t("accounting.recur.templateDeleted") });
    },
  });

  const generateDueEntries = async () => {
    setGenerating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const dueTemplates = templates.filter(tmpl => tmpl.is_active && tmpl.next_run_date <= today);

      if (dueTemplates.length === 0) {
        toast({ title: t("accounting.recur.noDue"), description: t("accounting.recur.noDueDesc") });
        setGenerating(false);
        return;
      }

      const { data: generated, error } = await supabase.rpc("generate_due_recurring_journals", {
        p_user_id: user?.id,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({
        title: t("accounting.recur.generated"),
        description: t("accounting.recur.generatedDesc").replace("{count}", String(generated || 0)),
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const addLine = () => setLines(l => [...l, { account_id: "", debit: "", credit: "" }]);

  const updateLine = (idx: number, field: string, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const openNew = () => {
    setForm({ template_name: "", description: "", frequency: "monthly", next_run_date: "", currency: "DOP" });
    setLines([{ account_id: "", debit: "", credit: "" }, { account_id: "", debit: "", credit: "" }]);
    setDialogOpen(true);
  };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const today = new Date().toISOString().split("T")[0];
  const dueCount = templates.filter(tmpl => tmpl.is_active && tmpl.next_run_date <= today).length;

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-medium">{t("accounting.recur.title")}</h3>
        <div className="flex gap-2">
          {dueCount > 0 && (
            <Button size="sm" onClick={generateDueEntries} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              {t("accounting.recur.generateDue")} ({dueCount})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> {t("accounting.recur.newTemplate")}
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title={t("accounting.recur.noTemplates")}
          description={t("accounting.recur.noTemplatesDesc")}
          action={<Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />{t("accounting.recur.newTemplate")}</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.recur.col.name")}</TableHead>
                <TableHead>{t("accounting.recur.col.frequency")}</TableHead>
                <TableHead>{t("accounting.recur.col.nextRun")}</TableHead>
                <TableHead>{t("accounting.recur.col.currency")}</TableHead>
                <TableHead>{t("accounting.recur.col.status")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(tmpl => (
                <TableRow key={tmpl.id}>
                  <TableCell className="font-medium">{tmpl.template_name}</TableCell>
                  <TableCell>{tmpl.frequency === "biweekly" ? t("accounting.recur.biweekly") : t("accounting.recur.monthly")}</TableCell>
                  <TableCell className={tmpl.next_run_date <= today ? "text-destructive font-medium" : ""}>
                    {format(new Date(tmpl.next_run_date + "T00:00:00"), "dd/MM/yyyy")}
                    {tmpl.next_run_date <= today && <Badge variant="destructive" className="ml-2 text-[10px]">{t("accounting.recur.overdue")}</Badge>}
                  </TableCell>
                  <TableCell>{tmpl.currency || "DOP"}</TableCell>
                  <TableCell>
                    <Badge variant={tmpl.is_active ? "default" : "secondary"}>
                      {tmpl.is_active ? t("accounting.recur.active") : t("accounting.recur.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(tmpl.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Template Dialog */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("accounting.recur.newTemplateTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("accounting.recur.templateName")}</Label>
                  <Input value={form.template_name} onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))} placeholder={t("accounting.recur.templateNamePlaceholder")} />
                </div>
                <div>
                  <Label>{t("accounting.description")}</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t("accounting.recur.frequency")}</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="monthly">{t("accounting.recur.monthly")}</option>
                    <option value="biweekly">{t("accounting.recur.biweekly")}</option>
                  </select>
                </div>
                <div>
                  <Label>{t("accounting.recur.nextDate")}</Label>
                  <Input type="date" value={form.next_run_date} onChange={e => setForm(f => ({ ...f, next_run_date: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("accounting.currencyLabel")}</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="DOP">DOP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>{t("accounting.recur.entryLines")}</Label>
                <div className="border rounded-lg overflow-auto mt-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2">{t("accounting.col.account")}</th>
                        <th className="text-right p-2 w-32">{t("accounting.col.debit")}</th>
                        <th className="text-right p-2 w-32">{t("accounting.col.credit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1">
                            <select
                              className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                              value={line.account_id}
                              onChange={e => updateLine(idx, "account_id", e.target.value)}
                            >
                              <option value="">{t("accounting.selectAccount")}...</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1">
                            <Input type="number" className="h-8 text-right text-xs" value={line.debit} onChange={e => updateLine(idx, "debit", e.target.value)} />
                          </td>
                          <td className="p-1">
                            <Input type="number" className="h-8 text-right text-xs" value={line.credit} onChange={e => updateLine(idx, "credit", e.target.value)} />
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t font-medium bg-muted/30">
                        <td className="p-2 text-right">
                          <Button type="button" variant="ghost" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" />{t("accounting.line")}</Button>
                        </td>
                        <td className="p-2 text-right font-mono">{formatMoney(totalDebit)}</td>
                        <td className="p-2 text-right font-mono">{formatMoney(totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {!isBalanced && totalDebit > 0 && (
                  <p className="text-xs text-destructive mt-1">{t("accounting.debitCreditUnbalanced")}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.template_name || !form.next_run_date || !isBalanced}
              >
                {createMutation.isPending ? t("common.saving") : t("accounting.recur.saveTemplate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
