import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function IntercompanyView() {
  const { t } = useLanguage();
  const { selectedEntityId, entities } = useEntity();
  const [subTab, setSubTab] = useState("balances");

  // Get entity group
  const { data: entityGroup } = useQuery({
    queryKey: ["ic-entity-group", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const { data } = await supabase
        .from("entities")
        .select("entity_group_id")
        .eq("id", selectedEntityId)
        .maybeSingle();
      return data?.entity_group_id || null;
    },
    enabled: !!selectedEntityId,
  });

  // Fetch intercompany transactions for the group
  const { data: icTransactions = [], isLoading } = useQuery({
    queryKey: ["ic-transactions", entityGroup],
    queryFn: async () => {
      if (!entityGroup) return [];
      const { data, error } = await supabase
        .from("intercompany_transactions" as any)
        .select("*")
        .eq("group_id", entityGroup)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!entityGroup,
  });

  // Build entity name map
  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.code || e.name));
    return map;
  }, [entities]);

  // Compute net balances per entity pair (unsettled only)
  const netBalances = useMemo(() => {
    const pairMap = new Map<string, { sourceId: string; targetId: string; net: number }>();
    
    (icTransactions as any[])
      .filter((tx: any) => !tx.is_settled)
      .forEach((tx: any) => {
        const key = [tx.source_entity_id, tx.target_entity_id].sort().join("|");
        if (!pairMap.has(key)) {
          const [a, b] = [tx.source_entity_id, tx.target_entity_id].sort();
          pairMap.set(key, { sourceId: a, targetId: b, net: 0 });
        }
        const entry = pairMap.get(key)!;
        // source pays for target, so source is owed by target
        if (tx.source_entity_id === entry.sourceId) {
          entry.net += Number(tx.amount);
        } else {
          entry.net -= Number(tx.amount);
        }
      });

    return Array.from(pairMap.values()).filter(p => Math.abs(p.net) > 0.01);
  }, [icTransactions]);

  if (!entityGroup) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title={t("intercompany.tab")}
        description={t("intercompany.noGroup")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="balances">{t("intercompany.netBalances")}</TabsTrigger>
          <TabsTrigger value="transactions">{t("intercompany.transactions")}</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-4">
          {netBalances.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={t("intercompany.netBalances")}
              description={t("intercompany.noTransactionsDesc")}
            />
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("intercompany.payer")}</TableHead>
                    <TableHead>{t("intercompany.beneficiary")}</TableHead>
                    <TableHead className="text-right">{t("intercompany.netOwed")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {netBalances.map((pair, i) => {
                    const oweFrom = pair.net > 0 ? pair.targetId : pair.sourceId;
                    const oweTo = pair.net > 0 ? pair.sourceId : pair.targetId;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{entityMap.get(oweFrom) || oweFrom}</TableCell>
                        <TableCell>{entityMap.get(oweTo) || oweTo}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(Math.abs(pair.net), "DOP")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
          ) : (icTransactions as any[]).length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={t("intercompany.noTransactions")}
              description={t("intercompany.noTransactionsDesc")}
            />
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("intercompany.payer")}</TableHead>
                    <TableHead>{t("intercompany.beneficiary")}</TableHead>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.amount")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(icTransactions as any[]).map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{tx.transaction_date}</TableCell>
                      <TableCell>{entityMap.get(tx.source_entity_id) || tx.source_entity_id}</TableCell>
                      <TableCell>{entityMap.get(tx.target_entity_id) || tx.target_entity_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(tx.amount), tx.currency || "DOP")}</TableCell>
                      <TableCell>
                        <Badge variant={tx.is_settled ? "default" : "outline"}>
                          {tx.is_settled ? t("intercompany.settled") : t("intercompany.unsettled")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {t("intercompany.noTransactionsDesc")}
        </AlertDescription>
      </Alert>
    </div>
  );
}
