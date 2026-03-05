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
  master_acct_code: string | null;
  pay_method: string | null;
  cost_center: string | null;
  transaction_direction: string | null;
  destination_acct_code: string | null;
  destination_amount: number | null;
  currency: string | null;
}

interface BankAccountLookup {
  id: string;
  chart_account_id: string | null;
  currency: string | null;
}

function costCenterLabel(cc: string | null): string {
  if (!cc || cc === "general") return "";
  return ` [${cc === "agricultural" ? "Agrícola" : "Industrial"}]`;
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
      db.from("journals").select("transaction_source_id").not("transaction_source_id", "is", null).is("deleted_at", null),
      db.from("transactions")
        .select("id, transaction_date, description, amount, itbis, master_acct_code, pay_method, cost_center, transaction_direction, destination_acct_code, destination_amount, currency")
        .eq("is_void", false)
        .order("transaction_date", { ascending: true }),
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

    const itbisAccountId = acctByCode.get("1650");

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
      const isInvestment = txn.transaction_direction === "investment";
      const isTransfer = txn.transaction_direction === "payment";

      try {
        if (isInvestment) {
          const creditAccountId = txn.master_acct_code ? acctByCode.get(txn.master_acct_code) : null;
          const debitAccountId = txn.destination_acct_code ? acctByCode.get(txn.destination_acct_code) : null;

          if (!creditAccountId) { skipped.push(`${label}: cuenta crédito "${txn.master_acct_code}" no encontrada`); continue; }
          if (!debitAccountId) { skipped.push(`${label}: cuenta destino "${txn.destination_acct_code}" no encontrada`); continue; }

          const { data: journalId, error: jErr } = await db.rpc("create_journal_from_transaction", {
            p_transaction_id: txn.id,
            p_date: txn.transaction_date,
            p_description: `${txn.description || "Inversión"}${costCenterLabel(txn.cost_center)}`,
            p_created_by: userId,
            p_journal_type: "PJ",
          });
          if (jErr) { skipped.push(`${label}: ${jErr.message}`); continue; }

          const itbisAmount = txn.itbis || 0;
          const netAmount = txn.amount - itbisAmount;
          const lines: any[] = [
            { journal_id: journalId, account_id: debitAccountId, debit: netAmount, credit: 0, created_by: userId },
          ];
          if (itbisAmount > 0 && itbisAccountId) {
            lines.push({ journal_id: journalId, account_id: itbisAccountId, debit: itbisAmount, credit: 0, created_by: userId });
          }
          lines.push({ journal_id: journalId, account_id: creditAccountId, debit: 0, credit: txn.amount, created_by: userId });

          const { error: lErr } = await db.from("journal_lines").insert(lines);
          if (lErr) {
            await db.from("journals").delete().eq("id", journalId);
            skipped.push(`${label}: líneas: ${lErr.message}`);
          } else {
            created++;
          }
          continue;
        }

        if (isTransfer) {
          const sourceBankAcct = txn.pay_method ? bankAccountMap.get(txn.pay_method) : null;
          const sourceChartAccountId = sourceBankAcct?.chart_account_id || null;
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

          const lines: any[] = [];
          const sourceAmount = txn.amount;
          const destAmount = txn.destination_amount || txn.amount;
          const sourceCurrency = txn.currency || "DOP";
          const destBankAcct = txn.destination_acct_code ? bankAccountMap.get(txn.destination_acct_code) : null;
          const destCurrency = destBankAcct?.currency || "DOP";

          if (sourceCurrency === destCurrency || !txn.destination_amount) {
            lines.push({ journal_id: journalId, account_id: destChartAccountId, debit: sourceAmount, credit: 0, created_by: userId });
            lines.push({ journal_id: journalId, account_id: sourceChartAccountId, debit: 0, credit: sourceAmount, created_by: userId });
          } else {
            let debitAmount: number;
            let creditAmount: number;
            if (destCurrency === "DOP") {
              debitAmount = destAmount;
              creditAmount = destAmount;
            } else if (sourceCurrency === "DOP") {
              debitAmount = sourceAmount;
              creditAmount = sourceAmount;
            } else {
              debitAmount = sourceAmount;
              creditAmount = sourceAmount;
            }
            lines.push({ journal_id: journalId, account_id: destChartAccountId, debit: debitAmount, credit: 0, created_by: userId });
            lines.push({ journal_id: journalId, account_id: sourceChartAccountId, debit: 0, credit: creditAmount, created_by: userId });
          }

          const { error: lErr } = await db.from("journal_lines").insert(lines);
          if (lErr) {
            await db.from("journals").delete().eq("id", journalId);
            skipped.push(`${label}: líneas: ${lErr.message}`);
          } else {
            created++;
          }
          continue;
        }

        // Standard purchase/sale
        const expenseAccountId = txn.master_acct_code ? acctByCode.get(txn.master_acct_code) : null;
        const payAccountId = txn.pay_method ? mappingMap.get(txn.pay_method) : null;

        if (!expenseAccountId) { skipped.push(`${label}: cuenta gasto "${txn.master_acct_code}" no encontrada`); continue; }
        if (!payAccountId) { skipped.push(`${label}: método pago "${txn.pay_method}" sin mapeo`); continue; }

        const journalType = txn.transaction_direction === "sale" ? "SJ" : "PJ";
        const { data: journalId, error: jErr } = await db.rpc("create_journal_from_transaction", {
          p_transaction_id: txn.id,
          p_date: txn.transaction_date,
          p_description: `${txn.description || "Transacción"}${costCenterLabel(txn.cost_center)}`,
          p_created_by: userId,
          p_journal_type: journalType,
        });
        if (jErr) { skipped.push(`${label}: ${jErr.message}`); continue; }

        const itbisAmount = txn.itbis || 0;
        const netAmount = txn.amount - itbisAmount;
        const lines: any[] = [
          { journal_id: journalId, account_id: expenseAccountId, debit: netAmount, credit: 0, created_by: userId },
        ];
        if (itbisAmount > 0 && itbisAccountId) {
          lines.push({ journal_id: journalId, account_id: itbisAccountId, debit: itbisAmount, credit: 0, created_by: userId });
        }
        lines.push({ journal_id: journalId, account_id: payAccountId, debit: 0, credit: txn.amount, created_by: userId });

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
