import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch the BCRD homepage to scrape the current exchange rate
    const bcrdUrl = "https://www.bancentral.gov.do/";
    const response = await fetch(bcrdUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LedgerDR/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(`BCRD fetch failed: ${response.status}`);
    }

    const html = await response.text();

    // Extract buy and sell rates from the HTML
    // The BCRD homepage shows: Compra XX.XXXX / Venta XX.XXXX
    // Look for patterns like "61.3359" near "Compra" and "Venta"
    const buyMatch = html.match(
      /Compra[\s\S]*?(\d{2}\.\d{2,4})/i
    );
    const sellMatch = html.match(
      /Venta[\s\S]*?(\d{2}\.\d{2,4})/i
    );

    if (!buyMatch || !sellMatch) {
      throw new Error("Could not parse exchange rates from BCRD page");
    }

    const buyRate = parseFloat(buyMatch[1]);
    const sellRate = parseFloat(sellMatch[1]);

    if (isNaN(buyRate) || isNaN(sellRate) || buyRate < 30 || buyRate > 120) {
      throw new Error(
        `Invalid rates parsed: buy=${buyMatch[1]}, sell=${sellMatch[1]}`
      );
    }

    // Store in database using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("exchange_rates").upsert(
      {
        rate_date: today,
        currency_pair: "USD/DOP",
        buy_rate: buyRate,
        sell_rate: sellRate,
        source: "BCRD",
      },
      { onConflict: "rate_date,currency_pair" }
    );

    if (error) throw error;

    console.log(`Exchange rate saved: ${today} - Buy: ${buyRate}, Sell: ${sellRate}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        buy_rate: buyRate,
        sell_rate: sellRate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error fetching exchange rate:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
