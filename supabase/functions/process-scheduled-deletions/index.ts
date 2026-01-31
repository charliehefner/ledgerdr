import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending deletions that are due
    const { data: pendingDeletions, error: fetchError } = await adminClient
      .from("scheduled_user_deletions")
      .select("*")
      .eq("is_cancelled", false)
      .is("executed_at", null)
      .lte("execute_after", new Date().toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch pending deletions: ${fetchError.message}`);
    }

    console.log(`Found ${pendingDeletions?.length || 0} pending deletions to process`);

    const results: { userId: string; success: boolean; error?: string }[] = [];

    for (const deletion of pendingDeletions || []) {
      try {
        // Delete from user_roles first (foreign key constraint)
        await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", deletion.user_id);

        // Delete the user from auth
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(
          deletion.user_id
        );

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // Mark as executed
        await adminClient
          .from("scheduled_user_deletions")
          .update({ executed_at: new Date().toISOString() })
          .eq("id", deletion.id);

        console.log(`Successfully deleted user ${deletion.user_email}`);
        results.push({ userId: deletion.user_id, success: true });
      } catch (error: any) {
        console.error(`Failed to delete user ${deletion.user_email}:`, error.message);
        results.push({ userId: deletion.user_id, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing scheduled deletions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
