import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Clock, Gauge } from "lucide-react";

import { fmtDate } from "@/lib/dateUtils";

export function HourMeterSequenceView() {
  const { t } = useLanguage();
  const [selectedTractorId, setSelectedTractorId] = useState<string>("");

  const { data: tractors = [] } = useQuery({
    queryKey: ["tractors-for-horometer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["horometer-operations", selectedTractorId],
    enabled: !!selectedTractorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select(
          "id, operation_date, start_hours, end_hours, fields:fields!operations_field_id_fkey(name), operation_types:operation_types!operations_operation_type_id_fkey(name), driver"
        )
        .eq("tractor_id", selectedTractorId)
        .not("start_hours", "is", null)
        .not("end_hours", "is", null)
        .order("operation_date", { ascending: true })
        .order("start_hours", { ascending: true });
      if (error) throw error;
      return data as {
        id: string;
        operation_date: string;
        start_hours: number;
        end_hours: number;
        fields: { name: string } | null;
        operation_types: { name: string } | null;
        driver: string | null;
      }[];
    },
  });

  const { rows, totalGaps, totalGapHours } = useMemo(() => {
    let gapCount = 0;
    let gapHoursSum = 0;
    const computed = operations.map((op, i) => {
      const hoursWorked = op.end_hours - op.start_hours;
      let gap: number | null = null;
      if (i > 0) {
        const prev = operations[i - 1];
        gap = op.start_hours - prev.end_hours;
        if (Math.abs(gap) > 0.1) {
          gapCount++;
          gapHoursSum += Math.abs(gap);
        } else {
          gap = null;
        }
      }
      return { ...op, hoursWorked, gap };
    });
    return { rows: computed, totalGaps: gapCount, totalGapHours: gapHoursSum };
  }, [operations]);

  const selectedTractor = tractors.find((t) => t.id === selectedTractorId);

  return (
    <div className="space-y-4">
      {/* Tractor selector */}
      <div className="max-w-xs">
        <Select value={selectedTractorId} onValueChange={setSelectedTractorId}>
          <SelectTrigger>
            <SelectValue placeholder={t("hourMeter.selectTractor")} />
          </SelectTrigger>
          <SelectContent>
            {tractors.map((tr) => (
              <SelectItem key={tr.id} value={tr.id}>
                {tr.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {selectedTractorId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Gauge className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t("hourMeter.currentMeter")}</p>
                <p className="text-2xl font-bold">
                  {selectedTractor?.current_hour_meter?.toLocaleString() ?? "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">{t("hourMeter.gapsFound")}</p>
                <p className="text-2xl font-bold">{totalGaps}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t("hourMeter.totalGapHours")}</p>
                <p className="text-2xl font-bold">{totalGapHours.toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operations table */}
      {selectedTractorId && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-4 text-muted-foreground">{t("common.loading")}</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-muted-foreground">
                {t("hourMeter.noOperations")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("hourMeter.operation")}</TableHead>
                    <TableHead>{t("hourMeter.field")}</TableHead>
                    <TableHead>{t("hourMeter.operator")}</TableHead>
                    <TableHead className="text-right">{t("hourMeter.start")}</TableHead>
                    <TableHead className="text-right">{t("hourMeter.end")}</TableHead>
                    <TableHead className="text-right">{t("hourMeter.hours")}</TableHead>
                    <TableHead className="text-right">{t("hourMeter.gap")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {fmtDate(new Date(row.operation_date + "T12:00:00"))}
                      </TableCell>
                      <TableCell>{row.operation_types?.name ?? "—"}</TableCell>
                      <TableCell>{row.fields?.name ?? "—"}</TableCell>
                      <TableCell>{row.driver ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.start_hours.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.end_hours.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.hoursWorked.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.gap !== null ? (
                          <Badge
                            variant="destructive"
                            className={
                              Math.abs(row.gap) > 5
                                ? "bg-destructive"
                                : "bg-amber-500 text-white border-0"
                            }
                          >
                            {row.gap > 0 ? "+" : ""}
                            {row.gap.toFixed(1)}
                          </Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
