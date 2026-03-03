import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { BookOpen, ChevronDown, ChevronRight, Plus, Settings, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JournalDetailDialog } from "./JournalDetailDialog";
import { JournalEntryForm } from "./JournalEntryForm";
import { GenerateJournalsButton } from "./GenerateJournalsButton";
import { PaymentMethodMappingDialog } from "./PaymentMethodMappingDialog";
import { InfoTooltip } from "@/components/ui/info-tooltip";

type JournalLine = {
  id: string;
  debit: number | null;
  credit: number | null;
  account_id: string;
  cbs_code: string | null;
  project_code: string | null;
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);

  const { data: journals = [], isLoading } = useQuery({
    queryKey: ["journals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journals")
        .select(`
          id, journal_number, journal_date, description, currency, posted, posted_by, posted_at, transaction_source_id, journal_type,
          approval_status, approved_by, approved_at, rejection_reason, is_reconciled, reference_description,
          journal_lines (
            id, debit, credit, account_id, cbs_code, project_code,
            chart_of_accounts:account_id ( account_code, account_name )
          )
        `)
        .is("deleted_at", null)
        .order("journal_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Journal[];
    },
  });

  const filtered = journals.filter((j) => {
    if (statusFilter === "draft" && j.posted) return false;
    if (statusFilter === "posted" && !j.posted) return false;
    if (typeFilter !== "all" && (j as any).journal_type !== typeFilter) return false;
    return true;
  });

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

  /** Aggregate unique project/cbs codes from journal lines */
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
            <span className="text-xs font-medium text-muted-foreground mr-1">Estado:</span>
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
                {typeOptions.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-1">
            <InfoTooltip translationKey="help.generateJournals" />
            <GenerateJournalsButton userId={user?.id} />
            <Button size="sm" variant="ghost" onClick={() => setMappingOpen(true)} title="Configurar mapeo de métodos de pago">
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Asiento
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No hay asientos"
          description="Los asientos contables aparecerán aquí cuando se registren."
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[120px]">Número</TableHead>
                <TableHead className="w-[60px]">Tipo</TableHead>
                <TableHead className="w-[110px]">Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[100px]">Proyecto</TableHead>
                <TableHead className="w-[80px]">CBS</TableHead>
                <TableHead className="w-[120px]">Ref.</TableHead>
                <TableHead className="w-[80px]">Moneda</TableHead>
                <TableHead className="w-[50px]">Conc.</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((j) => {
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
                      <TableCell>{format(new Date(j.journal_date), "dd/MM/yyyy")}</TableCell>
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
                                  <th className="text-left py-1 font-medium">Cuenta</th>
                                  <th className="text-left py-1 font-medium">Nombre</th>
                                  <th className="text-left py-1 font-medium">Proyecto</th>
                                  <th className="text-left py-1 font-medium">CBS</th>
                                  <th className="text-right py-1 font-medium">Débito</th>
                                  <th className="text-right py-1 font-medium">Crédito</th>
                                </tr>
                              </thead>
                              <tbody>
                                {j.journal_lines.map((line) => (
                                  <tr key={line.id} className="border-t border-border/30">
                                    <td className="py-1 font-mono">
                                      {line.chart_of_accounts?.account_code || "—"}
                                    </td>
                                    <td className="py-1">{line.chart_of_accounts?.account_name || "—"}</td>
                                    <td className="py-1 text-xs">{line.project_code || ""}</td>
                                    <td className="py-1 text-xs">{line.cbs_code || ""}</td>
                                    <td className="py-1 text-right">{fmtNum(line.debit)}</td>
                                    <td className="py-1 text-right">{fmtNum(line.credit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t font-medium">
                                  <td colSpan={4} className="py-1 text-right">Totales</td>
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

      <JournalDetailDialog journal={selectedJournal} open={detailOpen} onOpenChange={setDetailOpen} />
      <JournalEntryForm open={newOpen} onOpenChange={setNewOpen} />
      <PaymentMethodMappingDialog open={mappingOpen} onOpenChange={setMappingOpen} />
    </div>
  );
}
