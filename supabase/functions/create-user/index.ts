import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Domain used for username-based accounts (users without email)
const USERNAME_EMAIL_DOMAIN = "internal.jord.local";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { email, username, password, role } = await req.json();

    // Either email or username must be provided
    if (!email && !username) {
      throw new Error("Email or username is required");
    }

    if (!password || !role) {
      throw new Error("Password and role are required");
    }

    // Determine the actual email to use
    let actualEmail: string;
    let isUsernameAccount = false;

    if (username && !email) {
      // Username-only account - create placeholder email
      const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!sanitizedUsername) {
        throw new Error("Invalid username - must contain at least one letter or number");
      }
      actualEmail = `${sanitizedUsername}@${USERNAME_EMAIL_DOMAIN}`;
      isUsernameAccount = true;
    } else {
      actualEmail = email;
    }

    const validRoles = ["admin", "management", "accountant", "supervisor", "viewer", "driver"];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
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

    // Use service role to create new user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Create the user in auth with metadata to track username accounts
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: actualEmail,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: isUsernameAccount ? { 
          username: username,
          is_username_account: true 
        } : undefined,
      });

    if (createError) {
      throw new Error(createError.message);
    }

    if (!newUser.user) {
      throw new Error("Failed to create user");
    }

    // Add role to user_roles table
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role: role,
    });

    if (roleError) {
      // Rollback: delete the user if role assignment fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: actualEmail,
          username: isUsernameAccount ? username : undefined,
          role,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
