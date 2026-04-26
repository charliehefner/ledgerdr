import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AccrualBody {
  entity_id: string;
  accrual_date: string;          // yyyy-mm-dd
  expense_account_id: string;
  liability_account_id?: string; // defaults to 2180
  amount: number;
  currency?: string;             // default DOP
  cost_center?: string | null;
  description: string;
  reference?: string | null;
}

function validateBody(b: any): { ok: true; body: AccrualBody } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "Cuerpo inválido" };
  if (typeof b.entity_id !== "string" || !b.entity_id) return { ok: false, error: "entity_id requerido" };
  if (typeof b.accrual_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.accrual_date))
    return { ok: false, error: "accrual_date debe ser yyyy-mm-dd" };
  if (typeof b.expense_account_id !== "string" || !b.expense_account_id)
    return { ok: false, error: "expense_account_id requerido" };
  if (b.liability_account_id != null && typeof b.liability_account_id !== "string")
    return { ok: false, error: "liability_account_id inválido" };
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0)
    return { ok: false, error: "amount debe ser > 0" };
  if (typeof b.description !== "string" || !b.description.trim())
    return { ok: false, error: "description requerido" };
  return { ok: true, body: b as AccrualBody };
}

function costCenterLabel(cc: string | null | undefined): string {
  if (!cc || cc === "general") return "";
  return ` [${cc === "agricultural" ? "Agrícola" : cc === "industrial" ? "Industrial" : cc}]`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return jsonResp({ error: "Unauthorized" }, 401);

  const userId = claimsData.claims.sub as string;
  const db = createClient(supabaseUrl, serviceKey);

  // Role check: admin or accountant only
  const { data: roleRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "accountant"])
    .limit(1)
    .maybeSingle();
  if (!roleRow) return jsonResp({ error: "Forbidden — only admins and accountants can create accruals" }, 403);

  // ── Validate body ──
  let bodyJson: any;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400);
  }
  const v = validateBody(bodyJson);
  if (!v.ok) return jsonResp({ error: v.error }, 400);
  const body = v.body;
  const currency = body.currency || "DOP";

  // ── Resolve liability account (default 2180) ──
  let liabilityAccountId = body.liability_account_id;
  if (!liabilityAccountId) {
    const { data: defAcct, error: defErr } = await db
      .from("chart_of_accounts")
      .select("id, allow_posting")
      .eq("account_code", "2180")
      .is("deleted_at", null)
      .maybeSingle();
    if (defErr || !defAcct) return jsonResp({ error: "Cuenta 2180 (Acumulaciones por Pagar) no existe en el plan de cuentas" }, 500);
    if (!defAcct.allow_posting) return jsonResp({ error: "Cuenta 2180 no permite asientos" }, 500);
    liabilityAccountId = defAcct.id as string;
  }
  if (liabilityAccountId === body.expense_account_id) {
    return jsonResp({ error: "La cuenta de gasto y la cuenta de pasivo deben ser distintas" }, 400);
  }

  // ── Validate both accounts ──
  const { data: acctRows, error: acctErr } = await db
    .from("chart_of_accounts")
    .select("id, account_code, account_name, account_type, allow_posting")
    .in("id", [body.expense_account_id, liabilityAccountId])
    .is("deleted_at", null);
  if (acctErr) return jsonResp({ error: acctErr.message }, 500);
  if (!acctRows || acctRows.length !== 2) return jsonResp({ error: "Una o ambas cuentas no existen" }, 400);
  for (const a of acctRows) {
    if (!a.allow_posting) return jsonResp({ error: `Cuenta ${a.account_code} no permite asientos` }, 400);
  }

  // ── Period validation: accrual_date must fall in an OPEN period ──
  const { data: periodsAll, error: pErr } = await db
    .from("accounting_periods")
    .select("id, start_date, end_date, status, is_closed")
    .is("deleted_at", null)
    .order("start_date", { ascending: true });
  if (pErr) return jsonResp({ error: pErr.message }, 500);

  const isPeriodOpen = (p: any) =>
    p.status === "open" && p.is_closed !== true;

  const accrualPeriod = (periodsAll || []).find((p: any) =>
    body.accrual_date >= p.start_date && body.accrual_date <= p.end_date
  );
  if (!accrualPeriod) return jsonResp({ error: "La fecha de acumulación no cae en ningún período contable" }, 400);
  if (!isPeriodOpen(accrualPeriod)) {
    return jsonResp({ error: "La fecha de acumulación cae en un período cerrado o bloqueado" }, 400);
  }

  // Reversal: first OPEN period with start_date > accrual period end_date
  const reversalPeriod = (periodsAll || []).find((p: any) =>
    p.start_date > accrualPeriod.end_date && isPeriodOpen(p)
  );
  if (!reversalPeriod) {
    return jsonResp({ error: "No hay un período abierto futuro para programar el reverso" }, 400);
  }
  const reversalDate = reversalPeriod.start_date;

  // ── Insert both journals + lines + accrual_entries row ──
  // Strategy: insert journals as draft (posted=false). Accountant posts via JournalView.
  // On any failure after insert, roll back created journals.
  const ccLbl = costCenterLabel(body.cost_center);
  const refPrefix = body.reference ? `${body.reference} — ` : "";
  const accrualDescr = `Acumulación: ${refPrefix}${body.description}${ccLbl}`;
  const reversalDescr = `Reverso de acumulación: ${refPrefix}${body.description}${ccLbl}`;

  const createdJournalIds: string[] = [];
  const rollback = async () => {
    if (createdJournalIds.length === 0) return;
    await db.from("journals").delete().in("id", createdJournalIds);
  };

  try {
    // Accrual journal
    const { data: aj, error: ajErr } = await db
      .from("journals")
      .insert({
        journal_date: body.accrual_date,
        journal_type: "GJ",
        description: accrualDescr,
        currency,
        exchange_rate: 1,
        period_id: accrualPeriod.id,
        entity_id: body.entity_id,
        created_by: userId,
        posted: false,
        approval_status: "pending",
        reference_description: body.reference || null,
      })
      .select("id")
      .single();
    if (ajErr || !aj) throw new Error(`Asiento de acumulación: ${ajErr?.message || "sin id"}`);
    createdJournalIds.push(aj.id as string);

    const { error: alErr } = await db.from("journal_lines").insert([
      {
        journal_id: aj.id,
        account_id: body.expense_account_id,
        debit: body.amount,
        credit: 0,
        description: `Gasto acumulado${ccLbl}`,
        created_by: userId,
      },
      {
        journal_id: aj.id,
        account_id: liabilityAccountId,
        debit: 0,
        credit: body.amount,
        description: `Pasivo acumulado`,
        created_by: userId,
      },
    ]);
    if (alErr) throw new Error(`Líneas asiento acumulación: ${alErr.message}`);

    // Reversal journal
    const { data: rj, error: rjErr } = await db
      .from("journals")
      .insert({
        journal_date: reversalDate,
        journal_type: "GJ",
        description: reversalDescr,
        currency,
        exchange_rate: 1,
        period_id: reversalPeriod.id,
        entity_id: body.entity_id,
        created_by: userId,
        posted: false,
        approval_status: "pending",
        reversal_of_id: aj.id,
        reference_description: body.reference || null,
      })
      .select("id")
      .single();
    if (rjErr || !rj) throw new Error(`Asiento de reverso: ${rjErr?.message || "sin id"}`);
    createdJournalIds.push(rj.id as string);

    const { error: rlErr } = await db.from("journal_lines").insert([
      {
        journal_id: rj.id,
        account_id: liabilityAccountId,
        debit: body.amount,
        credit: 0,
        description: `Reverso pasivo acumulado`,
        created_by: userId,
      },
      {
        journal_id: rj.id,
        account_id: body.expense_account_id,
        debit: 0,
        credit: body.amount,
        description: `Reverso gasto${ccLbl}`,
        created_by: userId,
      },
    ]);
    if (rlErr) throw new Error(`Líneas asiento reverso: ${rlErr.message}`);

    // accrual_entries row
    const { data: ae, error: aeErr } = await db
      .from("accrual_entries")
      .insert({
        entity_id: body.entity_id,
        accrual_date: body.accrual_date,
        reversal_date: reversalDate,
        expense_account_id: body.expense_account_id,
        liability_account_id: liabilityAccountId,
        amount: body.amount,
        currency,
        cost_center: body.cost_center || null,
        description: body.description,
        reference: body.reference || null,
        accrual_journal_id: aj.id,
        reversal_journal_id: rj.id,
        status: "scheduled",
        created_by: userId,
      })
      .select("id")
      .single();
    if (aeErr || !ae) throw new Error(`Registro de acumulación: ${aeErr?.message || "sin id"}`);

    return jsonResp({
      accrual_entry_id: ae.id,
      accrual_journal_id: aj.id,
      reversal_journal_id: rj.id,
      reversal_date: reversalDate,
    });
  } catch (e: any) {
    await rollback();
    try {
      await db.from("app_error_log").insert({
        user_id: userId,
        component_name: "post-accrual",
        error_message: e?.message || "unknown",
      });
    } catch { /* never block */ }
    return jsonResp({ error: e?.message || "Error al crear acumulación" }, 500);
  }
});
