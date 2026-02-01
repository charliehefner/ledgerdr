import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      throw new Error("Query is required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch context data for the AI to use
    const [
      farmsRes, 
      fieldsRes, 
      operationTypesRes, 
      recentOpsRes, 
      employeesRes,
      rainfallRes,
      dayLaborRes,
      inventoryRes
    ] = await Promise.all([
      supabase.from("farms").select("id, name").eq("is_active", true),
      supabase.from("fields").select("id, name, farm_id, hectares").eq("is_active", true),
      supabase.from("operation_types").select("id, name").eq("is_active", true),
      supabase.from("operations").select(`
        id, operation_date, hectares_done, driver, notes, workers_count,
        field:fields(name, farm:farms(name)),
        operation_type:operation_types(name),
        tractor:fuel_equipment(name),
        implement:implements(name)
      `).order("operation_date", { ascending: false }).limit(100),
      supabase.from("employees_safe").select("id, name, position, is_active"),
      supabase.from("rainfall_records").select("record_date, solar, caoba, palmarito, virgencita").order("record_date", { ascending: false }).limit(60),
      supabase.from("day_labor_entries").select("work_date, worker_name, workers_count, field_name, operation_description, amount").order("work_date", { ascending: false }).limit(100),
      supabase.from("inventory_items").select("commercial_name, molecule_name, function, current_quantity, use_unit").eq("is_active", true),
    ]);

    // Build context for the AI
    const farms = farmsRes.data || [];
    const fields = fieldsRes.data || [];
    const operationTypes = operationTypesRes.data || [];
    const recentOps = recentOpsRes.data || [];
    const employees = employeesRes.data || [];
    const rainfall = rainfallRes.data || [];
    const dayLabor = dayLaborRes.data || [];
    const inventory = inventoryRes.data || [];

    const systemPrompt = `Eres un asistente de datos para una empresa agrícola en República Dominicana llamada Dallas Agro / Jord Dominicana.
Tu trabajo es responder preguntas sobre las operaciones, empleados y datos de la empresa basándote en los datos proporcionados.

DATOS DISPONIBLES:

FINCAS (Farms):
${farms.map(f => `- ${f.name} (ID: ${f.id})`).join("\n")}

CAMPOS (Fields):
${fields.map(f => {
  const farm = farms.find(fa => fa.id === f.farm_id);
  return `- ${f.name} en ${farm?.name || "desconocido"}, ${f.hectares || "?"} hectáreas`;
}).join("\n")}

TIPOS DE OPERACIONES:
${operationTypes.map(t => `- ${t.name}`).join("\n")}

EMPLEADOS ACTIVOS:
${employees.filter(e => e.is_active).map(e => `- ${e.name} (${e.position})`).join("\n")}

OPERACIONES RECIENTES (últimas 100):
${recentOps.slice(0, 50).map((op: any) => {
  const fieldName = op.field?.name || "?";
  const farmName = op.field?.farm?.name || "?";
  const opType = op.operation_type?.name || "?";
  return `- ${op.operation_date}: ${opType} en ${fieldName} (${farmName}), ${op.hectares_done} ha${op.driver ? `, operador: ${op.driver}` : ""}`;
}).join("\n")}

PLUVIOMETRÍA (Precipitación en mm, últimos 60 días):
Ubicaciones: Solar, Caoba, Palmarito, Virgencita
${rainfall.slice(0, 30).map((r: any) => `- ${r.record_date}: Solar=${r.solar || 0}, Caoba=${r.caoba || 0}, Palmarito=${r.palmarito || 0}, Virgencita=${r.virgencita || 0}`).join("\n")}

JORNALES (Day Labor, últimos 100 registros):
${dayLabor.slice(0, 50).map((d: any) => `- ${d.work_date}: ${d.workers_count} trabajador(es)${d.worker_name ? ` (${d.worker_name})` : ""}, ${d.operation_description}${d.field_name ? ` en ${d.field_name}` : ""}, RD$${d.amount}`).join("\n")}

INVENTARIO (Items activos, sin precios):
${inventory.map((i: any) => `- ${i.commercial_name}${i.molecule_name ? ` (${i.molecule_name})` : ""}: ${i.current_quantity} ${i.use_unit}, Función: ${i.function}`).join("\n")}

INSTRUCCIONES:
- Responde siempre en español
- Sé conciso pero informativo
- Si no tienes datos suficientes para responder, indícalo claramente
- Para cálculos de totales, suma los valores de las operaciones relevantes
- Para preguntas sobre lluvia, puedes calcular totales por ubicación o fecha
- Si la pregunta es sobre datos que no tienes (transacciones financieras, precios de inventario, préstamos de empleados), indica que esos datos no están disponibles en esta búsqueda
- Formatea números con separadores de miles cuando sea apropiado`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA agotados. Contacta al administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const answer = aiData.choices?.[0]?.message?.content || "No pude generar una respuesta.";

    return new Response(
      JSON.stringify({ answer, query }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
