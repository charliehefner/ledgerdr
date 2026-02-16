import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Route, Loader2 } from "lucide-react";

interface TrackHistoryControlsProps {
  onLoadTracks: (tractorId: string, dateFrom: string, dateTo: string) => void;
  onClearTracks: () => void;
  isLoading: boolean;
  hasActiveTracks: boolean;
}

export function TrackHistoryControls({
  onLoadTracks,
  onClearTracks,
  isLoading,
  hasActiveTracks,
}: TrackHistoryControlsProps) {
  const [tractorId, setTractorId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Only tractors with gpsgate_user_id linked
  const { data: tractors } = useQuery({
    queryKey: ["gps-tractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, gpsgate_user_id")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .not("gpsgate_user_id", "is", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const canLoad = tractorId && dateFrom && dateTo && !isLoading;

  if (!tractors || tractors.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border rounded-md px-3 py-2 bg-card">
      <Route className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        Recorrido GPS
      </span>

      <Select value={tractorId} onValueChange={setTractorId}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder="Tractor" />
        </SelectTrigger>
        <SelectContent>
          {tractors.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className="w-[150px] h-9 text-sm"
        placeholder="Desde"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className="w-[150px] h-9 text-sm"
        placeholder="Hasta"
      />

      <Button
        size="sm"
        disabled={!canLoad}
        onClick={() => onLoadTracks(tractorId, dateFrom, dateTo)}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : null}
        Ver Recorrido
      </Button>

      {hasActiveTracks && (
        <Button size="sm" variant="outline" onClick={onClearTracks}>
          Limpiar
        </Button>
      )}
    </div>
  );
}
