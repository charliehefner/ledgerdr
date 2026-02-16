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

function extractFieldValue(predictions: any[], label: string): string {
  const field = predictions.find(
    (p: any) => p.label?.toLowerCase() === label.toLowerCase()
  );
  if (!field) return "";
  // Nanonets returns an array of ocr_text values per field
  if (Array.isArray(field.ocr_text)) {
    return field.ocr_text.join(" ").trim();
  }
  return (field.ocr_text || "").trim();
}

function extractRncFromRawText(rawText: string): string {
  // Look for RNC patterns common in Dominican receipts
  const patterns = [
    /RNC[:\s]*(\d{9,11})/i,
    /R\.?N\.?C\.?[:\s]*(\d{9,11})/i,
    /REGISTRO\s*NACIONAL[:\s]*(\d{9,11})/i,
  ];
  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function parseAmount(value: string): number | null {
  if (!value) return null;
  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[^0-9.,\-]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(value: string): string | null {
  if (!value) return null;
  // Try common date formats
  // DD/MM/YYYY or DD-MM-YYYY (Dominican standard)
  const ddmmyyyy = value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  // YYYY-MM-DD
  const iso = value.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (iso) {
    const [, year, month, day] = iso;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
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

    const NANONETS_API_KEY = Deno.env.get("NANONETS_API_KEY");
    const NANONETS_MODEL_ID = Deno.env.get("NANONETS_MODEL_ID");

    if (!NANONETS_API_KEY || !NANONETS_MODEL_ID) {
      return new Response(
        JSON.stringify({ error: "OCR service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decode base64 to binary
    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Build multipart form
    const formData = new FormData();
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    formData.append("file", blob, file_name || "receipt.jpg");

    // Call Nanonets
    const nanonetsUrl = `https://app.nanonets.com/api/v2/OCR/Model/${NANONETS_MODEL_ID}/LabelFile/`;
    const nanonetsResponse = await fetch(nanonetsUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(NANONETS_API_KEY + ":"),
      },
      body: formData,
    });

    if (!nanonetsResponse.ok) {
      const errText = await nanonetsResponse.text();
      console.error("Nanonets API error:", nanonetsResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "OCR service returned an error" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const nanonetsData = await nanonetsResponse.json();

    // Extract predictions from first result
    const result = nanonetsData.result?.[0];
    if (!result) {
      return new Response(
        JSON.stringify({ error: "No OCR results returned" }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const predictions = result.prediction || [];
    const rawText = result.page_data?.raw_text || 
      predictions.map((p: any) => p.ocr_text || "").join(" ");

    // Extract fields
    const vendorName = extractFieldValue(predictions, "Merchant_Name") ||
      extractFieldValue(predictions, "merchant_name") ||
      extractFieldValue(predictions, "Seller_Name") ||
      extractFieldValue(predictions, "seller_name");

    const dateStr = extractFieldValue(predictions, "Date") ||
      extractFieldValue(predictions, "date") ||
      extractFieldValue(predictions, "Invoice_Date") ||
      extractFieldValue(predictions, "invoice_date");

    const totalStr = extractFieldValue(predictions, "Total_Amount") ||
      extractFieldValue(predictions, "total_amount") ||
      extractFieldValue(predictions, "Total") ||
      extractFieldValue(predictions, "total");

    const taxStr = extractFieldValue(predictions, "Tax_Amount") ||
      extractFieldValue(predictions, "tax_amount") ||
      extractFieldValue(predictions, "Tax") ||
      extractFieldValue(predictions, "tax");

    const receiptNumber = extractFieldValue(predictions, "Receipt_Number") ||
      extractFieldValue(predictions, "receipt_number") ||
      extractFieldValue(predictions, "Invoice_Number") ||
      extractFieldValue(predictions, "invoice_number");

    const cardTender = extractFieldValue(predictions, "Card_Tender") ||
      extractFieldValue(predictions, "card_tender") ||
      extractFieldValue(predictions, "Payment_Method") ||
      extractFieldValue(predictions, "payment_method");

    // Parse and structure the response
    const extracted = {
      vendor_name: vendorName,
      rnc: extractRncFromRawText(rawText),
      date: parseDate(dateStr),
      amount: parseAmount(totalStr),
      itbis: parseAmount(taxStr),
      document: receiptNumber,
      pay_method: cardTender ? "cc_management" : null,
      raw_text: rawText.substring(0, 500), // Send a preview for debugging
    };

    return new Response(JSON.stringify(extracted), {
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
