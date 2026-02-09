import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image: string; // base64 image data
  meterType: "hour_meter" | "fuel_pump";
  previousValue: number;
  equipmentName: string;
}

interface AnalyzeResponse {
  extractedValue: number | null;
  confidence: "high" | "medium" | "low";
  validationResult: "valid" | "below_previous" | "unrealistic_jump";
}

const VALID_METER_TYPES = ["hour_meter", "fuel_pump"];
const MAX_IMAGE_LENGTH = 10 * 1024 * 1024; // ~10MB base64

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { image, meterType, previousValue, equipmentName } = body as AnalyzeRequest;

    // Validate image
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (image.length > MAX_IMAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Image too large" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate meterType
    if (!meterType || !VALID_METER_TYPES.includes(meterType)) {
      return new Response(
        JSON.stringify({ error: "Invalid meter type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate previousValue
    if (previousValue === undefined || typeof previousValue !== "number" || previousValue < 0 || previousValue > 999999) {
      return new Response(
        JSON.stringify({ error: "Invalid previous value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate equipmentName
    if (!equipmentName || typeof equipmentName !== "string" || equipmentName.length > 200) {
      return new Response(
        JSON.stringify({ error: "Invalid equipment name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI service not configured");
    }

    // Prepare the prompt based on meter type
    const meterTypeLabel = meterType === "hour_meter" ? "horómetro (hour meter)" : "medidor de bomba de combustible (fuel pump meter)";
    const unitLabel = meterType === "hour_meter" ? "horas" : "galones";

    const prompt = `You are analyzing a photo of a ${meterTypeLabel} on agricultural equipment.

Equipment: ${equipmentName.substring(0, 100)}
Previous reading: ${previousValue} ${unitLabel}

TASK: Extract the numeric reading displayed on the meter.

INSTRUCTIONS:
1. Look for the numeric display on the meter
2. Read the complete number including any decimal places
3. The reading should be >= ${previousValue} (meters don't go backwards)
4. For hour meters, expect values between 0-50,000
5. For fuel pump meters, expect values between 0-999,999

RESPOND WITH ONLY A JSON OBJECT in this exact format:
{
  "extractedValue": <number or null if unreadable>,
  "confidence": "<high|medium|low>",
  "validationResult": "<valid|below_previous|unrealistic_jump>"
}

Rules for validation:
- "valid": Reading is >= previous value and within reasonable range
- "below_previous": Reading is less than previous value (possible error)
- "unrealistic_jump": Reading jumped by more than 1000 ${unitLabel} from previous (suspicious)

Do not include any text outside the JSON object.`;

    // Call Lovable AI API (using Gemini flash for fast processing)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status);
      throw new Error("AI service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response from AI
    let result: AnalyzeResponse;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      result = {
        extractedValue: null,
        confidence: "low",
        validationResult: "valid",
      };
    }

    // Additional validation
    if (result.extractedValue !== null) {
      if (result.extractedValue < previousValue) {
        result.validationResult = "below_previous";
      } else if (result.extractedValue - previousValue > 1000) {
        result.validationResult = "unrealistic_jump";
        result.confidence = "low";
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error analyzing meter image:", error);
    return new Response(
      JSON.stringify({ 
        error: "Analysis failed",
        extractedValue: null,
        confidence: "low",
        validationResult: "valid"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
