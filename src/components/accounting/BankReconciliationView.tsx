import { useState, useMemo, useRef } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Upload, Landmark, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";

type BankAccount = {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  currency: string | null;
  is_active: boolean;
};

type BankLine = {
  id: string;
  bank_account_id: string;
  statement_date: string;
  description: string | null;
  reference: string | null;
  amount: number;
  balance: number | null;
  is_reconciled: boolean;
  matched_journal_id: string | null;
  matched_transaction_id: string | null;
};

export function BankReconciliationView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedBank, setSelectedBank] = useState<string>("");
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ account_name: "", bank_name: "", account_number: "", currency: "DOP" });
  const [lineForm, setLineForm] = useState({ statement_date: "", description: "", reference: "", amount: "" });

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("*")
        .order("account_name");
      if (error) throw error;
      return data as unknown as BankAccount[];
    },
  });

  // Fetch statement lines for selected bank
  const { data: bankLines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["bank-lines", selectedBank],
    queryFn: async () => {
      if (!selectedBank) return [];
      const { data, error } = await supabase
        .from("bank_statement_lines" as any)
        .select("*")
        .eq("bank_account_id", selectedBank)
        .order("statement_date", { ascending: false });
      if (error) throw error;
      return data as unknown as BankLine[];
    },
    enabled: !!selectedBank,
  });

  const reconciledCount = useMemo(() => bankLines.filter(l => l.is_reconciled).length, [bankLines]);
  const unreconciledCount = bankLines.length - reconciledCount;

  // Create bank account
  const createBankMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bank_accounts" as any).insert(bankForm as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({ title: "Cuenta bancaria creada" });
      setBankDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Add manual line
  const addLineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bank_statement_lines" as any).insert({
        bank_account_id: selectedBank,
        statement_date: lineForm.statement_date,
        description: lineForm.description,
        reference: lineForm.reference,
        amount: parseFloat(lineForm.amount) || 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-lines", selectedBank] });
      toast({ title: "Línea agregada" });
      setLineDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Toggle reconciled
  const toggleReconciled = async (line: BankLine) => {
    const { error } = await supabase
      .from("bank_statement_lines" as any)
      .update({ is_reconciled: !line.is_reconciled } as any)
      .eq("id", line.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["bank-lines", selectedBank] });
  };

  // CSV Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBank) return;

    try {
      const text = await file.text();
      const rows = text.split("\n").filter(r => r.trim());
      if (rows.length < 2) throw new Error("El archivo CSV debe tener al menos una fila de encabezado y una de datos.");

      // Parse header - try to find date, description, amount columns
      const header = rows[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const dateIdx = header.findIndex(h => h.includes("fecha") || h.includes("date"));
      const descIdx = header.findIndex(h => h.includes("desc") || h.includes("concepto") || h.includes("detail"));
      const amtIdx = header.findIndex(h => h.includes("monto") || h.includes("amount") || h.includes("valor"));
      const refIdx = header.findIndex(h => h.includes("ref") || h.includes("doc") || h.includes("numero"));
      const balIdx = header.findIndex(h => h.includes("balance") || h.includes("saldo"));

      if (dateIdx === -1 || amtIdx === -1) {
        throw new Error("No se encontraron columnas de fecha y monto. Asegúrese de incluir columnas 'fecha' y 'monto'.");
      }

      const linesToInsert: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map(c => c.trim().replace(/"/g, ""));
        if (!cols[dateIdx]) continue;

        // Try to parse date
        let dateStr = cols[dateIdx];
        // Handle dd/mm/yyyy format
        if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          if (parts.length === 3 && parts[0].length <= 2) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }

        const amount = parseFloat(cols[amtIdx]?.replace(/[^0-9.-]/g, "")) || 0;
        if (amount === 0) continue;

        linesToInsert.push({
          bank_account_id: selectedBank,
          statement_date: dateStr,
          description: descIdx >= 0 ? cols[descIdx] : null,
          reference: refIdx >= 0 ? cols[refIdx] : null,
          amount,
          balance: balIdx >= 0 ? parseFloat(cols[balIdx]?.replace(/[^0-9.-]/g, "")) || null : null,
        });
      }

      if (linesToInsert.length === 0) throw new Error("No se encontraron líneas válidas en el archivo.");

      const { error } = await supabase.from("bank_statement_lines" as any).insert(linesToInsert as any);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["bank-lines", selectedBank] });
      toast({ title: "Importación exitosa", description: `Se importaron ${linesToInsert.length} líneas.` });
    } catch (err: any) {
      toast({ title: "Error de importación", description: err.message, variant: "destructive" });
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const openNewBank = () => {
    setBankForm({ account_name: "", bank_name: "", account_number: "", currency: "DOP" });
    setBankDialogOpen(true);
  };

  const openNewLine = () => {
    setLineForm({ statement_date: "", description: "", reference: "", amount: "" });
    setLineDialogOpen(true);
  };

  const fmtNum = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Seleccionar cuenta bancaria..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {bankAccounts.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={openNewBank}>
            <Plus className="h-4 w-4 mr-1" /> Cuenta
          </Button>
        </div>
        {selectedBank && (
          <div className="flex items-center gap-2">
            <Badge variant="default">{reconciledCount} conciliadas</Badge>
            <Badge variant="outline">{unreconciledCount} pendientes</Badge>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Importar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={openNewLine}>
              <Plus className="h-4 w-4 mr-1" /> Línea Manual
            </Button>
          </div>
        )}
      </div>

      {!selectedBank ? (
        <EmptyState
          icon={Landmark}
          title="Conciliación Bancaria"
          description="Seleccione o cree una cuenta bancaria para comenzar la conciliación."
          action={<Button onClick={openNewBank} size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Cuenta Bancaria</Button>}
        />
      ) : linesLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : bankLines.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin movimientos"
          description="Importe un estado de cuenta CSV o agregue líneas manualmente."
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankLines.map(line => (
                <TableRow key={line.id} className={line.is_reconciled ? "opacity-60" : ""}>
                  <TableCell>
                    <button onClick={() => toggleReconciled(line)} className="p-1 hover:bg-muted rounded">
                      {line.is_reconciled
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : <XCircle className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>
                  </TableCell>
                  <TableCell>{format(new Date(line.statement_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{line.description || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{line.reference || "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${line.amount < 0 ? "text-destructive" : ""}`}>
                    {fmtNum(line.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {line.balance != null ? fmtNum(line.balance) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={line.is_reconciled ? "default" : "outline"}>
                      {line.is_reconciled ? "Conciliada" : "Pendiente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bank Account Dialog */}
      {bankDialogOpen && (
        <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva Cuenta Bancaria</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Nombre de Cuenta</Label><Input value={bankForm.account_name} onChange={e => setBankForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Ej: Cuenta Corriente" /></div>
              <div><Label>Banco</Label><Input value={bankForm.bank_name} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Ej: BHD León" /></div>
              <div><Label>Número de Cuenta</Label><Input value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} /></div>
              <div>
                <Label>Moneda</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={bankForm.currency} onChange={e => setBankForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBankDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => createBankMutation.mutate()} disabled={createBankMutation.isPending || !bankForm.account_name || !bankForm.bank_name}>
                {createBankMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Line Dialog */}
      {lineDialogOpen && (
        <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Agregar Línea Manual</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Fecha</Label><Input type="date" value={lineForm.statement_date} onChange={e => setLineForm(f => ({ ...f, statement_date: e.target.value }))} /></div>
              <div><Label>Descripción</Label><Input value={lineForm.description} onChange={e => setLineForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Referencia</Label><Input value={lineForm.reference} onChange={e => setLineForm(f => ({ ...f, reference: e.target.value }))} /></div>
              <div><Label>Monto (+ depósito, - retiro)</Label><Input type="number" value={lineForm.amount} onChange={e => setLineForm(f => ({ ...f, amount: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLineDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addLineMutation.mutate()} disabled={addLineMutation.isPending || !lineForm.statement_date || !lineForm.amount}>
                {addLineMutation.isPending ? "Guardando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
