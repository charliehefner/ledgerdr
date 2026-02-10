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
  if (msg.includes("password")) return error.message;
  if (msg.includes("unauthorized") || msg.includes("no authorization")) return "Unauthorized";
  if (msg.includes("admin access")) return "Admin access required";
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
    const { userId, newPassword } = body;

    // Validate userId
    if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId)) {
      throw new Error("Invalid user ID");
    }

    // Validate password
    if (!newPassword || typeof newPassword !== "string") {
      throw new Error("Password is required");
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new Error("Password must be 8-128 characters");
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      throw new Error("Password must contain at least one letter and one number");
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

    // Use service role to update password
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      throw new Error(updateError.message);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
