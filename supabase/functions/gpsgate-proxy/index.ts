import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GPSGATE_BASE = "https://systrack2.gpsgate.com/comGpsGate/api/v.1";
const APP_ID = 685;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Auth claims error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Check role
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const allowedRoles = ["admin", "management", "supervisor"];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const gpsApiKey = Deno.env.get("GPSGATE_API_KEY");
    if (!gpsApiKey) {
      return new Response(
        JSON.stringify({ error: "GPSGate API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const gpsHeaders = {
      Authorization: gpsApiKey,
      Accept: "application/json",
    };

    if (action === "list-assets") {
      const gpsUrl = `${GPSGATE_BASE}/applications/${APP_ID}/users?FromIndex=0&PageSize=1000&Kind=Asset`;
      const res = await fetch(gpsUrl, { headers: gpsHeaders });
      if (!res.ok) {
      if (!res.ok) {
        const errText = await res.text();
        console.error("GPSGate API error:", res.status, errText);
        return new Response(
          JSON.stringify({ error: `GPSGate API returned ${res.status}: ${errText}` }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "live-positions") {
      // Fetch all user statuses from GPSGate
      const res = await fetch(
        `${GPSGATE_BASE}/applications/${APP_ID}/usersstatus`,
        { headers: gpsHeaders }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error("GPSGate live-positions error:", res.status, errText);
        return new Response(
          JSON.stringify({ error: `GPSGate API returned ${res.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const allStatuses = await res.json();

      // Get linked tractors from fuel_equipment
      const { data: tractors } = await serviceClient
        .from("fuel_equipment")
        .select("id, name, gpsgate_user_id")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .not("gpsgate_user_id", "is", null);

      const gpsIdToTractor = new Map<number, { id: string; name: string }>();
      (tractors ?? []).forEach((t: any) => {
        gpsIdToTractor.set(t.gpsgate_user_id, { id: t.id, name: t.name });
      });

      // Filter to only linked tractors with valid positions
      const positions = (allStatuses as any[])
        .filter((s: any) => gpsIdToTractor.has(s.id) && s.position?.latitude !== 0 && s.position?.longitude !== 0)
        .map((s: any) => {
          const tractor = gpsIdToTractor.get(s.id)!;
          const engineOn = s.variables?.find((v: any) => v.name === "Engine on")?.value === "True";
          const speed = s.velocity?.groundSpeed ?? 0;
          return {
            tractorId: tractor.id,
            tractorName: tractor.name,
            gpsName: s.name,
            lat: s.position.latitude,
            lng: s.position.longitude,
            speed,
            engineOn,
            lastUpdate: s.utc,
          };
        });

      return new Response(JSON.stringify(positions), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "tracks") {
      const tractorId = url.searchParams.get("tractorId");
      const dateFrom = url.searchParams.get("dateFrom");
      const dateTo = url.searchParams.get("dateTo");

      if (!tractorId || !dateFrom || !dateTo) {
        return new Response(
          JSON.stringify({
            error: "Missing required params: tractorId, dateFrom, dateTo",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tractorId)) {
        return new Response(
          JSON.stringify({ error: "Invalid tractor ID format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Look up gpsgate_user_id from fuel_equipment
      const { data: tractor, error: tractorError } = await serviceClient
        .from("fuel_equipment")
        .select("gpsgate_user_id")
        .eq("id", tractorId)
        .single();

      if (tractorError || !tractor?.gpsgate_user_id) {
        return new Response(
          JSON.stringify({
            error: "Tractor not linked to GPSGate device",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const gpsUserId = tractor.gpsgate_user_id;

      // GPSGate API requires a "Date" param (YYYY-MM-DD) plus optional "From"/"Until" (HH:MM:SS)
      // dateFrom/dateTo may come as ISO strings or bare dates
      const startDate = dateFrom.split("T")[0];
      const endDate = dateTo.split("T")[0];

      // If same day, use single Date param; if multi-day, fetch each day
      const allPoints: any[] = [];
      const currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      
      while (currentDate <= lastDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const trackUrl = `${GPSGATE_BASE}/applications/${APP_ID}/users/${gpsUserId}/tracks?Date=${dateStr}`;

        const res = await fetch(trackUrl, { headers: gpsHeaders });
        if (res.ok) {
          const dayData = await res.json();
          if (Array.isArray(dayData)) {
            allPoints.push(...dayData);
          }
        } else {
          const errText = await res.text();
          console.error("GPSGate tracks error for", dateStr, ":", res.status, errText);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Normalize GPSGate format to {lat, lng, timestamp, speed}
      const data = allPoints
        .filter((p: any) => p.position?.latitude && p.position?.longitude)
        .map((p: any) => ({
          lat: p.position.latitude,
          lng: p.position.longitude,
          timestamp: p.utc || p.serverUtc || "",
          speed: p.velocity?.groundSpeed ?? 0,
        }));

      // Also fetch operations for this tractor in the date range for implement matching
      const { data: operations } = await serviceClient
        .from("operations")
        .select(
          "operation_date, implement_id, start_hours, end_hours, hectares_done, operation_type_id, implements(name), operation_types(name)"
        )
        .eq("tractor_id", tractorId)
        .gte("operation_date", dateFrom)
        .lte("operation_date", dateTo)
        .order("operation_date");

      return new Response(
        JSON.stringify({ tracks: data, operations: operations ?? [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error:
          "Unknown action. Use: list-assets, live-positions, or tracks",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("gpsgate-proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
