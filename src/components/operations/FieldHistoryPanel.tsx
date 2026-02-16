import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { computeFieldMetrics, type FieldMetrics, type GPSTrackPoint } from "./utils";

interface FieldHistoryPanelProps {
  fieldId: string;
  fieldName: string;
  farmName: string;
  hectares: number | null;
  fieldBoundary?: any;
  onClose: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function FieldHistoryPanel({
  fieldId,
  fieldName,
  farmName,
  hectares,
  fieldBoundary,
  onClose,
}: FieldHistoryPanelProps) {
  const [metricsCache, setMetricsCache] = useState<Map<string, FieldMetrics>>(new Map());
  const [loadingMetrics, setLoadingMetrics] = useState<Set<string>>(new Set());

  const { data: operations, isLoading } = useQuery({
    queryKey: ["field-history", fieldId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select(
          "id, operation_date, hectares_done, start_hours, end_hours, driver, tractor_id, operation_types(name, is_mechanical), fuel_equipment(name)"
        )
        .eq("field_id", fieldId)
        .order("operation_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? [])
        .filter((op: any) => op.operation_types?.is_mechanical)
        .slice(0, 5);
    },
  });

  const handleLoadMetrics = useCallback(async (opId: string, tractorId: string, operationDate: string) => {
    if (metricsCache.has(opId) || !fieldBoundary) return;

    setLoadingMetrics((prev) => new Set(prev).add(opId));
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const dateStr = operationDate.split("T")[0];
      const isoFrom = `${dateStr}T00:00:00Z`;
      const isoTo = `${dateStr}T23:59:59Z`;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/gpsgate-proxy?action=tracks&tractorId=${tractorId}&dateFrom=${encodeURIComponent(isoFrom)}&dateTo=${encodeURIComponent(isoTo)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }

      const result = await res.json();
      // Flatten tracks
      let trackPoints: GPSTrackPoint[] = [];
      if (Array.isArray(result.tracks)) {
        if (result.tracks.length > 0 && result.tracks[0].lat !== undefined) {
          trackPoints = result.tracks;
        } else {
          trackPoints = result.tracks.flat();
        }
      }

      const metrics = computeFieldMetrics(trackPoints, fieldBoundary);
      setMetricsCache((prev) => new Map(prev).set(opId, metrics));
    } catch (err) {
      console.error("Error loading GPS metrics:", err);
    } finally {
      setLoadingMetrics((prev) => {
        const next = new Set(prev);
        next.delete(opId);
        return next;
      });
    }
  }, [metricsCache, fieldBoundary]);

  return (
    <div className="absolute top-0 right-0 z-10 w-80 h-full bg-card border-l shadow-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <div>
          <h3 className="font-semibold text-sm">{fieldName}</h3>
          <p className="text-xs text-muted-foreground">
            {farmName} · {hectares ? `${hectares} ha` : "—"}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Últimas operaciones mecánicas
        </h4>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : !operations || operations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin operaciones mecánicas registradas.
          </p>
        ) : (
          operations.map((op: any) => {
            const hours =
              op.start_hours != null && op.end_hours != null
                ? (op.end_hours - op.start_hours).toFixed(1)
                : null;
            const metrics = metricsCache.get(op.id);
            const isLoadingThis = loadingMetrics.has(op.id);
            const hasTractor = !!op.tractor_id;
            const hasBoundary = !!fieldBoundary;

            return (
              <div
                key={op.id}
                className="rounded-md border bg-background p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {op.operation_types?.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(op.operation_date + "T12:00:00"), "dd MMM yyyy", { locale: es })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {op.fuel_equipment?.name && (
                    <p>Tractor: {op.fuel_equipment.name}</p>
                  )}
                  {op.driver && <p>Operador: {op.driver}</p>}
                  <div className="flex gap-3">
                    {op.hectares_done != null && (
                      <span>{op.hectares_done} ha</span>
                    )}
                    {hours && <span>{hours} hrs</span>}
                  </div>
                </div>

                {/* GPS Metrics section */}
                {hasTractor && hasBoundary && !metrics && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 h-7 text-xs"
                    disabled={isLoadingThis}
                    onClick={() => handleLoadMetrics(op.id, op.tractor_id, op.operation_date)}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <BarChart3 className="h-3 w-3 mr-1" />
                    )}
                    {isLoadingThis ? "Cargando..." : "Ver métricas GPS"}
                  </Button>
                )}

                {metrics && (
                  <div className="mt-1.5 pt-1.5 border-t border-dashed text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>Viaje:</span>
                      <span className="font-medium text-foreground">{formatDuration(metrics.travelMinutes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>En campo:</span>
                      <span className="font-medium text-foreground">{formatDuration(metrics.fieldMinutes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiempo muerto:</span>
                      <span className="font-medium text-foreground">{formatDuration(metrics.downtimeMinutes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ha/hora en campo:</span>
                      <span className="font-medium text-foreground">
                        {metrics.fieldMinutes > 0 && op.hectares_done != null
                          ? (op.hectares_done / (metrics.fieldMinutes / 60)).toFixed(2)
                          : "—"} ha/h
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
