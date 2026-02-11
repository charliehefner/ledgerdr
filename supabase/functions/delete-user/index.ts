import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeError(error: Error): string {
  console.error("Operation failed:", error);
  const msg = error.message?.toLowerCase() || "";
  if (msg.includes("unauthorized") || msg.includes("no authorization")) return "Unauthorized";
  if (msg.includes("admin access")) return "Admin access required";
  if (msg.includes("own account")) return "Cannot delete your own account";
  if (msg.includes("pending deletion")) return "User already has a pending deletion";
  if (msg.includes("not found")) return "User not found";
  return "Operation failed. Please try again.";
}

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

    // Validate UUID
    if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId)) {
      throw new Error("Invalid user ID format");
    }

    // Validate immediate flag
    if (immediate !== undefined && typeof immediate !== "boolean") {
      throw new Error("Invalid immediate flag");
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
      .maybeSingle();

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
      throw new Error("Failed to schedule deletion");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled: !immediate,
        execute_after: executeAfter.toISOString(),
        message: immediate 
          ? "User deletion scheduled for immediate processing"
          : `User deletion scheduled`
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
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
