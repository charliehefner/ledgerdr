import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookCheck, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: string;
}

export function PeriodClosingButton({ periodId, periodName, startDate, endDate, status }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const closingMutation = useMutation({
    mutationFn: async () => {
      const { data: journalId, error } = await supabase.rpc("generate_closing_journal", {
        p_period_id: periodId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_user_id: user?.id,
      });
      if (error) throw error;
      return { journalId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast({
        title: t("accounting.closing.created"),
        description: t("accounting.closing.createdDesc"),
      });
      setConfirmOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (status === "reported" || status === "locked") return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={closingMutation.isPending}
      >
        {closingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookCheck className="h-4 w-4 mr-1" />}
        {t("accounting.closing.generate")}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounting.closing.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("accounting.closing.description").replace("{period}", periodName).replace("{start}", startDate).replace("{end}", endDate)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => closingMutation.mutate()}>
              {t("accounting.closing.generateDraft")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
