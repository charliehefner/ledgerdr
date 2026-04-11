import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";

export function PendingSubmissionsView() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const dateFnsLocale = language === "es" ? esLocale : enUS;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "management";

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["pending-fuel-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_fuel_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "expire-fuel-submissions"
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: t("pending.cleanupComplete"),
        description: t("pending.cleanupResult").replace("{expired}", String(data.expired_count)).replace("{orphan}", String(data.orphan_count)),
      });
      queryClient.invalidateQueries({ queryKey: ["pending-fuel-submissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const now = new Date();
  const expiredCount =
    submissions?.filter(
      (s) => s.expires_at && new Date(s.expires_at) < now
    ).length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {expiredCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("pending.expiredTitle")}</AlertTitle>
          <AlertDescription>
            {t("pending.expiredDesc").replace("{count}", String(expiredCount))}
          </AlertDescription>
        </Alert>
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending || expiredCount === 0}
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {t("pending.cleanExpired")} ({expiredCount})
          </Button>
        </div>
      )}

      {(!submissions || submissions.length === 0) ? (
        <p className="text-center text-muted-foreground py-8">
          {t("pending.noPending")}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pending.submitted")}</TableHead>
                <TableHead>{t("pending.expires")}</TableHead>
                <TableHead>{t("pending.submittedBy")}</TableHead>
                <TableHead>{t("pending.transaction")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => {
                const isExpired =
                  sub.expires_at && new Date(sub.expires_at) < now;
                return (
                  <TableRow
                    key={sub.id}
                    className={isExpired ? "bg-destructive/5" : ""}
                  >
                    <TableCell>
                      {sub.submitted_at
                        ? format(new Date(sub.submitted_at), "dd/MM/yy HH:mm", {
                            locale: dateFnsLocale,
                          })
                        : sub.created_at
                        ? format(new Date(sub.created_at), "dd/MM/yy HH:mm", {
                            locale: dateFnsLocale,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {sub.expires_at
                        ? format(new Date(sub.expires_at), "dd/MM/yy HH:mm", {
                            locale: dateFnsLocale,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {sub.submitted_by
                        ? sub.submitted_by.substring(0, 8) + "…"
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {sub.fuel_transaction_id
                        ? sub.fuel_transaction_id.substring(0, 8) + "…"
                        : t("pending.unlinked")}
                    </TableCell>
                    <TableCell>
                      {isExpired ? (
                        <Badge variant="destructive">{t("pending.expired")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("pending.pendingStatus")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
