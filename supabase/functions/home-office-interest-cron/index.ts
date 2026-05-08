import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Determine target month: previous month if running on day 1, else current month.
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodMonth = targetDate.toISOString().slice(0, 10);

    // System user id (created_by). Fall back to a known admin if available.
    const { data: sysUser } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    const userId = sysUser?.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "No admin user found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Iterate every active party for every entity that has open advances
    const { data: parties } = await supabase
      .from("home_office_parties")
      .select("id, name, interest_basis");
    if (!parties) return new Response(JSON.stringify({ posted: 0 }), { headers: corsHeaders });

    const results: any[] = [];
    for (const party of parties) {
      if (party.interest_basis === "none") continue;
      const { data: entities } = await supabase
        .from("home_office_advances")
        .select("entity_id")
        .eq("party_id", party.id)
        .neq("status", "voided");
      const entityIds = Array.from(new Set((entities || []).map((e: any) => e.entity_id)));
      for (const entityId of entityIds) {
        const { error } = await supabase.rpc("post_home_office_interest_accrual", {
          p_party_id: party.id,
          p_entity_id: entityId,
          p_period_month: periodMonth,
          p_user_id: userId,
        });
        results.push({ party: party.name, entity: entityId, error: error?.message ?? null });
      }
    }

    return new Response(JSON.stringify({ periodMonth, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
