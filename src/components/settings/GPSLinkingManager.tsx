import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Satellite, Loader2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";

interface GpsAsset {
  id: number;
  name: string;
  description?: string;
}

export function GPSLinkingManager() {
  const queryClient = useQueryClient();
  const [gpsAssets, setGpsAssets] = useState<GpsAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Fetch tractors (exclude non-GPS equipment like Contrato, Drone)
  const NON_GPS_NAMES = ["Contrato", "Drone"];
  const { data: tractors, isLoading } = useQuery({
    queryKey: ["tractors-for-gps-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, gpsgate_user_id")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      // Filter out non-GPS equipment
      return (data ?? []).filter((t) => !NON_GPS_NAMES.includes(t.name));
    },
  });

  // Fetch GPSGate assets
  const fetchGpsAssets = async () => {
    setLoadingAssets(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/gpsgate-proxy?action=list-assets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      // GPSGate returns array of user objects
      const assets: GpsAsset[] = (Array.isArray(data) ? data : []).map(
        (u: any) => ({
          id: u.id ?? u.Id,
          name: u.name ?? u.Name ?? `Device ${u.id ?? u.Id}`,
          description: u.description ?? u.Description ?? "",
        })
      );
      setGpsAssets(assets);
      toast.success(`${assets.length} dispositivos GPS encontrados`);
    } catch (err: any) {
      console.error("Fetch GPS assets error:", err);
      toast.error(err.message || "Error al cargar dispositivos GPS");
    } finally {
      setLoadingAssets(false);
    }
  };

  // Link/unlink mutation
  const linkMutation = useMutation({
    mutationFn: async ({
      tractorId,
      gpsUserId,
    }: {
      tractorId: string;
      gpsUserId: number | null;
    }) => {
      const { error } = await supabase
        .from("fuel_equipment")
        .update({ gpsgate_user_id: gpsUserId } as any)
        .eq("id", tractorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractors-for-gps-linking"] });
      queryClient.invalidateQueries({ queryKey: ["gps-tractors"] });
      toast.success("Vinculación GPS actualizada");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al vincular");
    },
  });

  const handleLink = (tractorId: string, gpsUserIdStr: string) => {
    const gpsUserId =
      gpsUserIdStr === "none" ? null : parseInt(gpsUserIdStr, 10);
    linkMutation.mutate({ tractorId, gpsUserId });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Satellite className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Vinculación GPS</h3>
          <p className="text-sm text-muted-foreground">
            Vincular tractores con dispositivos GPSGate
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchGpsAssets}
          disabled={loadingAssets}
        >
          {loadingAssets ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Cargar Dispositivos
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">
          Cargando tractores...
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tractor</TableHead>
              <TableHead>Dispositivo GPS</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tractors?.map((tractor) => (
              <TableRow key={tractor.id}>
                <TableCell className="font-medium">{tractor.name}</TableCell>
                <TableCell>
                  {gpsAssets.length > 0 ? (
                    <Select
                      value={
                        tractor.gpsgate_user_id
                          ? String(tractor.gpsgate_user_id)
                          : "none"
                      }
                      onValueChange={(v) => handleLink(tractor.id, v)}
                    >
                      <SelectTrigger className="w-[250px] h-9 text-sm">
                        <SelectValue placeholder="Sin vincular" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin vincular</SelectItem>
                        {gpsAssets.map((asset) => (
                          <SelectItem key={asset.id} value={String(asset.id)}>
                            {asset.name}
                            {asset.description
                              ? ` (${asset.description})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : tractor.gpsgate_user_id ? (
                    <span className="text-sm text-muted-foreground">
                      ID: {tractor.gpsgate_user_id}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      Sin vincular — carga dispositivos primero
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {tractor.gpsgate_user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        linkMutation.mutate({
                          tractorId: tractor.id,
                          gpsUserId: null,
                        })
                      }
                      title="Desvincular"
                    >
                      <Unlink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
