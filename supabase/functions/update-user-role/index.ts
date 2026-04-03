import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["admin", "management", "accountant", "supervisor", "viewer", "driver"];

function sanitizeError(error: Error): string {
  console.error("Operation failed:", error);
  const msg = error.message?.toLowerCase() || "";
  if (msg.includes("unauthorized") || msg.includes("no authorization")) return "Unauthorized";
  if (msg.includes("admin access")) return "Admin access required";
  if (msg.includes("own role")) return "Cannot change your own role";
  if (msg.includes("global")) return error.message;
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

    const body = await req.json();
    const { userId, role, entity_id } = body;

    // Validate UUID
    if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId)) {
      throw new Error("Invalid user ID format");
    }

    // Validate role
    if (!role || typeof role !== "string" || !VALID_ROLES.includes(role)) {
      throw new Error("Invalid role");
    }

    // Validate entity_id if provided
    if (entity_id !== undefined && entity_id !== null) {
      if (typeof entity_id !== "string" || !UUID_REGEX.test(entity_id)) {
        throw new Error("Invalid entity_id format");
      }
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

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    // Prevent admin from changing their own role
    if (userId === user.id) {
      throw new Error("Cannot change your own role");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // If assigning global admin (entity_id = null), verify caller is global admin
    const newEntityId = entity_id === undefined ? undefined : (entity_id || null);

    if (newEntityId === null) {
      const { data: callerGlobalRole } = await adminClient
        .from("user_roles")
        .select("entity_id")
        .eq("user_id", user.id)
        .is("entity_id", null)
        .limit(1)
        .maybeSingle();

      if (!callerGlobalRole) {
        throw new Error("Only global admins can assign global admin access");
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = { role };
    if (newEntityId !== undefined) {
      updatePayload.entity_id = newEntityId;
    }

    const { error: updateError } = await adminClient
      .from("user_roles")
      .update(updatePayload)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error("Failed to update role");
    }

    return new Response(
      JSON.stringify({ success: true, userId, role, entity_id: newEntityId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
