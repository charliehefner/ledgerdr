import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type NewLine = {
  key: string;
  account_id: string;
  debit: string;
  credit: string;
  project_code: string;
  cbs_code: string;
  description: string;
};

interface JournalEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalEntryForm({ open, onOpenChange }: JournalEntryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [referenceDescription, setReferenceDescription] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [journalType, setJournalType] = useState("GJ");
  const [lines, setLines] = useState<NewLine[]>([
    { key: "1", account_id: "", debit: "", credit: "", project_code: "", cbs_code: "", description: "" },
    { key: "2", account_id: "", debit: "", credit: "", project_code: "", cbs_code: "", description: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart_of_accounts_posting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0 };
  }, [lines]);

  const fmtNum = (n: number) =>
    n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const addLine = () => {
    setLines((prev) => [...prev, { key: String(Date.now()), account_id: "", debit: "", credit: "", project_code: "", cbs_code: "" }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof NewLine, value: string) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: value };
        if (field === "debit" && value) updated.credit = "";
        if (field === "credit" && value) updated.debit = "";
        return updated;
      })
    );
  };

  const reset = () => {
    setJournalDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setReferenceDescription("");
    setCurrency("DOP");
    setJournalType("GJ");
    setLines([
      { key: "1", account_id: "", debit: "", credit: "", project_code: "", cbs_code: "", description: "" },
      { key: "2", account_id: "", debit: "", credit: "", project_code: "", cbs_code: "", description: "" },
    ]);
  };

  const handleSave = async () => {
    if (!totals.balanced) {
      toast({ title: "Error", description: "Débitos y créditos deben estar balanceados.", variant: "destructive" });
      return;
    }
    if (lines.some((l) => !l.account_id)) {
      toast({ title: "Error", description: "Todas las líneas necesitan una cuenta.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Error", description: "La descripción es requerida.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: journal, error: jErr } = await supabase
        .from("journals")
        .insert({
          journal_date: journalDate,
          description,
          reference_description: referenceDescription || null,
          currency,
          created_by: user?.id,
          posted: false,
          journal_type: journalType,
        } as any)
        .select("id")
        .single();
      if (jErr) throw jErr;

      const newLines = lines.map((l) => ({
        journal_id: journal.id,
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        project_code: l.project_code || null,
        cbs_code: l.cbs_code || null,
        description: l.description || null,
        created_by: user?.id,
      }));
      const { error: lErr } = await supabase.from("journal_lines").insert(newLines);
      if (lErr) throw lErr;

      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({ title: "Creado", description: "Asiento creado como borrador." });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Asiento Contable</DialogTitle>
          <DialogDescription>Se creará como borrador para revisión.</DialogDescription>
        </DialogHeader>

        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={journalType} onValueChange={setJournalType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GJ">GJ – General</SelectItem>
                <SelectItem value="PJ">PJ – Compras</SelectItem>
                <SelectItem value="SJ">SJ – Ventas</SelectItem>
                <SelectItem value="PRJ">PRJ – Nómina</SelectItem>
                <SelectItem value="CDJ">CDJ – Desembolsos</SelectItem>
                <SelectItem value="CRJ">CRJ – Recibos</SelectItem>
                <SelectItem value="DEP">DEP – Depreciación</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Moneda</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DOP">DOP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Descripción</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Referencia</label>
            <Input value={referenceDescription} onChange={(e) => setReferenceDescription(e.target.value)} placeholder="Ej: Factura #001, Cheque #123" />
          </div>
        </div>

        {/* Lines */}
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Cuenta</th>
                <th className="text-left p-2 font-medium w-[140px]">Descripción</th>
                <th className="text-left p-2 font-medium w-[100px]">Proyecto</th>
                <th className="text-left p-2 font-medium w-[80px]">CBS</th>
                <th className="text-right p-2 font-medium w-[130px]">Débito</th>
                <th className="text-right p-2 font-medium w-[130px]">Crédito</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key} className="border-b border-border/30">
                  <td className="p-2">
                    <Select value={line.account_id} onValueChange={(v) => updateLine(idx, "account_id", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} — {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      value={line.project_code}
                      onChange={(e) => updateLine(idx, "project_code", e.target.value)}
                      placeholder="Proyecto"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      value={line.cbs_code}
                      onChange={(e) => updateLine(idx, "cbs_code", e.target.value)}
                      placeholder="CBS"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-right text-xs"
                      value={line.debit}
                      onChange={(e) => updateLine(idx, "debit", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-right text-xs"
                      value={line.credit}
                      onChange={(e) => updateLine(idx, "credit", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium bg-muted/30">
                <td colSpan={3} className="p-2 text-right">Totales</td>
                <td className={`p-2 text-right ${!totals.balanced ? "text-destructive" : ""}`}>
                  {fmtNum(totals.totalDebit)}
                </td>
                <td className={`p-2 text-right ${!totals.balanced ? "text-destructive" : ""}`}>
                  {fmtNum(totals.totalCredit)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {!totals.balanced && totals.totalDebit > 0 && (
          <p className="text-xs text-destructive">
            Diferencia: {fmtNum(Math.abs(totals.totalDebit - totals.totalCredit))}
          </p>
        )}

        <Button variant="outline" size="sm" onClick={addLine} className="w-fit">
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !totals.balanced}>
            Crear Borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
