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
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarDays } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { PeriodClosingButton } from "./PeriodClosingButton";
import { PeriodRevaluationButton } from "./PeriodRevaluationButton";
import { PeriodClosingChecklist } from "./PeriodClosingChecklist";

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

export function PeriodsView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ period_name: "", start_date: "", end_date: "" });

  const statusConfig: Record<PeriodStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    open: { label: t("accounting.periods.statusOpen"), variant: "default" },
    closed: { label: t("accounting.periods.statusClosed"), variant: "secondary" },
    reported: { label: t("accounting.periods.statusReported"), variant: "outline" },
    locked: { label: t("accounting.periods.statusLocked"), variant: "destructive" },
  };

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
      toast({ title: t("accounting.periods.created") });
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
      toast({ title: t("accounting.periods.updated") });
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
        <h3 className="text-lg font-medium">{t("accounting.periods.title")}</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("accounting.periods.new")}
        </Button>
      </div>

      {periods.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("accounting.periods.noPeriods")}
          description={t("accounting.periods.noPeriodsDesc")}
          action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" />{t("accounting.periods.new")}</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.periods.col.name")}</TableHead>
                <TableHead>{t("accounting.periods.col.start")}</TableHead>
                <TableHead>{t("accounting.periods.col.end")}</TableHead>
                <TableHead>{t("accounting.periods.col.status")}</TableHead>
                <TableHead className="w-[140px]">{t("accounting.periods.col.changeStatus")}</TableHead>
                <TableHead className="w-[120px]">{t("accounting.periods.col.closing")}</TableHead>
                <TableHead className="w-[130px]">{t("accounting.periods.col.revaluation")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.period_name}</TableCell>
                  <TableCell>{format(new Date(p.start_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{format(new Date(p.end_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[p.status].variant}>
                      {statusConfig[p.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const statusOrder: PeriodStatus[] = ["open", "closed", "reported", "locked"];
                      const currentIdx = statusOrder.indexOf(p.status);
                      const nextStatus = currentIdx < statusOrder.length - 1 ? statusOrder[currentIdx + 1] : null;
                      if (!nextStatus) return <span className="text-xs text-muted-foreground">{t("accounting.periods.statusLocked")}</span>;
                      // Use checklist for open → closed transition
                      if (p.status === "open") {
                        return (
                          <PeriodClosingChecklist
                            periodId={p.id}
                            startDate={p.start_date}
                            endDate={p.end_date}
                            nextStatusLabel={statusConfig[nextStatus].label}
                            onConfirm={() => updateStatusMutation.mutate({ id: p.id, status: nextStatus })}
                            isPending={updateStatusMutation.isPending}
                          />
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => updateStatusMutation.mutate({ id: p.id, status: nextStatus })}
                        >
                          → {statusConfig[nextStatus].label}
                        </Button>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <PeriodClosingButton
                      periodId={p.id}
                      periodName={p.period_name}
                      startDate={p.start_date}
                      endDate={p.end_date}
                      status={p.status}
                    />
                  </TableCell>
                  <TableCell>
                    <PeriodRevaluationButton
                      periodId={p.id}
                      periodName={p.period_name}
                      startDate={p.start_date}
                      endDate={p.end_date}
                      status={p.status}
                    />
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
            <DialogTitle>{t("accounting.periods.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("accounting.periods.periodName")}</Label>
              <Input
                value={form.period_name}
                onChange={e => setForm(f => ({ ...f, period_name: e.target.value }))}
                placeholder={t("accounting.periods.periodNamePlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("accounting.periods.startDate")}</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("accounting.periods.endDate")}</Label>
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
