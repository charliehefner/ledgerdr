import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUnlinkedTransactionCount(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["unlinked-transaction-count", startDate, endDate],
    queryFn: async () => {
      // Count non-void transactions in range
      let txQuery = supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("is_void", false);
      if (startDate) txQuery = txQuery.gte("transaction_date", startDate);
      if (endDate) txQuery = txQuery.lte("transaction_date", endDate);

      // Count distinct transaction_source_ids that have journals
      let jQuery = supabase
        .from("journals")
        .select("transaction_source_id", { count: "exact", head: true })
        .not("transaction_source_id", "is", null);
      if (startDate) jQuery = jQuery.gte("journal_date", startDate);
      if (endDate) jQuery = jQuery.lte("journal_date", endDate);

      const [txResult, jResult] = await Promise.all([txQuery, jQuery]);

      const totalTx = txResult.count ?? 0;
      const linkedTx = jResult.count ?? 0;
      return Math.max(0, totalTx - linkedTx);
    },
    enabled: !!(startDate || endDate),
  });
}
