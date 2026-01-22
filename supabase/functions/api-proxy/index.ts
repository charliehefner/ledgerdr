import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE_URL = 'https://api.dallasagro.org';

// Allowed endpoints with method restrictions
// Both roles can access read endpoints; write operations are for admin only where noted
const ENDPOINT_PATTERNS = {
  // Read endpoints - all authenticated users with valid roles
  read: [
    { pattern: /^\/accounts$/, methods: ['GET'] },
    { pattern: /^\/projects$/, methods: ['GET'] },
    { pattern: /^\/cbs-codes$/, methods: ['GET'] },
    { pattern: /^\/transactions\/recent(\?.*)?$/, methods: ['GET'] },
    { pattern: /^\/transactions\/\d+$/, methods: ['GET'] },
  ],
  // Write endpoints - accessible to users with valid roles
  write: [
    { pattern: /^\/transactions$/, methods: ['POST'] },
    { pattern: /^\/transactions\/\d+$/, methods: ['PUT', 'DELETE'] },
    { pattern: /^\/transactions\/\d+\/void$/, methods: ['POST'] },
  ],
};

function isEndpointAllowed(endpoint: string, method: string, role: string): boolean {
  // Check read endpoints (both roles allowed)
  for (const rule of ENDPOINT_PATTERNS.read) {
    if (rule.pattern.test(endpoint) && rule.methods.includes(method)) {
      return true;
    }
  }
  
  // Check write endpoints (both roles allowed for now, admin-only restrictions can be added)
  for (const rule of ENDPOINT_PATTERNS.write) {
    if (rule.pattern.test(endpoint) && rule.methods.includes(method)) {
      // For void operations, only admins can void
      if (endpoint.includes('/void') && role !== 'admin') {
        return false;
      }
      return true;
    }
  }
  
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client and verify the user is authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the token is valid
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user role for authorization
    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', { 
      _user_id: userData.user.id 
    });
    
    if (roleError || !roleData || !['admin', 'accountant'].includes(roleData)) {
      console.error('Role check failed:', roleError?.message || 'Invalid role');
      return new Response(
        JSON.stringify({ error: 'Forbidden - no valid role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRole = roleData as string;

    // Get API key from secure secrets
    const apiKey = Deno.env.get('DALLAS_AGRO_API_KEY');
    if (!apiKey) {
      console.error('DALLAS_AGRO_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body to get endpoint and options
    const { endpoint, method = 'GET', body } = await req.json();

    if (!endpoint || typeof endpoint !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Endpoint is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate endpoint against allowlist
    if (!isEndpointAllowed(endpoint, method, userRole)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - endpoint not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the external API request
    const externalUrl = `${API_BASE_URL}${endpoint}`;
    const externalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };

    const fetchOptions: RequestInit = {
      method,
      headers: externalHeaders,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Make the request to the external API
    const externalResponse = await fetch(externalUrl, fetchOptions);
    console.log('External API response status:', externalResponse.status);
    
    // Handle non-JSON responses
    const contentType = externalResponse.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await externalResponse.json();
      return new Response(
        JSON.stringify(data),
        { 
          status: externalResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      const text = await externalResponse.text();
      return new Response(
        text,
        { 
          status: externalResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': contentType || 'text/plain' } 
        }
      );
    }
  } catch (error) {
    console.error('API proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
