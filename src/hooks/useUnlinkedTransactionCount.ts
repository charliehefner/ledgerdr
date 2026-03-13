import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUnlinkedTransactionCount(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["unlinked-transaction-count", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("count_unlinked_transactions", {
        p_start: startDate || null,
        p_end: endDate || null,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    enabled: !!(startDate || endDate),
  });
}
