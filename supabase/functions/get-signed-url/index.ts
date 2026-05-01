import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PATH_LENGTH = 500;

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Extract token from header
    const token = authHeader.replace('Bearer ', '');
    
    // Create client with auth header for JWT validation
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Validate user via getUser
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    
    // Create admin client for service role operations
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Check user has a valid role (any authenticated user with a role can view attachments)
    const { data: roleData } = await adminSupabase.rpc('get_user_role', { 
      _user_id: userId 
    });
    
    if (!roleData || !['admin', 'management', 'accountant', 'supervisor', 'office', 'viewer', 'driver'].includes(roleData)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { filePath, bucket } = await req.json();
    
    if (!filePath || typeof filePath !== 'string') {
      return new Response(
        JSON.stringify({ error: 'File path is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Max path length check
    if (filePath.length > MAX_PATH_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Invalid file path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine bucket and validate path
    const allowedBuckets: Record<string, (p: string) => boolean> = {
      'transaction-attachments': (p) => p.startsWith('receipts/'),
      'employee-documents': (p) => /^[0-9a-f-]+\//.test(p),
    };

    const targetBucket = bucket || 'transaction-attachments';

    if (!allowedBuckets[targetBucket]) {
      return new Response(
        JSON.stringify({ error: 'Invalid bucket' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file path to prevent path traversal
    if (filePath.includes('..') || !allowedBuckets[targetBucket](filePath)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signed URL with 1 hour expiry
    const { data, error } = await adminSupabase.storage
      .from(targetBucket)
      .createSignedUrl(filePath, 3600); // 1 hour

    if (error) {
      console.error('Signed URL error:', JSON.stringify(error));
      const isNotFound = error.message?.toLowerCase().includes('not found') ||
                         error.message?.toLowerCase().includes('object not found');
      const status = isNotFound ? 404 : 500;
      return new Response(
        JSON.stringify({ error: isNotFound ? 'File not found' : 'Failed to generate signed URL' }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get signed URL error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
