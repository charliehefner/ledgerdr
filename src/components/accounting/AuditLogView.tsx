import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronDown, ChevronRight, Shield, Filter } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800 border-green-200",
  UPDATE: "bg-blue-100 text-blue-800 border-blue-200",
  DELETE: "bg-red-100 text-red-800 border-red-200",
};

const TABLE_OPTIONS = [
  "journals", "journal_lines", "chart_of_accounts", "accounting_periods",
  "transactions", "fixed_assets", "bank_accounts", "bank_statement_lines",
];

export function AuditLogView() {
  const { t } = useLanguage();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit-log", startDate, endDate, tableFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("accounting_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);
      if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditEntry[];
    },
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderJsonDiff = (oldVal: any, newVal: any) => {
    const allKeys = new Set([
      ...Object.keys(oldVal || {}),
      ...Object.keys(newVal || {}),
    ]);

    return (
      <div className="grid grid-cols-2 gap-4 text-xs font-mono max-h-64 overflow-auto">
        <div>
          <div className="font-semibold text-muted-foreground mb-1">{t("audit.oldValues")}</div>
          {oldVal ? (
            <div className="space-y-0.5">
              {[...allKeys].sort().map(key => {
                const changed = JSON.stringify(oldVal[key]) !== JSON.stringify(newVal?.[key]);
                return (
                  <div key={key} className={changed ? "bg-red-50 px-1 rounded" : ""}>
                    <span className="text-muted-foreground">{key}: </span>
                    <span>{JSON.stringify(oldVal[key]) ?? "null"}</span>
                  </div>
                );
              })}
            </div>
          ) : <span className="text-muted-foreground italic">—</span>}
        </div>
        <div>
          <div className="font-semibold text-muted-foreground mb-1">{t("audit.newValues")}</div>
          {newVal ? (
            <div className="space-y-0.5">
              {[...allKeys].sort().map(key => {
                const changed = JSON.stringify(oldVal?.[key]) !== JSON.stringify(newVal[key]);
                return (
                  <div key={key} className={changed ? "bg-green-50 px-1 rounded" : ""}>
                    <span className="text-muted-foreground">{key}: </span>
                    <span>{JSON.stringify(newVal[key]) ?? "null"}</span>
                  </div>
                );
              })}
            </div>
          ) : <span className="text-muted-foreground italic">—</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>{t("acctReport.startDate")}</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>{t("acctReport.endDate")}</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>{t("audit.table")}</Label>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {TABLE_OPTIONS.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("audit.action")}</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={t("audit.noEntries")}
          description={t("audit.noEntriesDesc")}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[160px]">{t("audit.timestamp")}</TableHead>
                <TableHead className="w-[100px]">{t("audit.action")}</TableHead>
                <TableHead className="w-[180px]">{t("audit.table")}</TableHead>
                <TableHead>{t("audit.recordId")}</TableHead>
                <TableHead className="w-[200px]">{t("audit.userId")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <>
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <TableCell>
                      {(entry.old_values || entry.new_values) && (
                        expanded.has(entry.id)
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {entry.created_at ? format(new Date(entry.created_at), "dd/MM/yyyy HH:mm:ss") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ACTION_COLORS[entry.action] || ""}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.table_name}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[200px]">
                      {entry.record_id || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[200px]">
                      {entry.user_id || "—"}
                    </TableCell>
                  </TableRow>
                  {expanded.has(entry.id) && (entry.old_values || entry.new_values) && (
                    <TableRow key={`${entry.id}-diff`}>
                      <TableCell colSpan={6} className="p-0">
                        <div className="bg-muted/30 px-6 py-3">
                          {renderJsonDiff(entry.old_values, entry.new_values)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
