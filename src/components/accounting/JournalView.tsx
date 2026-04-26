import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BookOpen, ChevronDown, ChevronRight, Plus, FileText, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JournalDetailDialog } from "./JournalDetailDialog";
import { JournalRuleBadge } from "./JournalRuleBadge";
import { JournalEntryForm } from "./JournalEntryForm";
import { GenerateJournalsButton } from "./GenerateJournalsButton";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { usePagination } from "@/hooks/usePagination";
import { useExport } from "@/hooks/useExport";

import { fmtDate } from "@/lib/dateUtils";

type JournalLine = {
  id: string;
  debit: number | null;
  credit: number | null;
  account_id: string;
  cbs_code: string | null;
  project_code: string | null;
  description: string | null;
  chart_of_accounts: { account_code: string; account_name: string } | null;
};

type Journal = {
  id: string;
  journal_number: string | null;
  journal_date: string;
  description: string | null;
  currency: string | null;
  posted: boolean | null;
  posted_by: string | null;
  posted_at: string | null;
  transaction_source_id: string | null;
  journal_lines: JournalLine[];
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  is_reconciled: boolean | null;
  reference_description: string | null;
};

type StatusFilter = "all" | "draft" | "posted";
type TypeFilter = "all" | "GJ" | "PJ" | "SJ" | "PRJ" | "CDJ" | "CRJ" | "DEP" | "RJ" | "CLJ";

export function JournalView() {
  const { t } = useLanguage();
  const { canWriteSection, user } = useAuth();
  const canWrite = canWriteSection("accounting");
  const { exportToExcel, exportToPDF } = useExport();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  // Date range filter — default to current month
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const { data: journals = [], isLoading } = useQuery({
    queryKey: ["journals", dateFrom, dateTo],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let offset = 0;
      let keepFetching = true;

      while (keepFetching) {
        let query = supabase
          .from("journals")
          .select(`
            id, journal_number, journal_date, description, currency, posted, posted_by, posted_at, transaction_source_id, journal_type,
            approval_status, approved_by, approved_at, rejection_reason, is_reconciled, reference_description,
            journal_lines (
              id, debit, credit, account_id, cbs_code, project_code, description,
              chart_of_accounts:chart_of_accounts!journal_lines_account_id_fkey ( account_code, account_name )
            )
          `)
          .is("deleted_at", null)
          .gte("journal_date", dateFrom)
          .lte("journal_date", dateTo)
          .order("journal_date", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        const { data, error } = await query;
        if (error) throw error;

        allRows = allRows.concat(data || []);
        if (!data || data.length < PAGE_SIZE) {
          keepFetching = false;
        } else {
          offset += PAGE_SIZE;
        }
      }

      return allRows as Journal[];
    },
  });

  const filtered = useMemo(() => journals.filter((j) => {
    if (statusFilter === "draft" && j.posted) return false;
    if (statusFilter === "posted" && !j.posted) return false;
    if (typeFilter !== "all" && (j as any).journal_type !== typeFilter) return false;
    return true;
  }), [journals, statusFilter, typeFilter]);

  const pagination = usePagination(filtered, { defaultPageSize: 50 });

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = (j: Journal) => {
    setSelectedJournal(j);
    setDetailOpen(true);
  };

  const fmtNum = (n: number | null) =>
    n ? n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  // ---- Export logic ----
  const handleExport = (type: "excel" | "pdf") => {
    const exportRows: Record<string, string | number>[] = [];
    filtered.forEach((j) => {
      j.journal_lines.forEach((line) => {
        exportRows.push({
          numero: j.journal_number || "—",
          tipo: (j as any).journal_type || "GJ",
          fecha: fmtDate(new Date(j.journal_date)),
          descripcion: j.description || "",
          cuenta: line.chart_of_accounts?.account_code || "",
          nombre_cuenta: line.chart_of_accounts?.account_name || "",
          proyecto: line.project_code || "",
          cbs: line.cbs_code || "",
          detalle_linea: line.description || "",
          moneda: j.currency || "DOP",
          debito: line.debit || 0,
          credito: line.credit || 0,
          estado: j.posted ? t("accounting.export.posted") : t("accounting.export.draftStatus"),
        });
      });
    });

    const columns = [
      { key: "numero", header: t("accounting.export.number"), width: 14 },
      { key: "tipo", header: t("accounting.export.type"), width: 8 },
      { key: "fecha", header: t("accounting.export.date"), width: 12 },
      { key: "descripcion", header: t("accounting.export.description"), width: 28 },
      { key: "cuenta", header: t("accounting.export.account"), width: 12 },
      { key: "nombre_cuenta", header: t("accounting.export.accountName"), width: 24 },
      { key: "proyecto", header: t("accounting.export.project"), width: 10 },
      { key: "cbs", header: t("accounting.export.cbs"), width: 10 },
      { key: "detalle_linea", header: t("accounting.export.lineDetail"), width: 22 },
      { key: "moneda", header: t("accounting.export.currency"), width: 8 },
      { key: "debito", header: t("accounting.export.debit"), width: 14 },
      { key: "credito", header: t("accounting.export.credit"), width: 14 },
      { key: "estado", header: t("accounting.export.status"), width: 14 },
    ];

    const config = {
      filename: `diario_contable_${dateFrom}_${dateTo}`,
      title: t("accounting.export.title"),
      subtitle: t("accounting.export.period").replace("{start}", fmtDate(new Date(dateFrom))).replace("{end}", fmtDate(new Date(dateTo))),
      orientation: "landscape" as const,
      fontSize: 7,
    };

    if (type === "excel") {
      exportToExcel({ columns, rows: exportRows }, config);
    } else {
      exportToPDF({ columns, rows: exportRows }, config);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  const statusButtons: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("accounting.statusAll") },
    { key: "draft", label: t("accounting.statusDraft") },
    { key: "posted", label: t("accounting.statusPosted") },
  ];

  const typeOptions: { key: TypeFilter; label: string }[] = [
    { key: "all", label: t("accounting.allTypes") },
    { key: "GJ", label: t("accounting.type.GJ") },
    { key: "PJ", label: t("accounting.type.PJ") },
    { key: "SJ", label: t("accounting.type.SJ") },
    { key: "PRJ", label: t("accounting.type.PRJ") },
    { key: "CDJ", label: t("accounting.type.CDJ") },
    { key: "CRJ", label: t("accounting.type.CRJ") },
    { key: "DEP", label: t("accounting.type.DEP") },
    { key: "RJ", label: t("accounting.type.RJ") },
    { key: "CLJ", label: t("accounting.type.CLJ") },
  ];

  const getAggregated = (lines: JournalLine[], field: "project_code" | "cbs_code") => {
    const values = [...new Set(lines.map(l => l[field]).filter(Boolean))] as string[];
    return values.length > 0 ? values.join(", ") : "";
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("accounting.from")}</Label>
            <Input type="date" className="h-8 w-[140px] text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("accounting.to")}</Label>
            <Input type="date" className="h-8 w-[140px] text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-1">{t("accounting.statusLabel")}</span>
            {statusButtons.map((f) => (
              <Button
                key={f.key}
                variant={statusFilter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-1">{t("accounting.journalType")}</span>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="h-8 w-[180px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" /> {t("accounting.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover">
              <DropdownMenuItem onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canWrite && (
            <>
              <InfoTooltip translationKey="help.generateJournals" />
              <GenerateJournalsButton userId={user?.id} />
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t("accounting.newEntry")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Record count */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} {t("accounting.entriesFound").replace("{page}", String(pagination.page + 1)).replace("{total}", String(pagination.totalPages))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("accounting.noEntries")}
          description={t("accounting.noEntriesDesc")}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[120px]">{t("accounting.col.number")}</TableHead>
                <TableHead className="w-[60px]">{t("accounting.col.type")}</TableHead>
                <TableHead className="w-[110px]">{t("accounting.col.date")}</TableHead>
                <TableHead>{t("accounting.col.description")}</TableHead>
                <TableHead className="w-[100px]">{t("accounting.col.project")}</TableHead>
                <TableHead className="w-[80px]">{t("accounting.col.cbs")}</TableHead>
                <TableHead className="w-[120px]">{t("accounting.col.ref")}</TableHead>
                <TableHead className="w-[80px]">{t("accounting.col.currency")}</TableHead>
                <TableHead className="w-[50px]">{t("accounting.col.reconciled")}</TableHead>
                <TableHead className="w-[100px]">{t("accounting.col.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.pageData.map((j) => {
                const totalDebit = j.journal_lines.reduce((s, l) => s + (l.debit || 0), 0);
                const totalCredit = j.journal_lines.reduce((s, l) => s + (l.credit || 0), 0);
                const projectCodes = getAggregated(j.journal_lines, "project_code");
                const cbsCodes = getAggregated(j.journal_lines, "cbs_code");

                return (
                  <React.Fragment key={j.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(j)}
                    >
                      <TableCell onClick={(e) => toggleExpand(e, j.id)}>
                        {j.journal_lines.length > 0 &&
                          (expanded.has(j.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          ))}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{j.journal_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{(j as any).journal_type || "GJ"}</Badge>
                      </TableCell>
                      <TableCell>{fmtDate(new Date(j.journal_date))}</TableCell>
                      <TableCell>{j.description || "—"}</TableCell>
                      <TableCell className="text-xs">{projectCodes || "—"}</TableCell>
                      <TableCell className="text-xs">{cbsCodes || "—"}</TableCell>
                      <TableCell className="text-xs">{j.reference_description || "—"}</TableCell>
                      <TableCell>{j.currency || "DOP"}</TableCell>
                      <TableCell>
                        {j.is_reconciled && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={j.posted ? "default" : "outline"}>
                            {j.posted ? t("accounting.statusPosted") : t("accounting.statusDraft")}
                          </Badge>
                          {!j.posted && (
                            <Badge variant="outline" className={
                              j.approval_status === "approved" ? "bg-green-100 text-green-800 border-green-200" :
                              j.approval_status === "rejected" ? "bg-red-100 text-red-800 border-red-200" :
                              "bg-yellow-100 text-yellow-800 border-yellow-200"
                            }>
                              {t(`accounting.approval${j.approval_status.charAt(0).toUpperCase() + j.approval_status.slice(1)}`)}
                            </Badge>
                          )}
                          {j.transaction_source_id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              <FileText className="h-3 w-3 mr-0.5" />Txn
                            </Badge>
                          )}
                          <JournalRuleBadge transactionSourceId={j.transaction_source_id} />
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded.has(j.id) && j.journal_lines.length > 0 && (
                      <TableRow key={`${j.id}-lines`}>
                        <TableCell colSpan={11} className="p-0">
                          <div className="bg-muted/30 px-8 py-3">
                            <table className="w-full text-sm">
                              <thead>
                                 <tr className="text-muted-foreground">
                                   <th className="text-left py-1 font-medium">{t("accounting.col.account")}</th>
                                   <th className="text-left py-1 font-medium">{t("accounting.col.accountName")}</th>
                                   <th className="text-left py-1 font-medium">{t("accounting.col.description")}</th>
                                   <th className="text-left py-1 font-medium">{t("accounting.col.project")}</th>
                                   <th className="text-left py-1 font-medium">{t("accounting.col.cbs")}</th>
                                   <th className="text-right py-1 font-medium">{t("accounting.col.debit")}</th>
                                   <th className="text-right py-1 font-medium">{t("accounting.col.credit")}</th>
                                 </tr>
                              </thead>
                              <tbody>
                                {j.journal_lines.map((line) => (
                                  <tr key={line.id} className="border-t border-border/30">
                                    <td className="py-1 font-mono">
                                      {line.chart_of_accounts?.account_code || "—"}
                                    </td>
                                    <td className="py-1">{line.chart_of_accounts?.account_name || "—"}</td>
                                    <td className="py-1 text-xs">{line.description || ""}</td>
                                    <td className="py-1 text-xs">{line.project_code || ""}</td>
                                    <td className="py-1 text-xs">{line.cbs_code || ""}</td>
                                    <td className="py-1 text-right">{fmtNum(line.debit)}</td>
                                    <td className="py-1 text-right">{fmtNum(line.credit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t font-medium">
                                  <td colSpan={5} className="py-1 text-right">{t("accounting.totals")}</td>
                                  <td className="py-1 text-right">{fmtNum(totalDebit)}</td>
                                  <td className="py-1 text-right">{fmtNum(totalCredit)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination controls */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("accounting.rowsPerPage")}</span>
            <Select value={String(pagination.pageSize)} onValueChange={(v) => pagination.setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[80px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pagination.pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!pagination.hasPrevPage} onClick={pagination.prevPage}>
              {t("accounting.previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("accounting.page").replace("{page}", String(pagination.page + 1)).replace("{total}", String(pagination.totalPages))}
            </span>
            <Button size="sm" variant="outline" disabled={!pagination.hasNextPage} onClick={pagination.nextPage}>
              {t("accounting.next")}
            </Button>
          </div>
        </div>
      )}

      <JournalDetailDialog journal={selectedJournal} open={detailOpen} onOpenChange={setDetailOpen} />
      <JournalEntryForm open={newOpen} onOpenChange={setNewOpen} />
      
    </div>
  );
}
