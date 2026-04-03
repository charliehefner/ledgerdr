import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/formatters";
import { BarChart3 } from "lucide-react";

const BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"] as const;

interface Props {
  entityId: string | null;
  isAllEntities: boolean;
}

export function AgingReportTab({ entityId, isAllEntities }: Props) {
  const [direction, setDirection] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["v_ap_ar_aging", entityId, isAllEntities],
    queryFn: async () => {
      let query = supabase.from("v_ap_ar_aging").select("*");
      if (!isAllEntities && entityId) {
        query = query.eq("entity_id", entityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = data?.filter((d) => direction === "all" || d.direction === direction) ?? [];

  const bucketSums = (dir: string) =>
    BUCKETS.map((bucket) => ({
      bucket,
      total: filtered
        .filter((r) => r.direction === dir && r.aging_bucket === bucket)
        .reduce((s, r) => s + ((r as any).balance_remaining ?? (r.total_amount ?? 0) - ((r as any).amount_paid ?? 0)), 0),
    }));

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState icon={BarChart3} title="No aging data" description="No open AP/AR documents found." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="payable">Payable</SelectItem>
            <SelectItem value="receivable">Receivable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(direction === "all" ? ["payable", "receivable"] : [direction]).map((dir) => (
        <Card key={dir}>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-3 capitalize">{dir}</h3>
            <div className="grid grid-cols-5 gap-3">
              {bucketSums(dir).map((b) => (
                <div key={b.bucket} className="rounded-md bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">{b.bucket}</p>
                  <p className="text-sm font-medium">{formatCurrency(b.total, "DOP")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Table>
        <TableHeader>
          <TableRow>
            {isAllEntities && <TableHead>Entity</TableHead>}
            <TableHead>Direction</TableHead>
            <TableHead>Doc #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Bucket</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              {isAllEntities && <TableCell className="font-medium">{r.entity_name ?? "-"}</TableCell>}
              <TableCell className="capitalize">{r.direction}</TableCell>
              <TableCell>{r.document_number ?? "-"}</TableCell>
              <TableCell>{r.document_date}</TableCell>
              <TableCell>{r.due_date ?? "-"}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.total_amount ?? 0, r.currency ?? "DOP")}</TableCell>
              <TableCell>{r.currency}</TableCell>
              <TableCell>{r.aging_bucket}</TableCell>
              <TableCell className="text-right">{r.days_overdue ?? 0}</TableCell>
              <TableCell className="capitalize">{r.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
