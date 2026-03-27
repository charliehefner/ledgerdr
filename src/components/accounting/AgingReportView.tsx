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

  // Fetch latest exchange rates for DOP conversion
  const { data: exchangeRates } = useQuery({
    queryKey: ["exchange-rates-latest-aging"],
    queryFn: async () => {
      const rates: Record<string, number> = { DOP: 1 };
      for (const pair of ["USD/DOP", "EUR/DOP"]) {
        const { data } = await supabase
          .from("exchange_rates")
          .select("sell_rate")
          .eq("currency_pair", pair)
          .order("rate_date", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const currency = pair.split("/")[0];
          rates[currency] = data[0].sell_rate;
        }
      }
      return rates;
    },
    staleTime: 1000 * 60 * 30,
  });

  const rates = exchangeRates || { DOP: 1, USD: 1, EUR: 1 };

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
        { key: "name", header: t("aging.col.name"), width: 24 },
        { key: "currency", header: t("aging.col.currency"), width: 8 },
        { key: "current", header: t("aging.col.current"), width: 14 },
        { key: "days30", header: t("aging.col.days30"), width: 14 },
        { key: "days60", header: t("aging.col.days60"), width: 14 },
        { key: "days90", header: t("aging.col.days90"), width: 14 },
        { key: "over90", header: t("aging.col.over90"), width: 14 },
        { key: "total", header: t("common.total"), width: 14 },
      ],
      rows: agingData,
      totalsRow: totalsByCurrency.length === 1
        ? { name: "TOTAL", currency: totalsByCurrency[0][0], ...totalsByCurrency[0][1] }
        : undefined,
    }, { filename: "aging_report", title: t("aging.title") });
  };

  const handleExportPDF = () => {
    exportToPDF({
      columns: [
        { key: "name", header: t("aging.col.name") },
        { key: "currency", header: t("aging.col.currency") },
        { key: "current", header: t("aging.col.current") },
        { key: "days30", header: t("aging.col.days30") },
        { key: "days60", header: t("aging.col.days60") },
        { key: "days90", header: t("aging.col.days90") },
        { key: "over90", header: t("aging.col.over90") },
        { key: "total", header: t("common.total") },
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
    }, { filename: "aging_report", title: t("aging.title") });
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
              <SelectItem value="both">{t("aging.all")}</SelectItem>
              <SelectItem value="payable">{t("aging.payable")}</SelectItem>
              <SelectItem value="receivable">{t("aging.receivable")}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {agingData.length} {t("aging.contactsWithBalance")}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm"><Download className="h-4 w-4 mr-1" /> {t("common.export")}</Button>
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
          title={t("aging.title")}
          description={t("aging.noDocuments")}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("aging.col.name")}</TableHead>
                <TableHead>{t("aging.col.currency")}</TableHead>
                <TableHead className="text-right">{t("aging.col.current")}</TableHead>
                <TableHead className="text-right">{t("aging.col.days30")}</TableHead>
                <TableHead className="text-right">{t("aging.col.days60")}</TableHead>
                <TableHead className="text-right">{t("aging.col.days90")}</TableHead>
                <TableHead className="text-right text-destructive">{t("aging.col.over90")}</TableHead>
                <TableHead className="text-right font-bold">{t("common.total")}</TableHead>
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
              {totalsByCurrency.length > 1 && (() => {
                const dopEquiv = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
                totalsByCurrency.forEach(([currency, totals]) => {
                  const r = rates[currency] || 1;
                  dopEquiv.current += totals.current * r;
                  dopEquiv.days30 += totals.days30 * r;
                  dopEquiv.days60 += totals.days60 * r;
                  dopEquiv.days90 += totals.days90 * r;
                  dopEquiv.over90 += totals.over90 * r;
                  dopEquiv.total += totals.total * r;
                });
                return (
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="text-right">TOTAL RD$ EQUIV.</TableCell>
                    <TableCell>DOP</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(dopEquiv.current)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(dopEquiv.days30)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(dopEquiv.days60)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(dopEquiv.days90)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{fmtNum(dopEquiv.over90)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(dopEquiv.total)}</TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
