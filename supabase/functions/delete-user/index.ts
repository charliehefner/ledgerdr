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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { userId, immediate } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the requesting user is an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Prevent self-deletion
    if (user.id === userId) {
      throw new Error("Cannot delete your own account");
    }

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    // Use service role to get target user info and schedule deletion
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the target user's email and role
    const { data: targetUser, error: targetUserError } = 
      await adminClient.auth.admin.getUserById(userId);
    
    if (targetUserError || !targetUser?.user) {
      throw new Error("User not found");
    }

    // Get user's role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    // Check if there's already a pending deletion for this user
    const { data: existingDeletion } = await adminClient
      .from("scheduled_user_deletions")
      .select("id")
      .eq("user_id", userId)
      .eq("is_cancelled", false)
      .is("executed_at", null)
      .single();

    if (existingDeletion) {
      throw new Error("User already has a pending deletion scheduled");
    }

    // Schedule deletion for next midnight (or immediate if requested)
    const executeAfter = immediate 
      ? new Date() 
      : getNextMidnight();

    const { error: scheduleError } = await adminClient
      .from("scheduled_user_deletions")
      .insert({
        user_id: userId,
        user_email: targetUser.user.email || "unknown",
        user_role: roleData?.role || null,
        scheduled_by: user.id,
        execute_after: executeAfter.toISOString(),
      });

    if (scheduleError) {
      throw new Error(scheduleError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled: !immediate,
        execute_after: executeAfter.toISOString(),
        message: immediate 
          ? "User deletion scheduled for immediate processing"
          : `User deletion scheduled for ${executeAfter.toLocaleDateString()}`
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getNextMidnight(): Date {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  return nextMidnight;
}
