import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find expired submissions that have a linked fuel transaction
    const { data: expired, error: fetchError } = await supabase
      .from("pending_fuel_submissions")
      .select("id, fuel_transaction_id")
      .lt("expires_at", new Date().toISOString())
      .not("fuel_transaction_id", "is", null);

    if (fetchError) {
      throw new Error(`Failed to fetch expired submissions: ${fetchError.message}`);
    }

    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ expired_count: 0, message: "No expired submissions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const submission of expired) {
      // Delete the linked fuel transaction first (cascade will not help here since FK is on pending side)
      if (submission.fuel_transaction_id) {
        const { error: txDeleteError } = await supabase
          .from("fuel_transactions")
          .delete()
          .eq("id", submission.fuel_transaction_id);

        if (txDeleteError) {
          errors.push(`Failed to delete fuel_transaction ${submission.fuel_transaction_id}: ${txDeleteError.message}`);
          continue;
        }
      }

      // Delete the pending submission
      const { error: subDeleteError } = await supabase
        .from("pending_fuel_submissions")
        .delete()
        .eq("id", submission.id);

      if (subDeleteError) {
        errors.push(`Failed to delete submission ${submission.id}: ${subDeleteError.message}`);
        continue;
      }

      deletedCount++;
    }

    // Also clean up any expired submissions without a fuel_transaction_id (orphans)
    const { data: orphans, error: orphanError } = await supabase
      .from("pending_fuel_submissions")
      .select("id")
      .lt("expires_at", new Date().toISOString())
      .is("fuel_transaction_id", null);

    let orphanCount = 0;
    if (!orphanError && orphans && orphans.length > 0) {
      const orphanIds = orphans.map((o) => o.id);
      const { error: delOrphanError } = await supabase
        .from("pending_fuel_submissions")
        .delete()
        .in("id", orphanIds);

      if (!delOrphanError) {
        orphanCount = orphanIds.length;
      }
    }

    return new Response(
      JSON.stringify({
        expired_count: deletedCount,
        orphan_count: orphanCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Cleaned up ${deletedCount} expired submissions and ${orphanCount} orphans`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
