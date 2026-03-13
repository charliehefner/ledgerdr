import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export function useJournalGeneration(userId?: string) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  async function countUnlinked(): Promise<number> {
    const { data, error } = await supabase.rpc("count_unlinked_transactions", {});
    if (error) throw error;
    return (data as number) ?? 0;
  }

  async function generate(): Promise<number> {
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-journals", {
        body: { user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { created = 0, skipped = [], total = 0 } = data || {};

      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-transaction-count"] });

      if (skipped.length > 0) {
        toast({
          title: `${created} asientos creados, ${skipped.length} omitidos`,
          description: skipped.slice(0, 3).join("\n"),
          variant: "destructive",
        });
      } else if (created > 0) {
        toast({ title: "Completado", description: `${created} asientos creados como borradores.` });
      } else {
        toast({ title: "Info", description: "No hay transacciones sin asiento." });
      }

      return created;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return 0;
    } finally {
      setGenerating(false);
    }
  }

  return { generate, countUnlinked, generating };
}
