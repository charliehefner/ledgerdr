import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Download, FileSpreadsheet, FileText, Clock } from "lucide-react";
import { useExport } from "@/hooks/useExport";
import { useLanguage } from "@/contexts/LanguageContext";

type ApArDoc = {
  id: string;
  contact_name: string;
  due_date: string | null;
  document_date: string;
  balance_remaining: number;
  currency: string;
  direction: string;
  status: string;
};

type AgingBucket = {
  name: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
  currency: string;
};

function getDaysOverdue(dueDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function AgingReportView() {
  const { t } = useLanguage();
  const { exportToExcel, exportToPDF } = useExport();
  const [dirFilter, setDirFilter] = useState<string>("both");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["aging-ap-ar-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ap_ar_documents")
        .select("id, contact_name, due_date, document_date, balance_remaining, currency, direction, status")
        .not("status", "in", '("paid","void")')
        .order("due_date", { ascending: true })
        .limit(10000);
      if (error) throw error;
      return data as ApArDoc[];
    },
  });

  const filtered = useMemo(() =>
    dirFilter === "both" ? documents : documents.filter(d => d.direction === dirFilter),
    [documents, dirFilter]
  );

  const agingData = useMemo(() => {
    const byName = new Map<string, AgingBucket>();

    filtered.forEach(doc => {
      const key = `${doc.contact_name}_${doc.currency}`;
      if (!byName.has(key)) {
        byName.set(key, { name: doc.contact_name, current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0, currency: doc.currency });
      }
      const bucket = byName.get(key)!;
      const dueDate = doc.due_date || doc.document_date;
      const days = getDaysOverdue(dueDate);
      const amt = Math.abs(doc.balance_remaining);

      if (days <= 0) bucket.current += amt;
      else if (days <= 30) bucket.days30 += amt;
      else if (days <= 60) bucket.days60 += amt;
      else if (days <= 90) bucket.days90 += amt;
      else bucket.over90 += amt;
      bucket.total += amt;
    });

    return Array.from(byName.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalsByCurrency = useMemo(() => {
    const byCurr = new Map<string, { current: number; days30: number; days60: number; days90: number; over90: number; total: number }>();
    agingData.forEach(r => {
      const existing = byCurr.get(r.currency) || { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
      existing.current += r.current;
      existing.days30 += r.days30;
      existing.days60 += r.days60;
      existing.days90 += r.days90;
      existing.over90 += r.over90;
      existing.total += r.total;
      byCurr.set(r.currency, existing);
    });
    return Array.from(byCurr.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [agingData]);

  const fmtNum = (n: number) =>
    n !== 0 ? n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  const handleExportExcel = () => {
    exportToExcel({
      columns: [
        { key: "name", header: "Nombre", width: 24 },
        { key: "currency", header: "Moneda", width: 8 },
        { key: "current", header: "Vigente", width: 14 },
        { key: "days30", header: "1-30 días", width: 14 },
        { key: "days60", header: "31-60 días", width: 14 },
        { key: "days90", header: "61-90 días", width: 14 },
        { key: "over90", header: "+90 días", width: 14 },
        { key: "total", header: "Total", width: 14 },
      ],
      rows: agingData,
      totalsRow: totalsByCurrency.length === 1
        ? { name: "TOTAL", currency: totalsByCurrency[0][0], ...totalsByCurrency[0][1] }
        : undefined,
    }, { filename: "aging_report", title: "Antigüedad de Saldos" });
  };

  const handleExportPDF = () => {
    exportToPDF({
      columns: [
        { key: "name", header: "Nombre" },
        { key: "currency", header: "Moneda" },
        { key: "current", header: "Vigente" },
        { key: "days30", header: "1-30" },
        { key: "days60", header: "31-60" },
        { key: "days90", header: "61-90" },
        { key: "over90", header: "+90" },
        { key: "total", header: "Total" },
      ],
      rows: agingData.map(r => ({
        name: r.name,
        currency: r.currency,
        current: fmtNum(r.current),
        days30: fmtNum(r.days30),
        days60: fmtNum(r.days60),
        days90: fmtNum(r.days90),
        over90: fmtNum(r.over90),
        total: fmtNum(r.total),
      })),
    }, { filename: "aging_report", title: "Antigüedad de Saldos" });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Select value={dirFilter} onValueChange={setDirFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="both">Todos</SelectItem>
              <SelectItem value="payable">Cuentas por Pagar</SelectItem>
              <SelectItem value="receivable">Cuentas por Cobrar</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {agingData.length} contactos con saldos abiertos
          </span>
        </div>
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

      {agingData.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Antigüedad de Saldos"
          description="No hay documentos con saldos pendientes."
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Vigente</TableHead>
                <TableHead className="text-right">1-30 días</TableHead>
                <TableHead className="text-right">31-60 días</TableHead>
                <TableHead className="text-right">61-90 días</TableHead>
                <TableHead className="text-right text-destructive">+90 días</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agingData.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.current)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.days30)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.days60)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(r.days90)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmtNum(r.over90)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtNum(r.total)}</TableCell>
                </TableRow>
              ))}
              {totalsByCurrency.map(([currency, totals]) => (
                <TableRow key={`total-${currency}`} className="bg-muted/50 font-bold">
                  <TableCell className="text-right">TOTAL</TableCell>
                  <TableCell>{currency}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(totals.current)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(totals.days30)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(totals.days60)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(totals.days90)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmtNum(totals.over90)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(totals.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
