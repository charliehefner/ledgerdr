import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Radio, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LivePosition {
  tractorId: string;
  tractorName: string;
  gpsName: string;
  lat: number;
  lng: number;
  speed: number;
  engineOn: boolean;
  lastUpdate: string;
}

interface LivePositionsControlProps {
  onPositionsLoaded: (positions: LivePosition[]) => void;
  onClear: () => void;
  isActive: boolean;
}

export function LivePositionsControl({
  onPositionsLoaded,
  onClear,
  isActive,
}: LivePositionsControlProps) {
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/gpsgate-proxy?action=live-positions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error ${res.status}`);
      }

      const positions: LivePosition[] = await res.json();
      if (positions.length === 0) {
        toast.info("No hay tractores con posición GPS activa");
        return;
      }

      onPositionsLoaded(positions);
      toast.success(`${positions.length} tractores localizados`);
    } catch (err: any) {
      console.error("Live positions error:", err);
      toast.error(err.message || "Error al cargar posiciones");
    } finally {
      setLoading(false);
    }
  }, [onPositionsLoaded]);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={isActive ? "default" : "outline"}
        onClick={isActive ? onClear : fetchPositions}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <X className="h-4 w-4" />
        ) : (
          <Radio className="h-4 w-4" />
        )}
        {isActive ? "Ocultar" : "Pos. en Vivo"}
      </Button>
    </div>
  );
}
