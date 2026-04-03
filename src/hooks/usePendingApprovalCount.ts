import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";

export function usePendingApprovalCount() {
  const { selectedEntityId } = useEntity();

  const { data: count = 0 } = useQuery({
    queryKey: ["pending-approval-count", selectedEntityId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "get_pending_approvals",
        { p_entity_id: selectedEntityId || null }
      );
      if (error) return 0;
      return Array.isArray(data) ? data.length : 0;
    },
    refetchInterval: 60000, // Poll every 60s
    staleTime: 30000,
  });

  return count;
}
