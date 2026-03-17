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
import { format, addMonths, addDays } from "date-fns";

type Template = {
  id: string;
  template_name: string;
  description: string | null;
  frequency: string;
  next_run_date: string;
  is_active: boolean;
  currency: string | null;
};

type TemplateLine = {
  id: string;
  template_id: string;
  account_id: string;
  project_code: string | null;
  cbs_code: string | null;
  debit: number;
  credit: number;
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
      if (validLines.length < 2) throw new Error("Se necesitan al menos 2 líneas.");

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
      toast({ title: "Plantilla creada" });
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
      toast({ title: "Plantilla eliminada" });
    },
  });

  const generateDueEntries = async () => {
    setGenerating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const dueTemplates = templates.filter(t => t.is_active && t.next_run_date <= today);

      if (dueTemplates.length === 0) {
        toast({ title: "Sin pendientes", description: "No hay plantillas con fecha vencida para generar." });
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
        title: "Asientos Generados",
        description: `Se generaron ${generated || 0} asiento(s) borrador(es) tipo RJ.`,
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
  const dueCount = templates.filter(t => t.is_active && t.next_run_date <= today).length;

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-medium">Asientos Recurrentes</h3>
        <div className="flex gap-2">
          {dueCount > 0 && (
            <Button size="sm" onClick={generateDueEntries} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Generar Pendientes ({dueCount})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Plantilla
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="Sin plantillas recurrentes"
          description="Cree plantillas para asientos que se repiten mensual o quincenalmente."
          action={<Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Plantilla</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Próxima Ejecución</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.template_name}</TableCell>
                  <TableCell>{t.frequency === "biweekly" ? "Quincenal" : "Mensual"}</TableCell>
                  <TableCell className={t.next_run_date <= today ? "text-destructive font-medium" : ""}>
                    {format(new Date(t.next_run_date + "T00:00:00"), "dd/MM/yyyy")}
                    {t.next_run_date <= today && <Badge variant="destructive" className="ml-2 text-[10px]">Vencida</Badge>}
                  </TableCell>
                  <TableCell>{t.currency || "DOP"}</TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}>
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
              <DialogTitle>Nueva Plantilla Recurrente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={form.template_name} onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))} placeholder="Ej: Depreciación mensual" />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Frecuencia</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="monthly">Mensual</option>
                    <option value="biweekly">Quincenal</option>
                  </select>
                </div>
                <div>
                  <Label>Próxima Fecha</Label>
                  <Input type="date" value={form.next_run_date} onChange={e => setForm(f => ({ ...f, next_run_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Moneda</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="DOP">DOP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Líneas del Asiento</Label>
                <div className="border rounded-lg overflow-auto mt-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2">Cuenta</th>
                        <th className="text-right p-2 w-32">Débito</th>
                        <th className="text-right p-2 w-32">Crédito</th>
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
                              <option value="">Seleccionar cuenta...</option>
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
                          <Button type="button" variant="ghost" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Línea</Button>
                        </td>
                        <td className="p-2 text-right font-mono">{totalDebit.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{totalCredit.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {!isBalanced && totalDebit > 0 && (
                  <p className="text-xs text-destructive mt-1">Débitos y créditos no están balanceados.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.template_name || !form.next_run_date || !isBalanced}
              >
                {createMutation.isPending ? "Guardando..." : "Guardar Plantilla"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
