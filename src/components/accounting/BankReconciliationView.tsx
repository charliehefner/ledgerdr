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
import { Plus, Upload, Landmark, CheckCircle2, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { QuickEntryDialog } from "./QuickEntryDialog";

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

/* ── OFX Parser ── */
interface ParsedOFXLine {
  statement_date: string;
  description: string | null;
  amount: number;
  reference: string | null;
  balance: number | null;
}

/* ── TXT Parser (BDI semicolon-delimited) ── */
function parseTXT(text: string): ParsedOFXLine[] {
  const rows = text.split("\n").filter(r => r.trim());
  if (rows.length < 2) return [];

  // Expected header: Fecha;Hora;Referencia;Codigo Transaccion;Descripcion;Monto;Tipo Operacion;
  const lines: ParsedOFXLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(";").map(c => c.trim());
    if (cols.length < 7 || !cols[0]) continue;

    // Parse date DD/MM/YY or DD/MM/YYYY
    const dateParts = cols[0].split("/");
    if (dateParts.length !== 3) continue;
    let year = dateParts[2];
    if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
    const dateStr = `${year}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`;

    const rawAmount = parseFloat(cols[5]?.replace(/[^0-9.-]/g, "")) || 0;
    if (rawAmount === 0) continue;

    // Tipo Operacion: D = debit (withdrawal), C = credit (deposit)
    const tipoOp = cols[6]?.toUpperCase();
    const amount = tipoOp === "D" ? -rawAmount : rawAmount;

    const description = cols[4] || null; // Descripcion
    const reference = cols[2] || null;   // Referencia

    lines.push({
      statement_date: dateStr,
      description,
      amount,
      reference,
      balance: null,
    });
  }
  return lines;
}

function parseOFX(text: string): { lines: ParsedOFXLine[]; bankId?: string; acctId?: string; ledgerBal?: number } {
  const extract = (tag: string, block: string) => {
    const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
    const m = block.match(re);
    return m ? m[1].trim() : null;
  };

  // Account metadata
  const bankId = extract("BANKID", text) ?? undefined;
  const acctId = extract("ACCTID", text) ?? undefined;
  const ledgerStr = extract("BALAMT", text);
  const ledgerBal = ledgerStr ? parseFloat(ledgerStr) : undefined;

  // Split transactions
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const lines: ParsedOFXLine[] = [];

  for (const block of blocks) {
    const endIdx = block.search(/<\/STMTTRN>/i);
    const txnBlock = endIdx > -1 ? block.substring(0, endIdx) : block;

    const dtRaw = extract("DTPOSTED", txnBlock);
    const amtRaw = extract("TRNAMT", txnBlock);
    const name = extract("NAME", txnBlock);
    const memo = extract("MEMO", txnBlock);
    const fitid = extract("FITID", txnBlock);

    if (!dtRaw || !amtRaw) continue;

    // Parse date YYYYMMDD[HHmmss]
    const dateStr = `${dtRaw.substring(0, 4)}-${dtRaw.substring(4, 6)}-${dtRaw.substring(6, 8)}`;
    const amount = parseFloat(amtRaw);
    if (isNaN(amount)) continue;

    const description = [name, memo].filter(Boolean).join(" — ") || null;

    lines.push({
      statement_date: dateStr,
      description,
      amount,
      reference: fitid,
      balance: null,
    });
  }

  return { lines, bankId, acctId, ledgerBal };
}

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
  const [quickEntryLine, setQuickEntryLine] = useState<BankLine | null>(null);

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
        .order("statement_date", { ascending: false })
        .limit(10000);
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
  const handleCSVImport = async (text: string) => {
    const rows = text.split("\n").filter(r => r.trim());
    if (rows.length < 2) throw new Error("El archivo CSV debe tener al menos una fila de encabezado y una de datos.");

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

      let dateStr = cols[dateIdx];
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

    return linesToInsert.length;
  };

  // OFX Import with deduplication
  const handleOFXImport = async (text: string) => {
    const { lines, bankId, acctId, ledgerBal } = parseOFX(text);
    if (lines.length === 0) throw new Error("No se encontraron transacciones en el archivo OFX.");

    // Fetch existing references for dedup
    const { data: existing } = await supabase
      .from("bank_statement_lines" as any)
      .select("reference")
      .eq("bank_account_id", selectedBank)
      .not("reference", "is", null) as any;

    const existingRefs = new Set((existing || []).map((r: any) => r.reference));
    const newLines = lines.filter(l => !l.reference || !existingRefs.has(l.reference));

    if (newLines.length === 0) {
      toast({ title: "Sin líneas nuevas", description: "Todas las transacciones ya fueron importadas." });
      return 0;
    }

    const linesToInsert = newLines.map(l => ({
      bank_account_id: selectedBank,
      ...l,
    }));

    const { error } = await supabase.from("bank_statement_lines" as any).insert(linesToInsert as any);
    if (error) throw error;

    const skipped = lines.length - newLines.length;
    const summary = [
      `${newLines.length} líneas importadas`,
      skipped > 0 ? `${skipped} duplicadas omitidas` : null,
      acctId ? `Cuenta: ${acctId}` : null,
      ledgerBal != null ? `Balance: ${ledgerBal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : null,
    ].filter(Boolean).join(". ");

    toast({ title: "Importación OFX exitosa", description: summary });
    return newLines.length;
  };

  // File import dispatcher
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBank) return;

    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();

      let count = 0;
      if (ext === "ofx") {
        count = (await handleOFXImport(text)) ?? 0;
      } else if (ext === "txt") {
        // TXT semicolon-delimited (BDI format)
        const parsed = parseTXT(text);
        if (parsed.length === 0) throw new Error("No se encontraron transacciones válidas en el archivo TXT.");

        // Dedup by reference
        const { data: existing } = await supabase
          .from("bank_statement_lines" as any)
          .select("reference")
          .eq("bank_account_id", selectedBank)
          .not("reference", "is", null) as any;
        const existingRefs = new Set((existing || []).map((r: any) => r.reference));
        const newLines = parsed.filter(l => !l.reference || !existingRefs.has(l.reference));

        if (newLines.length === 0) {
          toast({ title: "Sin líneas nuevas", description: "Todas las transacciones ya fueron importadas." });
        } else {
          const linesToInsert = newLines.map(l => ({ bank_account_id: selectedBank, ...l }));
          const { error } = await supabase.from("bank_statement_lines" as any).insert(linesToInsert as any);
          if (error) throw error;
          count = newLines.length;
          const skipped = parsed.length - newLines.length;
          toast({
            title: "Importación TXT exitosa",
            description: `${count} líneas importadas${skipped > 0 ? `, ${skipped} duplicadas omitidas` : ""}.`,
          });
        }
      } else {
        count = (await handleCSVImport(text)) ?? 0;
        if (count > 0) {
          toast({ title: "Importación exitosa", description: `Se importaron ${count} líneas.` });
        }
      }

      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ["bank-lines", selectedBank] });
      }
    } catch (err: any) {
      toast({ title: "Error de importación", description: err.message, variant: "destructive" });
    }

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
            <input ref={fileRef} type="file" accept=".csv,.ofx,.txt" className="hidden" onChange={handleFileImport} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Importar Estado
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
          description="Importe un estado de cuenta (CSV/OFX/TXT) o agregue líneas manualmente."
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
                <TableHead className="w-[100px]" />
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
                  <TableCell>
                    {!line.is_reconciled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setQuickEntryLine(line)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Crear Entrada
                      </Button>
                    )}
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
                  <option value="EUR">EUR</option>
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

      {/* Quick Entry Dialog */}
      {quickEntryLine && (
        <QuickEntryDialog
          open={!!quickEntryLine}
          onOpenChange={(v) => { if (!v) setQuickEntryLine(null); }}
          line={quickEntryLine}
          bankAccountId={selectedBank}
        />
      )}
    </div>
  );
}
