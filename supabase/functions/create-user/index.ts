import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Domain used for username-based accounts (users without email)
const USERNAME_EMAIL_DOMAIN = "internal.jord.local";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["admin", "management", "accountant", "supervisor", "viewer", "driver"];

function sanitizeError(error: Error): string {
  console.error("Operation failed:", error);
  const msg = error.message?.toLowerCase() || "";
  if (msg.includes("password")) return error.message;
  if (msg.includes("already") || msg.includes("unique") || msg.includes("duplicate")) return "User already exists";
  if (msg.includes("unauthorized") || msg.includes("no authorization")) return "Unauthorized";
  if (msg.includes("admin access")) return "Admin access required";
  if (msg.includes("invalid")) return "Invalid input provided";
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
    const { email, username, password, role, entity_id, entity_group_id } = body;

    // Validate entity_id format if provided
    if (entity_id !== undefined && entity_id !== null) {
      if (typeof entity_id !== "string" || !UUID_REGEX.test(entity_id)) {
        throw new Error("Invalid entity_id format");
      }
    }

    // Validate: either email or username required
    if (!email && !username) {
      throw new Error("Email or username is required");
    }

    // Validate email format if provided
    if (email && (typeof email !== "string" || email.length > 255 || !EMAIL_REGEX.test(email))) {
      throw new Error("Invalid email format");
    }

    // Validate username if provided
    if (username && (typeof username !== "string" || username.length < 3 || username.length > 50)) {
      throw new Error("Invalid username - must be 3-50 characters");
    }

    // Validate password
    if (!password || typeof password !== "string") {
      throw new Error("Password is required");
    }
    if (password.length < 8 || password.length > 128) {
      throw new Error("Password must be 8-128 characters");
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      throw new Error("Password must contain at least one letter and one number");
    }

    // Validate role
    if (!role || typeof role !== "string" || !VALID_ROLES.includes(role)) {
      throw new Error("Invalid role");
    }

    // Determine the actual email to use
    let actualEmail: string;
    let isUsernameAccount = false;

    if (username && !email) {
      // Username-only account - create placeholder email
      const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!sanitizedUsername || sanitizedUsername.length < 3) {
        throw new Error("Invalid username - must contain at least 3 alphanumeric characters");
      }
      actualEmail = `${sanitizedUsername}@${USERNAME_EMAIL_DOMAIN}`;
      isUsernameAccount = true;
    } else {
      actualEmail = email;
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

    // Only global admins can create other global admins (entity_id = null)
    if (!entity_id) {
      const { data: callerRole } = await adminClient
        .from("user_roles")
        .select("entity_id")
        .eq("user_id", user.id)
        .is("entity_id", null)
        .limit(1)
        .maybeSingle();
      if (!callerRole) {
        throw new Error("Only global admins can create users without an entity assignment");
      }
    }

    // Create the user in auth with metadata to track username accounts
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: actualEmail,
        password,
        email_confirm: true,
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

    // Add role to user_roles table with entity_id
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role: role,
      entity_id: entity_id || null,
    });

    if (roleError) {
      // Rollback: delete the user if role assignment fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error("Failed to assign role");
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: actualEmail,
          username: isUsernameAccount ? username : undefined,
          role,
          entity_id: entity_id || null,
        },
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
