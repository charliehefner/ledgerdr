import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { Building2 } from "lucide-react";
import { format } from "date-fns";
import { useEntity } from "@/contexts/EntityContext";
import { ExportDropdown } from "./ExportDropdown";

const SECTIONS = [
  { type: "ASSET", label: "Assets", sign: 1 },
  { type: "LIABILITY", label: "Liabilities", sign: -1 },
  { type: "EQUITY", label: "Equity", sign: -1 },
] as const;

interface Props {
  entityId: string | null;
  isAllEntities: boolean;
}

export function BalanceSheetTab({ entityId, isAllEntities }: Props) {
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { entities } = useEntity();

  const { data, isLoading } = useQuery({
    queryKey: ["rpc_get_balance_sheet", asOfDate, entityId, isAllEntities],
    queryFn: async () => {
      if (isAllEntities) {
        const results: { entityName: string; entityId: string | null; data: any[] }[] = [];
        const { data: consData, error: consErr } = await (supabase.rpc as any)("get_balance_sheet", { p_as_of_date: asOfDate });
        if (consErr) throw consErr;
        results.push({ entityName: "Consolidated", entityId: null, data: (consData ?? []) as any[] });
        for (const ent of entities) {
          const { data: entData, error: entErr } = await (supabase.rpc as any)("get_balance_sheet", { p_as_of_date: asOfDate, p_entity_id: ent.id });
          if (entErr) throw entErr;
          results.push({ entityName: ent.name, entityId: ent.id, data: (entData ?? []) as any[] });
        }
        return results;
      } else {
        const { data: d, error } = await (supabase.rpc as any)("get_balance_sheet", {
          p_as_of_date: asOfDate,
          ...(entityId ? { p_entity_id: entityId } : {}),
        });
        if (error) throw error;
        return [{ entityName: "Current", entityId, data: (d ?? []) as any[] }];
      }
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  // Side-by-side consolidated
  if (isAllEntities && data && data.length > 1) {
    const accountMap = new Map<string, { account_code: string; account_name: string; account_type: string }>();
    data.forEach((d) => d.data.forEach((r: any) => {
      if (!accountMap.has(r.account_code)) accountMap.set(r.account_code, { account_code: r.account_code, account_name: r.account_name, account_type: r.account_type });
    }));
    const accounts = Array.from(accountMap.values()).sort((a, b) => a.account_code.localeCompare(b.account_code));

    const getBalance = (entityData: any[], code: string, sign: number) => {
      const row = entityData.find((r: any) => r.account_code === code);
      return (row?.balance ?? 0) * sign;
    };

    const sectionTotal = (entityData: any[], type: string, sign: number) =>
      entityData.filter((r: any) => r.account_type === type).reduce((s: number, r: any) => s + r.balance * sign, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-end gap-4">
          <div><Label className="text-xs">As of Date</Label><Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-44" /></div>
          <ExportDropdown
            config={{ filename: `BalanceSheet_${format(new Date(), "yyyyMM")}`, title: "Balance Sheet", subtitle: `As of ${asOfDate} (Consolidated)`, orientation: "landscape" }}
            getData={() => {
              const allRows: Record<string, string | number>[] = [];
              accounts.forEach((a) => {
                const section = SECTIONS.find((s) => s.type === a.account_type);
                const sign = section?.sign ?? 1;
                const row: Record<string, string | number> = { account_code: a.account_code, account_name: a.account_name, type: a.account_type };
                data!.forEach((d) => { row[d.entityName] = formatCurrency((d.data.find((r: any) => r.account_code === a.account_code)?.balance ?? 0) * sign, "DOP"); });
                allRows.push(row);
              });
              return {
                columns: [
                  { key: "account_code", header: "Account Code", width: 14 },
                  { key: "account_name", header: "Account Name", width: 30 },
                  { key: "type", header: "Type", width: 12 },
                  ...data!.map((d) => ({ key: d.entityName, header: d.entityName, width: 18 })),
                ],
                rows: allRows,
              };
            }}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                {data.map((d) => <TableHead key={d.entityId ?? "cons"} className="text-right">{d.entityName}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SECTIONS.map(({ type, label, sign }) => {
                const sectionAccounts = accounts.filter((a) => a.account_type === type);
                if (!sectionAccounts.length) return null;
                return (
                  <>
                    <TableRow key={`h-${type}`} className="bg-muted/30">
                      <TableCell colSpan={2 + data.length} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{label}</TableCell>
                    </TableRow>
                    {sectionAccounts.map((a) => (
                      <TableRow key={a.account_code}>
                        <TableCell className="font-mono text-sm">{a.account_code}</TableCell>
                        <TableCell>{a.account_name}</TableCell>
                        {data.map((d) => <TableCell key={d.entityId ?? "cons"} className="text-right">{formatCurrency(getBalance(d.data, a.account_code, sign), "DOP")}</TableCell>)}
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={2} className="font-bold">Total {label}</TableCell>
                      {data.map((d) => <TableCell key={d.entityId ?? "cons"} className="text-right font-bold">{formatCurrency(sectionTotal(d.data, type, sign), "DOP")}</TableCell>)}
                    </TableRow>
                  </>
                );
              })}
              <TableRow className="bg-primary/5 border-t-4">
                <TableCell colSpan={2} className="font-bold text-lg">Balance Check (A − L − E)</TableCell>
                {data.map((d) => {
                  const a = sectionTotal(d.data, "ASSET", 1);
                  const l = sectionTotal(d.data, "LIABILITY", -1);
                  const e = sectionTotal(d.data, "EQUITY", -1);
                  const check = a - l - e;
                  return (
                    <TableCell key={d.entityId ?? "cons"} className={`text-right font-bold text-lg ${Math.abs(check) < 0.01 ? "text-green-600" : "text-destructive"}`}>
                      {Math.abs(check) < 0.01 ? "✓ Balanced" : formatCurrency(check, "DOP")}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Single entity
  const singleData = data?.[0]?.data ?? [];
  const sectionTotals: Record<string, number> = {};
  SECTIONS.forEach(({ type, sign }) => {
    sectionTotals[type] = singleData.filter((r: any) => r.account_type === type).reduce((s: number, r: any) => s + r.balance * sign, 0);
  });
  const balanceCheck = (sectionTotals["ASSET"] ?? 0) - (sectionTotals["LIABILITY"] ?? 0) - (sectionTotals["EQUITY"] ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div><Label className="text-xs">As of Date</Label><Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-44" /></div>
        <ExportDropdown
          config={{ filename: `BalanceSheet_${format(new Date(), "yyyyMM")}`, title: "Balance Sheet", subtitle: `As of ${asOfDate}`, orientation: "portrait" }}
          getData={() => ({
            columns: [
              { key: "account_code", header: "Account Code", width: 14 },
              { key: "account_name", header: "Account Name", width: 30 },
              { key: "balance", header: "Balance (DOP)", width: 18 },
            ],
            rows: singleData.map((r: any) => {
              const section = SECTIONS.find((s) => s.type === r.account_type);
              return { account_code: r.account_code, account_name: r.account_name, balance: formatCurrency(r.balance * (section?.sign ?? 1), "DOP") };
            }),
          })}
        />
      </div>
      {!singleData.length ? (
        <EmptyState icon={Building2} title="No balance sheet data" description="No posted journal entries found." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">Balance (DOP)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SECTIONS.map(({ type, label, sign }) => {
              const rows = singleData.filter((r: any) => r.account_type === type);
              if (!rows.length) return null;
              return (
                <>
                  <TableRow key={`h-${type}`} className="bg-muted/30">
                    <TableCell colSpan={3} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{label}</TableCell>
                  </TableRow>
                  {rows.map((r: any) => (
                    <TableRow key={r.account_code}>
                      <TableCell className="font-mono text-sm">{r.account_code}</TableCell>
                      <TableCell>{r.account_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.balance * sign, "DOP")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={2} className="font-bold">Total {label}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(sectionTotals[type], "DOP")}</TableCell>
                  </TableRow>
                </>
              );
            })}
            <TableRow className="bg-primary/5 border-t-4">
              <TableCell colSpan={2} className="font-bold text-lg">Balance Check (A − L − E)</TableCell>
              <TableCell className={`text-right font-bold text-lg ${Math.abs(balanceCheck) < 0.01 ? "text-green-600" : "text-destructive"}`}>
                {Math.abs(balanceCheck) < 0.01 ? "✓ Balanced" : formatCurrency(balanceCheck, "DOP")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
