import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Undo2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { roleDisplayNames, UserRole } from "@/lib/permissions";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ScheduledDeletion {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string | null;
  scheduled_at: string;
  execute_after: string;
  is_cancelled: boolean;
}

export function ScheduledDeletions() {
  const queryClient = useQueryClient();

  const { data: pendingDeletions = [], isLoading } = useQuery({
    queryKey: ["scheduled-deletions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_user_deletions")
        .select("*")
        .eq("is_cancelled", false)
        .is("executed_at", null)
        .order("execute_after", { ascending: true });

      if (error) throw error;
      return data as ScheduledDeletion[];
    },
  });

  const handleCancelDeletion = async (deletion: ScheduledDeletion) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("scheduled_user_deletions")
        .update({ 
          is_cancelled: true, 
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id 
        })
        .eq("id", deletion.id);

      if (error) throw error;

      toast.success(`Eliminación de ${deletion.user_email} cancelada`);
      queryClient.invalidateQueries({ queryKey: ["scheduled-deletions"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Error al cancelar eliminación");
    }
  };

  // Extract username from internal email
  const getDisplayName = (email: string) => {
    if (email.endsWith("@internal.jord.local")) {
      return email.replace("@internal.jord.local", "");
    }
    return email;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingDeletions.length === 0) {
    return null;
  }

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-destructive">Eliminaciones Pendientes</h3>
          <p className="text-sm text-muted-foreground">
            Los siguientes usuarios serán eliminados a medianoche. Cancele antes si fue un error.
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Programado</TableHead>
            <TableHead>Se elimina</TableHead>
            <TableHead className="w-[100px]">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingDeletions.map((deletion) => (
            <TableRow key={deletion.id}>
              <TableCell className="font-medium">
                {getDisplayName(deletion.user_email)}
              </TableCell>
              <TableCell>
                {deletion.user_role 
                  ? roleDisplayNames[deletion.user_role as UserRole] || deletion.user_role
                  : "—"
                }
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(deletion.scheduled_at), "dd MMM, HH:mm", { locale: es })}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1 text-destructive">
                  <Clock className="h-3 w-3" />
                  {format(new Date(deletion.execute_after), "dd MMM, HH:mm", { locale: es })}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary border-primary hover:bg-primary/10"
                  onClick={() => handleCancelDeletion(deletion)}
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
