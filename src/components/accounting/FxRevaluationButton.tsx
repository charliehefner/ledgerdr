import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function FxRevaluationButton() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [periodId, setPeriodId] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
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
        .in("status", ["open", "closed"])
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const revalMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("revalue_open_ap_ar", {
        p_revaluation_date: format(date, "yyyy-MM-dd"),
        p_period_id: periodId,
        p_posted_by: user?.id,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      toast({
        title: t("accounting.reval.generated"),
        description: `${count} revaluation journal entries created.`,
      });
      setOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4 mr-1" />
        {t("accounting.reval.button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Period-End FX Revaluation</DialogTitle>
            <DialogDescription>
              Revalue open AP/AR documents in foreign currencies using the latest exchange rate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Revaluation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
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
              <Label>Accounting Period</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.period_name} ({p.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => revalMutation.mutate()}
              disabled={!periodId || revalMutation.isPending}
            >
              {revalMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Run Revaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
