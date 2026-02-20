import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarDays } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

type PeriodStatus = "open" | "closed" | "reported" | "locked";

type Period = {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean | null;
  status: PeriodStatus;
  created_at: string | null;
};

const STATUS_CONFIG: Record<PeriodStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Abierto", variant: "default" },
  closed: { label: "Cerrado", variant: "secondary" },
  reported: { label: "Reportado", variant: "outline" },
  locked: { label: "Bloqueado", variant: "destructive" },
};

export function PeriodsView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ period_name: "", start_date: "", end_date: "" });

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["accounting-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("*")
        .is("deleted_at", null)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as Period[]).map(p => ({
        ...p,
        status: (p.status || (p.is_closed ? "closed" : "open")) as PeriodStatus,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("accounting_periods").insert({
        period_name: values.period_name,
        start_date: values.start_date,
        end_date: values.end_date,
        is_closed: false,
        status: "open",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-periods"] });
      toast({ title: "Período creado" });
      setDialogOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PeriodStatus }) => {
      const { error } = await supabase.from("accounting_periods").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-periods"] });
      toast({ title: "Período actualizado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const openAdd = () => {
    setForm({ period_name: "", start_date: "", end_date: "" });
    setDialogOpen(true);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Períodos Contables</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Período
        </Button>
      </div>

      {periods.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No hay períodos"
          description="Cree su primer período contable para comenzar."
          action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Período</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Cambiar Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.period_name}</TableCell>
                  <TableCell>{format(new Date(p.start_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{format(new Date(p.end_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_CONFIG[p.status].variant}>
                      {STATUS_CONFIG[p.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.status}
                      onValueChange={(val) => updateStatusMutation.mutate({ id: p.id, status: val as PeriodStatus })}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Abierto</SelectItem>
                        <SelectItem value="closed">Cerrado</SelectItem>
                        <SelectItem value="reported">Reportado</SelectItem>
                        <SelectItem value="locked">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Período Contable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre del Período</Label>
              <Input
                value={form.period_name}
                onChange={e => setForm(f => ({ ...f, period_name: e.target.value }))}
                placeholder="Ej: Enero 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fecha Fin</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.period_name || !form.start_date || !form.end_date}
            >
              {createMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}