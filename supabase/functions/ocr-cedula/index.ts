import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const allowedRoles = ["admin", "management", "accountant", "supervisor", "office"];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ext = (file_name || "cedula.jpg").split(".").pop()?.toLowerCase() || "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    const mimeType = mimeMap[ext] || "image/jpeg";

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
            content: `You are an OCR assistant specialized in extracting data from Dominican Republic national ID cards (cédulas de identidad).

A Dominican cédula contains the following information:
- Full name (nombres y apellidos)
- Cédula number (formato: XXX-XXXXXXX-X, 11 digits with dashes)
- Date of birth (fecha de nacimiento)
- Sex (sexo: M or F)
- Nationality
- Place of birth

Extract the following fields from the cédula image:

Return ONLY a valid JSON object with no additional text:
{
  "name": "Full name as shown on the cédula (first names + last names)",
  "cedula": "Cédula number in XXX-XXXXXXX-X format",
  "date_of_birth": "YYYY-MM-DD format",
  "sex": "M" or "F"
}

Rules:
- For the name, combine first names and last names as they appear on the card.
- For the cédula number, include dashes in the format XXX-XXXXXXX-X.
- For date of birth, convert to YYYY-MM-DD format. Dominican cédulas typically show dates in DD/MM/YYYY or DD-MMM-YYYY format.
- For sex, return exactly "M" or "F".
- If you cannot determine a field, use null.
- Return ONLY the JSON object, no markdown, no explanation.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the personal information from this Dominican Republic cédula (national ID card) image.",
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

      return new Response(
        JSON.stringify({ error: "OCR service returned an error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let extracted;
    try {
      const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(
        JSON.stringify({ error: "No se pudieron extraer los datos de la cédula" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = {
      name: extracted.name || null,
      cedula: extracted.cedula || null,
      date_of_birth: extracted.date_of_birth || null,
      sex: extracted.sex === "M" || extracted.sex === "F" ? extracted.sex : null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ocr-cedula error:", error);
    return new Response(
      JSON.stringify({ error: "Error processing cédula image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
