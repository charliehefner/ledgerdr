import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FieldHistoryPanelProps {
  fieldId: string;
  fieldName: string;
  farmName: string;
  hectares: number | null;
  onClose: () => void;
}

export function FieldHistoryPanel({
  fieldId,
  fieldName,
  farmName,
  hectares,
  onClose,
}: FieldHistoryPanelProps) {
  const { data: operations, isLoading } = useQuery({
    queryKey: ["field-history", fieldId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select(
          "id, operation_date, hectares_done, start_hours, end_hours, driver, operation_types(name, is_mechanical), fuel_equipment(name)"
        )
        .eq("field_id", fieldId)
        .order("operation_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      // Filter to mechanical only and take first 5
      return (data ?? [])
        .filter((op: any) => op.operation_types?.is_mechanical)
        .slice(0, 5);
    },
  });

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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
