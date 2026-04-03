import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { RefreshCw, Loader2, CalendarIcon } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function FxRevaluationButton() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [periodId, setPeriodId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { selectedEntityId, requireEntity } = useEntity();
  const queryClient = useQueryClient();

  // Only admin and accountant
  if (user?.role !== "admin" && user?.role !== "accountant") return null;

  const { data: periods = [] } = useQuery({
    queryKey: ["accounting-periods-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("id, period_name, start_date, end_date, status")
        .is("deleted_at", null)
        .eq("status", "open")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const revalMutation = useMutation({
    mutationFn: async () => {
      const entityId = requireEntity();
      if (!entityId) throw new Error("Seleccione una entidad específica antes de ejecutar la revaluación.");

      const { data, error } = await supabase.rpc("revalue_open_ap_ar", {
        p_revaluation_date: format(date, "yyyy-MM-dd"),
        p_period_id: periodId,
        p_user_id: user?.id!,
        p_entity_id: entityId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      const row = Array.isArray(result) ? result[0] : result;
      const docCount = row?.document_count ?? 0;
      toast.success(
        `Revaluación completa — ${docCount} documento(s) ajustado(s), ${row?.journal_id ? 1 : 0} asiento(s) creado(s).`
      );
      setError(null);
      setOpen(false);
    },
    onError: (e: Error) => {
      setError(e.message);
    },
  });

  const handleOpen = () => {
    setError(null);
    setPeriodId("");
    setDate(new Date());
    setOpen(true);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <RefreshCw className="h-4 w-4 mr-1" />
        Revaluación FX al Cierre
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!revalMutation.isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revaluación FX al Cierre de Período</DialogTitle>
            <DialogDescription>
              Revalúa documentos abiertos de CxP/CxC en moneda extranjera usando la tasa de cambio vigente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fecha de Corte (As-of Date)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Período Contable</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.period_name} ({p.start_date} – {p.end_date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={revalMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => { setError(null); revalMutation.mutate(); }}
              disabled={!periodId || revalMutation.isPending}
            >
              {revalMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ejecutar Revaluación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
