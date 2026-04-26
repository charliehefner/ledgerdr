import { useQuery } from "@tanstack/react-query";
import { Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

interface RuleApp {
  id: string;
  rule_id: string;
  applied_fields: Record<string, unknown> | null;
  applied_at: string;
  context: string | null;
  rule: {
    name: string;
    priority: number;
    description: string | null;
  } | null;
}

interface Props {
  transactionSourceId: string | null | undefined;
}

const FIELD_LABELS: Record<string, string> = {
  master_acct_code: "Cuenta de débito",
  manual_credit_account_code: "Cuenta de crédito",
  project_code: "Proyecto",
  cbs_code: "CBS",
  cost_center: "Centro de costo",
  append_note: "Nota",
};

/**
 * Phase 3: visibility for the accountant.
 *
 * Lazy-loads posting_rule_applications for a journal's source transaction
 * and renders nothing if none exist. When rules fired, shows a small
 * "Reglas (N)" badge that opens a popover detailing every rule that
 * matched. Detects same-field conflicts (multiple rules tried to set the
 * same field to different values) and elevates the badge to amber
 * "⚠ Conflicto".
 */
export function JournalRuleBadge({ transactionSourceId }: Props) {
  const { data: apps = [] } = useQuery({
    queryKey: ["posting_rule_applications", transactionSourceId],
    enabled: !!transactionSourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posting_rule_applications" as any)
        .select(`
          id, rule_id, applied_fields, applied_at, context,
          rule:posting_rules!posting_rule_applications_rule_id_fkey ( name, priority, description )
        `)
        .eq("transaction_id", transactionSourceId!)
        .order("applied_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RuleApp[];
    },
    staleTime: 60_000,
  });

  if (!transactionSourceId || apps.length === 0) return null;

  // Detect field-level conflicts across all matched rules.
  const fieldValues = new Map<string, Set<string>>();
  apps.forEach((a) => {
    const fields = (a.applied_fields || {}) as Record<string, unknown>;
    Object.entries(fields).forEach(([k, v]) => {
      if (v == null) return;
      if (!fieldValues.has(k)) fieldValues.set(k, new Set());
      fieldValues.get(k)!.add(String(v));
    });
  });
  const conflicts = Array.from(fieldValues.entries()).filter(
    ([, values]) => values.size > 1
  );
  const hasConflict = conflicts.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={
            hasConflict
              ? "text-[10px] px-1.5 cursor-pointer border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
              : "text-[10px] px-1.5 cursor-pointer border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
          }
          onClick={(e) => e.stopPropagation()}
        >
          {hasConflict ? (
            <AlertTriangle className="h-3 w-3 mr-0.5" />
          ) : (
            <Sparkles className="h-3 w-3 mr-0.5" />
          )}
          {hasConflict ? `Conflicto (${apps.length})` : `Reglas (${apps.length})`}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[420px] bg-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">¿Por qué estas cuentas?</h4>
            <p className="text-xs text-muted-foreground">
              Reglas de contabilización que se aplicaron a esta transacción al momento de su registro.
            </p>
          </div>

          {hasConflict && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              <div className="font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Conflicto detectado
              </div>
              <ul className="ml-4 list-disc">
                {conflicts.map(([field, values]) => (
                  <li key={field}>
                    {FIELD_LABELS[field] || field}:{" "}
                    {Array.from(values).map((v) => (
                      <code key={v} className="mx-0.5">{v}</code>
                    ))}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px]">
                La regla de menor prioridad ganó por campo. Edite las reglas en Configuración → Reglas Contab. para evitar futuros conflictos.
              </p>
            </div>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {apps.map((a) => {
              const fields = (a.applied_fields || {}) as Record<string, unknown>;
              const fieldEntries = Object.entries(fields).filter(([, v]) => v != null);
              return (
                <div key={a.id} className="rounded-md border border-border/60 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{a.rule?.name || "Regla eliminada"}</div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
                      Prio {a.rule?.priority ?? "—"}
                    </Badge>
                  </div>
                  {a.rule?.description && (
                    <div className="text-muted-foreground text-[11px] mt-0.5">{a.rule.description}</div>
                  )}
                  {fieldEntries.length > 0 ? (
                    <ul className="mt-1.5 ml-3 list-disc text-[11px] space-y-0.5">
                      {fieldEntries.map(([k, v]) => (
                        <li key={k}>
                          <span className="text-muted-foreground">{FIELD_LABELS[k] || k}:</span>{" "}
                          <code>{String(v)}</code>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground text-[11px] mt-1">
                      Coincidió pero no se aplicó ningún campo (otra regla de mayor prioridad ya los había llenado).
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(a.applied_at), "dd MMM yyyy HH:mm")}
                    {a.context ? ` · ${a.context}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
