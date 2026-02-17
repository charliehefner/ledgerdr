import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  journal_lines: JournalLine[];
};

export function JournalView() {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: journals = [], isLoading } = useQuery({
    queryKey: ["journals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journals")
        .select(`
          id, journal_number, journal_date, description, currency, posted,
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

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  if (journals.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No hay asientos"
        description="Los asientos contables aparecerán aquí cuando se registren."
      />
    );
  }

  const fmtNum = (n: number | null) => n ? n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead className="w-[120px]">Número</TableHead>
            <TableHead className="w-[110px]">Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="w-[80px]">Moneda</TableHead>
            <TableHead className="w-[100px]">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {journals.map(j => (
            <>
              <TableRow key={j.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(j.id)}>
                <TableCell>
                  {j.journal_lines.length > 0 && (
                    expanded.has(j.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{j.journal_number || "—"}</TableCell>
                <TableCell>{format(new Date(j.journal_date), "dd/MM/yyyy")}</TableCell>
                <TableCell>{j.description || "—"}</TableCell>
                <TableCell>{j.currency || "DOP"}</TableCell>
                <TableCell>
                  <Badge variant={j.posted ? "default" : "outline"}>
                    {j.posted ? "Publicado" : "Borrador"}
                  </Badge>
                </TableCell>
              </TableRow>
              {expanded.has(j.id) && j.journal_lines.length > 0 && (
                <TableRow key={`${j.id}-lines`}>
                  <TableCell colSpan={6} className="p-0">
                    <div className="bg-muted/30 px-8 py-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left py-1 font-medium">Cuenta</th>
                            <th className="text-left py-1 font-medium">Nombre</th>
                            <th className="text-right py-1 font-medium">Débito</th>
                            <th className="text-right py-1 font-medium">Crédito</th>
                          </tr>
                        </thead>
                        <tbody>
                          {j.journal_lines.map(line => (
                            <tr key={line.id} className="border-t border-border/30">
                              <td className="py-1 font-mono">{line.chart_of_accounts?.account_code || "—"}</td>
                              <td className="py-1">{line.chart_of_accounts?.account_name || "—"}</td>
                              <td className="py-1 text-right">{fmtNum(line.debit)}</td>
                              <td className="py-1 text-right">{fmtNum(line.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
