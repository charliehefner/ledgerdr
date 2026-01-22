import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE_URL = 'https://api.dallasagro.org';

Deno.serve(async (req) => {
  console.log('API Proxy called - method:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No valid auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client and verify the user is authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('Supabase URL present:', !!supabaseUrl);
    console.log('Supabase Anon Key present:', !!supabaseAnonKey);
    
    const supabase = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getUser to verify the token is valid
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    console.log('getUser result - user:', !!userData?.user, 'error:', userError?.message);
    
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', userData.user.email);

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
    console.log('Proxying to:', endpoint, 'method:', method);

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Endpoint is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
