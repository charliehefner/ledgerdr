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

    // Create client with user's token to check permissions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin - admins get full user list with roles
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    // Use service role client to access auth.users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user roles
    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("*");

    if (rolesError) throw rolesError;

    // Get user details for each role
    const usersWithRoles = await Promise.all(
      roles.map(async (role) => {
        const {
          data: { user: authUser },
        } = await adminClient.auth.admin.getUserById(role.user_id);

        // For non-admins, return limited info (just id and email for display)
        // For admins, return full info including role
        if (isAdmin) {
          return {
            id: role.user_id,
            email: authUser?.email || "Unknown",
            role: role.role,
            created_at: role.created_at,
          };
        } else {
          return {
            id: role.user_id,
            email: authUser?.email || "Unknown",
          };
        }
      })
    );

    // Return wrapped in { users: [...] } for consistency
    return new Response(JSON.stringify({ users: usersWithRoles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in get-users:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
