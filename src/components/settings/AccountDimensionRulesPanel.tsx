import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useActiveDimensions } from "@/components/accounting/DimensionPicker";

type Requirement = "optional" | "required" | "blocked";

interface Rule {
  id: string;
  account_id: string;
  dimension_id: string;
  requirement: Requirement;
}

interface Account {
  id: string;
  account_code: string;
  account_name: string;
}

const REQ_LABELS: Record<Requirement, { es: string; en: string; cls: string }> = {
  optional: { es: "Opcional", en: "Optional", cls: "bg-muted text-muted-foreground" },
  required: { es: "Requerida", en: "Required", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  blocked: { es: "Bloqueada", en: "Blocked", cls: "bg-red-100 text-red-800 border-red-200" },
};

export function AccountDimensionRulesPanel() {
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: dims } = useActiveDimensions();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["coa_posting_for_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const { data: rules = [] } = useQuery<Rule[]>({
    queryKey: ["account_dim_rules", selectedAccountId],
    enabled: !!selectedAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_dimension_rules" as any)
        .select("id, account_id, dimension_id, requirement")
        .eq("account_id", selectedAccountId!);
      if (error) throw error;
      return (data ?? []) as unknown as Rule[];
    },
  });

  const upsertRule = useMutation({
    mutationFn: async ({ dimension_id, requirement }: { dimension_id: string; requirement: Requirement }) => {
      if (!selectedAccountId) return;
      const existing = rules.find((r) => r.dimension_id === dimension_id);
      if (existing) {
        const { error } = await supabase
          .from("account_dimension_rules" as any)
          .update({ requirement } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("account_dimension_rules" as any)
          .insert({ account_id: selectedAccountId, dimension_id, requirement } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account_dim_rules", selectedAccountId] });
      toast({ title: language === "en" ? "Rule saved" : "Regla guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_dimension_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account_dim_rules", selectedAccountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q ? accounts : accounts.filter(
      (a) => a.account_code.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q)
    );
    return list.slice(0, 200);
  }, [accounts, search]);

  const ruleFor = (dimId: string) => rules.find((r) => r.dimension_id === dimId);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">
          {language === "en" ? "Account dimension rules" : "Reglas de dimensión por cuenta"}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Input
            placeholder={language === "en" ? "Search account…" : "Buscar cuenta…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="border rounded-md max-h-72 overflow-auto">
            {filteredAccounts.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => setSelectedAccountId(a.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/50 ${
                  selectedAccountId === a.id ? "bg-primary/10" : ""
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground">{a.account_code}</span>
                <span className="ml-2">{a.account_name}</span>
              </button>
            ))}
            {filteredAccounts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {language === "en" ? "No accounts" : "Sin cuentas"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {!selectedAccountId ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {language === "en" ? "Select an account to manage rules." : "Selecciona una cuenta para gestionar reglas."}
            </p>
          ) : (
            <div className="space-y-2">
              {(dims?.dimensions ?? []).map((d) => {
                const existing = ruleFor(d.id);
                const value = existing?.requirement ?? "optional";
                return (
                  <div key={d.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {language === "en" ? d.name_en : d.name_es}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{d.code}</div>
                    </div>
                    {existing && (
                      <Badge variant="outline" className={REQ_LABELS[existing.requirement].cls}>
                        {language === "en" ? REQ_LABELS[existing.requirement].en : REQ_LABELS[existing.requirement].es}
                      </Badge>
                    )}
                    <Select
                      value={value}
                      onValueChange={(v) => upsertRule.mutate({ dimension_id: d.id, requirement: v as Requirement })}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optional">{language === "en" ? "Optional" : "Opcional"}</SelectItem>
                        <SelectItem value="required">{language === "en" ? "Required" : "Requerida"}</SelectItem>
                        <SelectItem value="blocked">{language === "en" ? "Blocked" : "Bloqueada"}</SelectItem>
                      </SelectContent>
                    </Select>
                    {existing && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRule.mutate(existing.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {(dims?.dimensions.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {language === "en" ? "Create a dimension first." : "Crea una dimensión primero."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
