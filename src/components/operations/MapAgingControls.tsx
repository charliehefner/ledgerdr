import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Satellite, Layers, Maximize2, Minimize2 } from "lucide-react";

interface MapAgingControlsProps {
  style: "satellite" | "streets";
  onStyleToggle: () => void;
  agingOperationTypeId: string | null;
  onAgingOperationTypeChange: (id: string | null) => void;
  thresholdGreen: number;
  onThresholdGreenChange: (v: number) => void;
  thresholdRed: number;
  onThresholdRedChange: (v: number) => void;
  expanded?: boolean;
  onExpandToggle?: () => void;
}

export function MapAgingControls({
  style,
  onStyleToggle,
  agingOperationTypeId,
  onAgingOperationTypeChange,
  thresholdGreen,
  onThresholdGreenChange,
  thresholdRed,
  onThresholdRedChange,
  expanded,
  onExpandToggle,
}: MapAgingControlsProps) {
  const { data: operationTypes } = useQuery({
    queryKey: ["operation-types-for-aging"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Operation type selector */}
      <Select
        value={agingOperationTypeId ?? "none"}
        onValueChange={(v) =>
          onAgingOperationTypeChange(v === "none" ? null : v)
        }
      >
        <SelectTrigger className="w-[220px] h-9 text-sm">
          <SelectValue placeholder="Antigüedad por operación" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin filtro de antigüedad</SelectItem>
          {operationTypes?.map((ot) => (
            <SelectItem key={ot.id} value={ot.id}>
              {ot.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Threshold inputs – only visible when aging is active */}
      {agingOperationTypeId && (
        <>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">Verde hasta</span>
            <Input
              type="number"
              min={1}
              value={thresholdGreen}
              onChange={(e) => onThresholdGreenChange(Number(e.target.value) || 1)}
              className="w-16 h-9"
            />
            <span className="text-muted-foreground">días</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">Rojo desde</span>
            <Input
              type="number"
              min={thresholdGreen + 1}
              value={thresholdRed}
              onChange={(e) => onThresholdRedChange(Number(e.target.value) || thresholdGreen + 1)}
              className="w-16 h-9"
            />
            <span className="text-muted-foreground">días</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#22c55e" }} />
              0–{thresholdGreen}d
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#eab308" }} />
              {thresholdGreen}–{thresholdRed}d
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} />
              &gt;{thresholdRed}d
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#d1d5db" }} />
              Sin registro
            </span>
          </div>
        </>
      )}

      {/* Style toggle & expand – pushed to right */}
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onStyleToggle}
        >
          {style === "satellite" ? (
            <>
              <Layers className="h-4 w-4 mr-2" /> Streets
            </>
          ) : (
            <>
              <Satellite className="h-4 w-4 mr-2" /> Satellite
            </>
          )}
        </Button>
        {onExpandToggle && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={onExpandToggle}
            title={expanded ? "Minimizar" : "Pantalla completa"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
