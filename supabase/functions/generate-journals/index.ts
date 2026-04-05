import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UnlinkedTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  itbis: number | null;
  itbis_retenido: number | null;
  isr_retenido: number | null;
  master_acct_code: string | null;
  account_id: string | null;
  pay_method: string | null;
  cost_center: string | null;
  transaction_direction: string | null;
  destination_acct_code: string | null;
  destination_amount: number | null;
  currency: string | null;
  exchange_rate: number | null;
  entity_id: string | null;
}

interface BankAccountLookup {
  id: string;
  chart_account_id: string | null;
  currency: string | null;
  entity_id: string | null;
  is_shared: boolean;
}

interface IntercompanyConfig {
  group_id: string;
  receivable_account_id: string;
  payable_account_id: string;
}

function costCenterLabel(cc: string | null): string {
  if (!cc || cc === "general") return "";
  return ` [${cc === "agricultural" ? "Agrícola" : "Industrial"}]`;
}

/** Resolve pay_method to a chart_account_id: try legacy mapping first, then bank_accounts UUID lookup */
function resolvePayAccountId(
  payMethod: string | null,
  mappingMap: Map<string, string>,
  bankAccountMap: Map<string, BankAccountLookup>
): string | null {
  if (!payMethod) return null;
  // 1. Legacy string mapping
  const legacyId = mappingMap.get(payMethod);
  if (legacyId) return legacyId;
  // 2. UUID-based bank account lookup
  const bankAcct = bankAccountMap.get(payMethod);
  if (bankAcct?.chart_account_id) return bankAcct.chart_account_id;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Service role client for all DB operations
    const db = createClient(supabaseUrl, serviceKey);

    // Role check
    const { data: roleData } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const allowedRoles = ["admin", "management", "accountant"];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch lookup data ---
    const [mappingsRes, accountsRes, bankRes, linkedRes, txnsRes] = await Promise.all([
      db.from("payment_method_accounts").select("pay_method, account_id"),
      db.from("chart_of_accounts").select("id, account_code").eq("allow_posting", true).is("deleted_at", null),
      db.from("bank_accounts").select("id, chart_account_id, currency"),
      db.from("journals").select("transaction_source_id").not("transaction_source_id", "is", null).is("deleted_at", null).limit(10000),
      db.from("transactions")
        .select("id, transaction_date, description, amount, itbis, itbis_retenido, isr_retenido, master_acct_code, account_id, pay_method, cost_center, transaction_direction, destination_acct_code, destination_amount, currency, exchange_rate, entity_id")
        .eq("is_void", false)
        .order("transaction_date", { ascending: true })
        .limit(10000),
    ]);

    if (mappingsRes.error) throw mappingsRes.error;
    if (accountsRes.error) throw accountsRes.error;
    if (bankRes.error) throw bankRes.error;
    if (txnsRes.error) throw txnsRes.error;

    const mappingMap = new Map<string, string>(
      (mappingsRes.data || []).map((m: any) => [m.pay_method, m.account_id])
    );
    const acctByCode = new Map<string, string>(
      (accountsRes.data || []).map((a: any) => [a.account_code, a.id])
    );
    const bankAccountMap = new Map<string, BankAccountLookup>(
      (bankRes.data || []).map((b: any) => [b.id, b as BankAccountLookup])
    );
    const linkedIds = new Set((linkedRes.data || []).map((j: any) => j.transaction_source_id));

    // Tax account IDs
    const itbisPagadoId = acctByCode.get("1650");     // ITBIS Pagado (purchase input tax)
    const itbisPorPagarId = acctByCode.get("2110");   // ITBIS por Pagar (sales output tax)
    const itbisRetenidoId = acctByCode.get("2160");   // ITBIS Retenido liability
    const isrRetenidoId = acctByCode.get("2170");     // ISR Retenido liability

    const unlinked = ((txnsRes.data || []) as UnlinkedTransaction[]).filter(
      (t) => !linkedIds.has(t.id)
    );

    if (unlinked.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, skipped: [], total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let created = 0;
    const skipped: string[] = [];

    for (const txn of unlinked) {
      const label = txn.description || txn.id;
      const isTransfer = txn.transaction_direction === "payment";
      const isSale = txn.transaction_direction === "sale";
      const exchangeRate = txn.exchange_rate || 1;

      try {
        if (isTransfer) {
          // Resolve source: try legacy mapping then bank account UUID
          const sourceChartAccountId = resolvePayAccountId(txn.pay_method, mappingMap, bankAccountMap);
          if (!sourceChartAccountId) { skipped.push(`${label}: cuenta origen sin mapeo contable`); continue; }

          let destChartAccountId: string | null = null;
          if (txn.destination_acct_code) {
            const destBankAcct = bankAccountMap.get(txn.destination_acct_code);
            if (destBankAcct?.chart_account_id) {
              destChartAccountId = destBankAcct.chart_account_id;
            } else {
              destChartAccountId = acctByCode.get(txn.destination_acct_code) || null;
            }
          }
          if (!destChartAccountId) { skipped.push(`${label}: cuenta destino sin mapeo contable`); continue; }

          const { data: journalId, error: jErr } = await db.rpc("create_journal_from_transaction", {
            p_transaction_id: txn.id,
            p_date: txn.transaction_date,
            p_description: `${txn.description || "Transferencia"}${costCenterLabel(txn.cost_center)}`,
            p_created_by: userId,
            p_journal_type: "CDJ",
          });
          if (jErr) { skipped.push(`${label}: ${jErr.message}`); continue; }

          // Set exchange_rate, currency, and entity_id on journal
          await db.from("journals").update({
            currency: txn.currency || "DOP",
            exchange_rate: exchangeRate,
            ...(txn.entity_id ? { entity_id: txn.entity_id } : {}),
          }).eq("id", journalId);

          // Finding 5 fix: Always use sourceAmount for both sides to keep journal balanced.
          // Cross-currency context is captured in journal header (currency + exchange_rate).
          const sourceAmount = txn.amount;
          const lines: any[] = [
            { journal_id: journalId, account_id: destChartAccountId, debit: sourceAmount, credit: 0, created_by: userId },
            { journal_id: journalId, account_id: sourceChartAccountId, debit: 0, credit: sourceAmount, created_by: userId },
          ];

          const { error: lErr } = await db.from("journal_lines").insert(lines);
          if (lErr) {
            await db.from("journals").delete().eq("id", journalId);
            skipped.push(`${label}: líneas: ${lErr.message}`);
          } else {
            created++;
          }
          continue;
        }

        // Prefer UUID FK (account_id) over legacy text code lookup
        const mainAccountId = txn.account_id || (txn.master_acct_code ? acctByCode.get(txn.master_acct_code) : null);
        // Finding 1 fix: resolve pay_method via legacy mapping OR bank_accounts UUID
        const payAccountId = resolvePayAccountId(txn.pay_method, mappingMap, bankAccountMap);

        if (!mainAccountId) { skipped.push(`${label}: cuenta "${txn.master_acct_code}" no encontrada (account_id nulo)`); continue; }
        if (!payAccountId) { skipped.push(`${label}: método pago "${txn.pay_method}" sin mapeo`); continue; }

        const journalType = isSale ? "SJ" : "PJ";
        const { data: journalId, error: jErr } = await db.rpc("create_journal_from_transaction", {
          p_transaction_id: txn.id,
          p_date: txn.transaction_date,
          p_description: `${txn.description || "Transacción"}${costCenterLabel(txn.cost_center)}`,
          p_created_by: userId,
          p_journal_type: journalType,
        });
        if (jErr) { skipped.push(`${label}: ${jErr.message}`); continue; }

        // Set exchange_rate, currency, and entity_id on journal
        await db.from("journals").update({
          currency: txn.currency || "DOP",
          exchange_rate: exchangeRate,
          ...(txn.entity_id ? { entity_id: txn.entity_id } : {}),
        }).eq("id", journalId);

        const itbisAmount = txn.itbis || 0;
        const itbisRetenido = txn.itbis_retenido || 0;
        const isrRetenido = txn.isr_retenido || 0;
        const netAmount = txn.amount - itbisAmount;
        const lines: any[] = [];

        if (isSale) {
          // ── SALE: Debit bank/cash, Credit revenue + ITBIS por Pagar ──
          lines.push({
            journal_id: journalId, account_id: payAccountId,
            debit: txn.amount, credit: 0, created_by: userId,
            description: `Cobro venta${costCenterLabel(txn.cost_center)}`,
          });
          lines.push({
            journal_id: journalId, account_id: mainAccountId,
            debit: 0, credit: netAmount, created_by: userId,
            description: `Ingreso venta`,
          });
          if (itbisAmount > 0 && itbisPorPagarId) {
            lines.push({
              journal_id: journalId, account_id: itbisPorPagarId,
              debit: 0, credit: itbisAmount, created_by: userId,
              description: "ITBIS por Pagar",
            });
          }
        } else {
          // ── PURCHASE: Debit expense + ITBIS pagado, Credit bank/cash ──
          lines.push({
            journal_id: journalId, account_id: mainAccountId,
            debit: netAmount, credit: 0, created_by: userId,
            description: `Gasto${costCenterLabel(txn.cost_center)}`,
          });
          if (itbisAmount > 0 && itbisPagadoId) {
            lines.push({
              journal_id: journalId, account_id: itbisPagadoId,
              debit: itbisAmount, credit: 0, created_by: userId,
              description: "ITBIS Pagado",
            });
          }

          // Withholding lines reduce the amount credited to bank
          let bankCredit = txn.amount;

          if (itbisRetenido > 0 && itbisRetenidoId) {
            lines.push({
              journal_id: journalId, account_id: itbisRetenidoId,
              debit: 0, credit: itbisRetenido, created_by: userId,
              description: "ITBIS Retenido",
            });
            bankCredit -= itbisRetenido;
          }
          if (isrRetenido > 0 && isrRetenidoId) {
            lines.push({
              journal_id: journalId, account_id: isrRetenidoId,
              debit: 0, credit: isrRetenido, created_by: userId,
              description: "ISR Retenido",
            });
            bankCredit -= isrRetenido;
          }

          lines.push({
            journal_id: journalId, account_id: payAccountId,
            debit: 0, credit: Math.max(0, bankCredit), created_by: userId,
            description: `Pago`,
          });
        }

        const { error: lErr } = await db.from("journal_lines").insert(lines);
        if (lErr) {
          await db.from("journals").delete().eq("id", journalId);
          skipped.push(`${label}: líneas: ${lErr.message}`);
        } else {
          created++;
        }
      } catch (e: any) {
        skipped.push(`${label}: ${e.message || "error desconocido"}`);
      }
    }

    return new Response(
      JSON.stringify({ created, skipped, total: unlinked.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
