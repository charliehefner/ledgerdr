import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
    if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY is not configured');

    // Auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // --- getUpdates mode: discover chat ID ---
    if (action === 'getUpdates') {
      const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TELEGRAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ offset: 0, limit: 10, timeout: 0 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Telegram getUpdates failed [${response.status}]: ${JSON.stringify(data)}`);
      }

      const updates = data.result ?? [];
      const chats: { chat_id: number; name: string; text: string }[] = [];
      const seen = new Set<number>();

      for (const u of updates) {
        const msg = u.message;
        if (!msg) continue;
        const chatId = msg.chat.id;
        if (seen.has(chatId)) continue;
        seen.add(chatId);
        chats.push({
          chat_id: chatId,
          name: msg.chat.first_name || msg.chat.title || String(chatId),
          text: msg.text ?? '',
        });
      }

      return new Response(JSON.stringify({ ok: true, chats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- broadcast mode: send by category to all matching recipients ---
    if (body.category && body.message) {
      const category: string = body.category;
      const message: string = body.message;

      // Use service role to read recipients (RLS is admin-only)
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: recipients, error: recErr } = await adminClient
        .from('telegram_recipients')
        .select('chat_id, label')
        .eq('is_active', true);

      if (recErr) throw new Error(`Failed to fetch recipients: ${recErr.message}`);

      // Filter recipients whose categories include the given category or 'all'
      const matching = (recipients ?? []).filter((r: any) => {
        // categories is a text[] stored in DB — returned as string[] by supabase-js
        const cats: string[] = r.categories ?? [];
        return cats.includes('all') || cats.includes(category);
      });

      // Fetch categories properly since select doesn't return array columns well with filter
      const { data: fullRecipients } = await adminClient
        .from('telegram_recipients')
        .select('chat_id, label, categories')
        .eq('is_active', true);

      const matched = (fullRecipients ?? []).filter((r: any) => {
        const cats: string[] = r.categories ?? [];
        return cats.includes('all') || cats.includes(category);
      });

      const results: { chat_id: string; ok: boolean; error?: string }[] = [];

      for (const r of matched) {
        try {
          const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TELEGRAM_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: Number(r.chat_id),
              text: message,
              parse_mode: 'HTML',
            }),
          });
          const d = await response.json();
          if (!response.ok) {
            results.push({ chat_id: r.chat_id, ok: false, error: JSON.stringify(d) });
          } else {
            results.push({ chat_id: r.chat_id, ok: true });
          }
        } catch (e: any) {
          results.push({ chat_id: r.chat_id, ok: false, error: e.message });
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- sendMessage mode (direct, single recipient) ---
    const { chat_id, message } = body;
    if (!chat_id || !message) {
      return new Response(JSON.stringify({ error: 'chat_id and message are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: Number(chat_id),
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ ok: true, message_id: data.result?.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('send-telegram error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
