import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("database") || msg.includes("postgres") || msg.includes("sql")) {
      return "An internal error occurred.";
    }
    return error.message;
  }
  return "An unknown error occurred.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const allowedRoles = ["admin", "management", "accountant", "supervisor", "viewer"];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { image_base64, file_name } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "Missing image_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine mime type from file name
    const ext = (file_name || "receipt.jpg").split(".").pop()?.toLowerCase() || "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      pdf: "application/pdf",
    };
    const mimeType = mimeMap[ext] || "image/jpeg";

    // Call Lovable AI Gateway with Gemini vision
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an OCR assistant specialized in extracting data from Dominican Republic receipts and invoices (comprobantes fiscales). Extract the following fields and return ONLY a valid JSON object with no additional text:

{
  "vendor_name": "merchant/seller name",
  "rnc": "RNC number (9-11 digits)",
  "date": "YYYY-MM-DD format",
  "amount": numeric total amount,
  "itbis": numeric tax/ITBIS amount,
  "document": "NCF or receipt number (e.g. B0100000123, E310000000001)",
  "pay_method": "cash" or "cc_management" or "bank_transfer" or null,
  "description": "short summary of items purchased, e.g. '8.45 gal diesel', 'office supplies', 'materiales de oficina'"
}

Rules:
- For date, use YYYY-MM-DD format. Dominican dates are typically DD/MM/YYYY.
- For amount and itbis, return numbers without currency symbols.
- For RNC, look for patterns like "RNC: 123456789" or "R.N.C. 123456789".
- For document/NCF, look for patterns starting with B01, B02, B04, B14, B15, B16, B17, E31, E32, E33, E34, E41, E43, E44, E45, E46, E47.
- For pay_method, if you see credit card info return "cc_management", if cash/efectivo return "cash", if transfer/transferencia return "bank_transfer", otherwise null.
- If you cannot determine a field, use null for strings and null for numbers.
- Return ONLY the JSON object, no markdown, no explanation.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the receipt data from this image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${image_base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Servicio AI ocupado, intente de nuevo en unos segundos" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos AI agotados" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "OCR service returned an error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON from the AI response
    let extracted;
    try {
      // Strip markdown code fences if present
      const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(
        JSON.stringify({
          error: "Could not parse receipt data",
          raw_text: rawContent.substring(0, 500),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize the response to match expected format
    const result = {
      vendor_name: extracted.vendor_name || "",
      rnc: extracted.rnc || "",
      date: extracted.date || null,
      amount: typeof extracted.amount === "number" ? extracted.amount : null,
      itbis: typeof extracted.itbis === "number" ? extracted.itbis : null,
      document: extracted.document || "",
      pay_method: extracted.pay_method || null,
      description: extracted.description || "",
      raw_text: rawContent.substring(0, 500),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ocr-receipt error:", error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
