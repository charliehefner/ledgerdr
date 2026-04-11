import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface ErrorLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  error_message: string;
  stack_trace: string | null;
  page_url: string | null;
  user_agent: string | null;
  component_name: string | null;
}

export function ErrorLogView() {
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: errors = [], isLoading, refetch } = useQuery({
    queryKey: ["app-error-log"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_error_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ErrorLogEntry[];
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("app_error_log")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-error-log"] });
      toast.success("Registro de errores limpiado");
    },
  });

  if (userRole !== "admin" && userRole !== "management") {
    return <p className="text-muted-foreground">No tiene acceso a esta sección.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-semibold text-lg">Registro de Errores</h3>
          <span className="text-sm text-muted-foreground">({errors.length})</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refrescar
          </Button>
          {userRole === "admin" && errors.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => clearMutation.mutate()}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpiar todo
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : errors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No hay errores registrados. ¡Todo funciona bien!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Fecha</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-[120px]">Componente</TableHead>
                <TableHead className="w-[200px]">URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err) => (
                <TableRow
                  key={err.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                >
                  <TableCell className="text-xs font-mono whitespace-nowrap">
                    {format(new Date(err.created_at), "dd/MM/yy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm truncate max-w-[400px]">{err.error_message}</p>
                    {expandedId === err.id && err.stack_trace && (
                      <pre className="mt-2 text-xs bg-muted rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                        {err.stack_trace}
                      </pre>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{err.component_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {err.page_url?.replace(window.location.origin, "") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
