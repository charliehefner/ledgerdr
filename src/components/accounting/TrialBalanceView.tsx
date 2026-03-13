import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Download, FileSpreadsheet, FileText, Scale, Filter } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { UnlinkedTransactionsWarning } from "@/components/accounting/UnlinkedTransactionsWarning";
import { useExport } from "@/hooks/useExport";
import { formatCurrency } from "@/lib/formatters";

type TBRow = {
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit_base: number;
  total_credit_base: number;
  balance_base: number;
};

export function TrialBalanceView() {
  const { t } = useLanguage();
  const { exportToExcel, exportToPDF } = useExport();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedDates, setAppliedDates] = useState<{ start: string; end: string } | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["trial-balance", appliedDates],
    queryFn: async () => {
      if (!appliedDates) return [];
      const { data, error } = await supabase.rpc("trial_balance", {
        p_start: appliedDates.start || undefined,
        p_end: appliedDates.end || undefined,
      });
      if (error) throw error;
      return (data || []) as TBRow[];
    },
    enabled: !!appliedDates,
  });

  const filtered = useMemo(() => rows.filter(r =>
    r.total_debit_base !== 0 || r.total_credit_base !== 0 || r.balance_base !== 0
  ), [rows]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({
      debit: acc.debit + (r.total_debit_base || 0),
      credit: acc.credit + (r.total_credit_base || 0),
    }),
    { debit: 0, credit: 0 }
  ), [filtered]);

  const fmtNum = (n: number) =>
    n !== 0 ? n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  const handleGenerate = () => setAppliedDates({ start: startDate, end: endDate });

  const handleExportExcel = () => {
    const dateRange = [appliedDates?.start, appliedDates?.end].filter(Boolean).join("_");
    exportToExcel(
      {
        columns: [
          { key: "account_code", header: "Código", width: 14 },
          { key: "account_name", header: "Cuenta", width: 30 },
          { key: "account_type", header: "Tipo", width: 14 },
          { key: "total_debit_base", header: "Débito", width: 16 },
          { key: "total_credit_base", header: "Crédito", width: 16 },
          { key: "balance_base", header: "Saldo", width: 16 },
        ],
        rows: filtered.map(r => ({
          account_code: r.account_code,
          account_name: r.account_name,
          account_type: r.account_type,
          total_debit_base: r.total_debit_base || 0,
          total_credit_base: r.total_credit_base || 0,
          balance_base: r.balance_base || 0,
        })),
        totalsRow: {
          account_code: "",
          account_name: "TOTALES",
          account_type: "",
          total_debit_base: totals.debit,
          total_credit_base: totals.credit,
          balance_base: totals.debit - totals.credit,
        },
      },
      { filename: `balanza_comprobacion_${dateRange || "all"}`, title: "Balanza de Comprobación" }
    );
  };

  const handleExportPDF = () => {
    const dateRange = [appliedDates?.start, appliedDates?.end].filter(Boolean).join("_");
    exportToPDF(
      {
        columns: [
          { key: "account_code", header: "Código" },
          { key: "account_name", header: "Cuenta" },
          { key: "account_type", header: "Tipo" },
          { key: "total_debit_base", header: "Débito" },
          { key: "total_credit_base", header: "Crédito" },
          { key: "balance_base", header: "Saldo" },
        ],
        rows: filtered.map(r => ({
          account_code: r.account_code,
          account_name: r.account_name,
          account_type: r.account_type,
          total_debit_base: formatCurrency(r.total_debit_base || 0, "DOP"),
          total_credit_base: formatCurrency(r.total_credit_base || 0, "DOP"),
          balance_base: formatCurrency(r.balance_base || 0, "DOP"),
        })),
      },
      {
        filename: `balanza_comprobacion_${dateRange || "all"}`,
        title: "Balanza de Comprobación",
        subtitle: appliedDates ? `${appliedDates.start || "∞"} — ${appliedDates.end || "∞"}` : undefined,
      }
    );
  };

  if (!appliedDates) {
    return (
      <EmptyState
        icon={Scale}
        title="Balanza de Comprobación"
        description="Seleccione un rango de fechas para generar la balanza de comprobación."
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div>
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
              </div>
            </div>
            <Button onClick={handleGenerate}>
              <Filter className="h-4 w-4 mr-1" /> Generar
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 h-9" />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 h-9" />
          </div>
          <Button size="sm" onClick={handleGenerate} className="mt-4">
            <Filter className="h-4 w-4 mr-1" /> Generar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} cuentas</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm"><Download className="h-4 w-4 mr-1" /> Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover">
              <DropdownMenuItem onClick={handleExportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}><FileText className="mr-2 h-4 w-4" />PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <UnlinkedTransactionsWarning startDate={appliedDates?.start} endDate={appliedDates?.end} />

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No hay movimientos en el período seleccionado.</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.account_code}>
                  <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                  <TableCell>{r.account_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.account_type}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.total_debit_base || 0)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.total_credit_base || 0)}</TableCell>
                  <TableCell className={`text-right font-mono font-medium ${(r.balance_base || 0) < 0 ? "text-destructive" : ""}`}>
                    {fmtNum(r.balance_base || 0)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={3} className="text-right">TOTALES</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(totals.debit)}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(totals.credit)}</TableCell>
                <TableCell className={`text-right font-mono ${Math.abs(totals.debit - totals.credit) > 0.01 ? "text-destructive" : ""}`}>
                  {fmtNum(totals.debit - totals.credit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
