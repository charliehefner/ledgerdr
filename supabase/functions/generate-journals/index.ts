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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: posting-rule extra lines
// ─────────────────────────────────────────────────────────────────────────────
type ExtraSplit =
  | { type: "percent"; value: number }
  | { type: "fixed"; value: number }
  | { type: "remainder" };

interface ExtraLineSpec {
  account_code: string;
  side: "debit" | "credit";
  split: ExtraSplit;
  cost_center?: "general" | "agricultural" | "industrial";
  description?: string;
}

interface ResolvedExtraLine {
  account_id: string;
  side: "debit" | "credit";
  amount: number;            // > 0
  description: string;
  rule_id: string;
  rule_name: string;
}

/**
 * Resolve all extra_lines from matched rules into concrete amounts + accounts.
 * Returns null if any validation fails (caller falls back to standard journal).
 * Validation errors are pushed into `errors` so the caller can log them.
 */
function resolveExtraLines(
  matchedRules: Array<{ rule_id: string; rule_name: string; actions: any }>,
  netAmount: number,
  acctByCode: Map<string, string>,
  errors: string[],
): {
  debit: ResolvedExtraLine[];
  credit: ResolvedExtraLine[];
  replaceMainDebit: boolean;
  replaceMainCredit: boolean;
} {
  const out = { debit: [] as ResolvedExtraLine[], credit: [] as ResolvedExtraLine[], replaceMainDebit: false, replaceMainCredit: false };
  const MAX = 10;
  let total = 0;

  for (const rule of matchedRules) {
    const a = rule.actions || {};
    const lines: ExtraLineSpec[] = Array.isArray(a.extra_lines) ? a.extra_lines : [];
    if (lines.length === 0) continue;
    if (a.replace_main_debit) out.replaceMainDebit = true;
    if (a.replace_main_credit) out.replaceMainCredit = true;

    // Group this rule's lines by side for percent/remainder math
    const sums = { debit: { pct: 0, fixed: 0, hasRemainder: false }, credit: { pct: 0, fixed: 0, hasRemainder: false } };
    for (const l of lines) {
      if (l.split?.type === "percent") sums[l.side].pct += Number(l.split.value) || 0;
      else if (l.split?.type === "fixed") sums[l.side].fixed += Number(l.split.value) || 0;
      else if (l.split?.type === "remainder") sums[l.side].hasRemainder = true;
    }
    if (sums.debit.pct > 100 || sums.credit.pct > 100) {
      errors.push(`Regla "${rule.rule_name}": suma de % > 100 en un lado; se omiten líneas extra`);
      continue;
    }

    // Resolve each line to an amount
    for (const l of lines) {
      total++;
      if (total > MAX) {
        errors.push(`Regla "${rule.rule_name}": >${MAX} líneas extra; se omiten las restantes`);
        break;
      }
      if (!l.account_code || (l.side !== "debit" && l.side !== "credit") || !l.split?.type) {
        errors.push(`Regla "${rule.rule_name}": forma de línea inválida`);
        continue;
      }
      const accountId = acctByCode.get(l.account_code);
      if (!accountId) {
        errors.push(`Regla "${rule.rule_name}": cuenta "${l.account_code}" no existe o no permite asientos`);
        continue;
      }
      let amount = 0;
      if (l.split.type === "percent") {
        amount = (netAmount * Number(l.split.value)) / 100;
      } else if (l.split.type === "fixed") {
        amount = Number(l.split.value);
      } else if (l.split.type === "remainder") {
        const usedPctShare = (netAmount * sums[l.side].pct) / 100;
        amount = netAmount - usedPctShare - sums[l.side].fixed;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push(`Regla "${rule.rule_name}": monto calculado inválido para cuenta ${l.account_code}`);
        continue;
      }
      const cc = l.cost_center ? ` [${l.cost_center === "agricultural" ? "Agrícola" : l.cost_center === "industrial" ? "Industrial" : "General"}]` : "";
      const desc = (l.description || rule.rule_name) + cc;
      out[l.side].push({
        account_id: accountId,
        side: l.side,
        amount: Math.round(amount * 100) / 100,
        description: desc,
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.5: amortization scheduler
// ─────────────────────────────────────────────────────────────────────────────
interface AmortizeSpec {
  months: number;
  start_date: string;
  expense_account_code?: string;
  prepaid_account_code?: string;
}

interface PeriodLookup {
  id: string;
  start_date: string;
  end_date: string;
  status: string;       // 'open' | 'closed' | 'reported' | 'locked'
  is_closed: boolean | null;
}

/** Pull `amortize` from the highest-priority matched rule that defines it. */
function findAmortizeAction(
  matchedRules: Array<{ rule_id: string; rule_name: string; actions: any }>,
): { spec: AmortizeSpec; rule_id: string; rule_name: string } | null {
  for (const r of matchedRules) {
    const a = r.actions?.amortize;
    if (a && Number.isFinite(a.months) && a.months >= 2 && a.start_date) {
      return { spec: a as AmortizeSpec, rule_id: r.rule_id, rule_name: r.rule_name };
    }
  }
  return null;
}

/**
 * Build N slice dates: same day-of-month as start_date, advancing one calendar
 * month at a time. Day clamps to month-end (e.g., Jan-31 → Feb-28).
 */
function buildSliceDates(startISO: string, months: number): string[] {
  const [y, m, d] = startISO.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < months; i++) {
    const dt = new Date(Date.UTC(y, m - 1 + i, 1));
    const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    out.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

/** Find the open accounting period containing `dateISO`. Returns null if none / closed. */
function findOpenPeriodForDate(dateISO: string, periods: PeriodLookup[]): PeriodLookup | null {
  for (const p of periods) {
    if (dateISO >= p.start_date && dateISO <= p.end_date) {
      const blocked = p.is_closed === true || p.status === "closed" || p.status === "reported" || p.status === "locked";
      return blocked ? null : p;
    }
  }
  return null;
}

/** Split `total` into N equal slices of 2 decimals, with rounding remainder absorbed into the last slice. */
function splitAmount(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const slices = new Array(n).fill(base);
  const sum = base * n;
  const remainder = Math.round((total - sum) * 100) / 100;
  slices[n - 1] = Math.round((slices[n - 1] + remainder) * 100) / 100;
  return slices;
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
    const [mappingsRes, accountsRes, bankRes, linkedRes, txnsRes, icConfigRes, entitiesRes, periodsRes] = await Promise.all([
      db.from("payment_method_accounts").select("pay_method, account_id"),
      db.from("chart_of_accounts").select("id, account_code").eq("allow_posting", true).is("deleted_at", null),
      db.from("bank_accounts").select("id, chart_account_id, currency, entity_id, is_shared"),
      db.from("journals").select("transaction_source_id").not("transaction_source_id", "is", null).is("deleted_at", null).limit(10000),
      db.from("transactions")
        .select("id, transaction_date, description, amount, itbis, itbis_retenido, isr_retenido, master_acct_code, account_id, pay_method, cost_center, transaction_direction, destination_acct_code, destination_amount, currency, exchange_rate, entity_id, manual_credit_account_code")
        .eq("is_void", false)
        .order("transaction_date", { ascending: true })
        .limit(10000),
      db.from("intercompany_account_config").select("group_id, receivable_account_id, payable_account_id"),
      db.from("entities").select("id, entity_group_id"),
      db.from("accounting_periods").select("id, start_date, end_date, status, is_closed").is("deleted_at", null),
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
    const periodsList: PeriodLookup[] = (periodsRes.data || []) as PeriodLookup[];

    // Intercompany config maps
    const icConfigByGroup = new Map<string, IntercompanyConfig>(
      (icConfigRes.data || []).map((c: any) => [c.group_id, c as IntercompanyConfig])
    );
    const entityGroupMap = new Map<string, string>(
      (entitiesRes.data || []).filter((e: any) => e.entity_group_id).map((e: any) => [e.id, e.entity_group_id])
    );

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
        let payAccountId = resolvePayAccountId(txn.pay_method, mappingMap, bankAccountMap);

        // Posting-rule override: when a rule set manual_credit_account_code,
        // use that account instead of the auto-resolved bank/AP/AR account.
        // (For purchases this overrides the credit side; for sales the debit/cash side.)
        const manualCreditCode: string | null = (txn as any).manual_credit_account_code || null;
        if (manualCreditCode) {
          const overrideId = acctByCode.get(manualCreditCode);
          if (overrideId) {
            payAccountId = overrideId;
          } else {
            // Don't block — fall back silently to auto, log to console for ops visibility.
            console.warn(`[generate-journals] manual_credit_account_code "${manualCreditCode}" not found in chart_of_accounts (txn ${txn.id}); using auto.`);
          }
        }

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

        // ── PHASE 2: evaluate posting rules + resolve extra lines ──
        let matchedRules: Array<{ rule_id: string; rule_name: string; actions: any }> = [];
        try {
          const { data: rulesData } = await db.rpc("evaluate_posting_rules", {
            p_entity_id: txn.entity_id,
            p_payload: {
              vendor: (txn as any).name ?? null,
              description: txn.description,
              document: (txn as any).document ?? null,
              amount: txn.amount,
              currency: txn.currency || "DOP",
              transaction_type: txn.transaction_direction,
              context: "transaction_entry",
            },
          });
          matchedRules = (rulesData || []) as any[];
        } catch (rErr: any) {
          console.warn(`[generate-journals] rule eval failed for txn ${txn.id}: ${rErr?.message}`);
        }

        const ruleErrors: string[] = [];
        const extras = resolveExtraLines(matchedRules, netAmount, acctByCode, ruleErrors);
        const debitExtrasTotal = extras.debit.reduce((s, l) => s + l.amount, 0);
        const creditExtrasTotal = extras.credit.reduce((s, l) => s + l.amount, 0);

        // ── PHASE 2.5: amortization (purchase only) ──
        // If a rule with `amortize` matched and this is a purchase, validate target
        // periods are open, swap the main debit to the prepaid account, and queue
        // N monthly DR Expense / CR Prepaid slice journals to post after the original.
        let amortizePlan: {
          rule_id: string;
          rule_name: string;
          expenseAccountId: string;
          prepaidAccountId: string;
          slices: Array<{ date: string; amount: number; period_id: string }>;
        } | null = null;

        if (!isSale && !isTransfer) {
          const am = findAmortizeAction(matchedRules);
          if (am) {
            const months = Math.max(2, Math.min(60, Math.floor(am.spec.months)));
            const expenseCode = am.spec.expense_account_code || txn.master_acct_code || "";
            const prepaidCode = am.spec.prepaid_account_code || "1480";
            const expenseAccountId = expenseCode ? acctByCode.get(expenseCode) : undefined;
            const prepaidAccountId = acctByCode.get(prepaidCode);

            if (!expenseAccountId) {
              skipped.push(`${label}: amortización - cuenta de gasto "${expenseCode}" no permite asientos`);
              continue;
            }
            if (!prepaidAccountId) {
              skipped.push(`${label}: amortización - cuenta de prepago "${prepaidCode}" no permite asientos`);
              continue;
            }
            if (expenseAccountId === prepaidAccountId) {
              skipped.push(`${label}: amortización - cuenta de gasto y prepago son la misma`);
              continue;
            }

            const sliceDates = buildSliceDates(am.spec.start_date, months);
            const sliceAmounts = splitAmount(netAmount, months);
            const slicePlan: Array<{ date: string; amount: number; period_id: string }> = [];
            let blocked: string | null = null;
            for (let i = 0; i < months; i++) {
              const period = findOpenPeriodForDate(sliceDates[i], periodsList);
              if (!period) {
                blocked = sliceDates[i];
                break;
              }
              slicePlan.push({ date: sliceDates[i], amount: sliceAmounts[i], period_id: period.id });
            }
            if (blocked) {
              skipped.push(`${label}: amortización bloqueada — el mes ${blocked} cae en un período cerrado o inexistente`);
              continue;
            }

            amortizePlan = { rule_id: am.rule_id, rule_name: am.rule_name, expenseAccountId, prepaidAccountId, slices: slicePlan };
          }
        }

        if (isSale) {
          // ── SALE: Debit bank/cash, Credit revenue + ITBIS por Pagar ──
          // For sales, replace_main_debit affects the bank/cash line; replace_main_credit affects revenue.
          if (!extras.replaceMainDebit) {
            lines.push({
              journal_id: journalId, account_id: payAccountId,
              debit: txn.amount, credit: 0, created_by: userId,
              description: `Cobro venta${costCenterLabel(txn.cost_center)}`,
            });
          }
          if (!extras.replaceMainCredit) {
            lines.push({
              journal_id: journalId, account_id: mainAccountId,
              debit: 0, credit: netAmount, created_by: userId,
              description: `Ingreso venta`,
            });
          }
          if (itbisAmount > 0 && itbisPorPagarId) {
            lines.push({
              journal_id: journalId, account_id: itbisPorPagarId,
              debit: 0, credit: itbisAmount, created_by: userId,
              description: "ITBIS por Pagar",
            });
          }
          // Splice extras
          for (const e of extras.debit) {
            lines.push({ journal_id: journalId, account_id: e.account_id, debit: e.amount, credit: 0, created_by: userId, description: e.description });
          }
          for (const e of extras.credit) {
            lines.push({ journal_id: journalId, account_id: e.account_id, debit: 0, credit: e.amount, created_by: userId, description: e.description });
          }
        } else {
          // ── PURCHASE: Debit expense + ITBIS pagado, Credit bank/cash ──
          if (!extras.replaceMainDebit) {
            lines.push({
              journal_id: journalId, account_id: mainAccountId,
              debit: netAmount, credit: 0, created_by: userId,
              description: `Gasto${costCenterLabel(txn.cost_center)}`,
            });
          }
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

          // Splice debit extras (e.g. cost-center splits)
          for (const e of extras.debit) {
            lines.push({ journal_id: journalId, account_id: e.account_id, debit: e.amount, credit: 0, created_by: userId, description: e.description });
          }
          // Splice credit extras (e.g. ISR accrual) — these reduce what's left to credit to bank
          for (const e of extras.credit) {
            lines.push({ journal_id: journalId, account_id: e.account_id, debit: 0, credit: e.amount, created_by: userId, description: e.description });
            bankCredit -= e.amount;
          }
          // If credit extras don't replace the bank line, post the (reduced) bank line.
          if (!extras.replaceMainCredit) {
            lines.push({
              journal_id: journalId, account_id: payAccountId,
              debit: 0, credit: Math.max(0, bankCredit), created_by: userId,
              description: `Pago`,
            });
          }
        }

        // ── BALANCE GUARD ──
        const totalD = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        const totalC = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
        if (Math.abs(totalD - totalC) > 0.01) {
          await db.from("journals").delete().eq("id", journalId);
          skipped.push(`${label}: asiento desbalanceado D=${totalD.toFixed(2)} C=${totalC.toFixed(2)} (revisar reglas con líneas extra)`);
          continue;
        }

        const { error: lErr } = await db.from("journal_lines").insert(lines);
        if (lErr) {
          await db.from("journals").delete().eq("id", journalId);
          skipped.push(`${label}: líneas: ${lErr.message}`);
        } else {
          created++;

          // ── PHASE 2: log rule applications + any extras errors ──
          if (matchedRules.length > 0) {
            try {
              const extrasByRule = new Map<string, number>();
              for (const e of [...extras.debit, ...extras.credit]) {
                extrasByRule.set(e.rule_id, (extrasByRule.get(e.rule_id) || 0) + 1);
              }
              const appRows = matchedRules.map(r => ({
                rule_id: r.rule_id,
                transaction_id: txn.id,
                context: "journal_generation",
                applied_fields: {
                  ...(extrasByRule.get(r.rule_id) ? { extra_lines: extrasByRule.get(r.rule_id) } : {}),
                  ...(extras.replaceMainDebit ? { replace_main_debit: true } : {}),
                  ...(extras.replaceMainCredit ? { replace_main_credit: true } : {}),
                },
                applied_by: userId,
              }));
              await db.from("posting_rule_applications").insert(appRows);
            } catch (logErr: any) {
              console.warn(`[generate-journals] PRA log failed: ${logErr?.message}`);
            }
          }
          if (ruleErrors.length > 0) {
            try {
              await db.from("app_error_log").insert(
                ruleErrors.map(msg => ({
                  user_id: userId,
                  component_name: "generate-journals/extra_lines",
                  error_message: `Txn ${txn.id}: ${msg}`,
                }))
              );
            } catch { /* never block */ }
          }

          // ── INTERCOMPANY DETECTION ──
          // Check if pay_method bank account belongs to a different entity in the same group
          const bankAcct = txn.pay_method ? bankAccountMap.get(txn.pay_method) : null;
          if (
            bankAcct?.is_shared &&
            bankAcct.entity_id &&
            txn.entity_id &&
            bankAcct.entity_id !== txn.entity_id
          ) {
            const payerGroupId = entityGroupMap.get(bankAcct.entity_id);
            const beneficiaryGroupId = entityGroupMap.get(txn.entity_id);

            if (payerGroupId && payerGroupId === beneficiaryGroupId) {
              const icConfig = icConfigByGroup.get(payerGroupId);
              if (icConfig) {
                try {
                  // Create payer journal: DR 1570 (receivable from beneficiary) / CR Bank
                  const { data: payerJournalId, error: pjErr } = await db.rpc("create_journal_from_transaction", {
                    p_transaction_id: txn.id,
                    p_date: txn.transaction_date,
                    p_description: `IC: ${txn.description || "Pago intercompañía"}${costCenterLabel(txn.cost_center)}`,
                    p_created_by: userId,
                    p_journal_type: "GJ",
                  });

                  if (!pjErr && payerJournalId) {
                    await db.from("journals").update({
                      currency: txn.currency || "DOP",
                      exchange_rate: exchangeRate,
                      entity_id: bankAcct.entity_id,
                    }).eq("id", payerJournalId);

                    const payerLines = [
                      {
                        journal_id: payerJournalId,
                        account_id: icConfig.receivable_account_id,
                        debit: txn.amount, credit: 0, created_by: userId,
                        description: `CxC Intercompañía`,
                      },
                      {
                        journal_id: payerJournalId,
                        account_id: bankAcct.chart_account_id,
                        debit: 0, credit: txn.amount, created_by: userId,
                        description: `Pago por cuenta de subsidiaria`,
                      },
                    ];

                    const { error: plErr } = await db.from("journal_lines").insert(payerLines);
                    if (plErr) {
                      await db.from("journals").delete().eq("id", payerJournalId);
                      skipped.push(`${label}: IC payer lines: ${plErr.message}`);
                    } else {
                      created++;

                      // Update beneficiary journal: replace bank credit with CR 2470 (payable to payer)
                      // The beneficiary journal already has the expense lines correct,
                      // but we need to swap the bank credit line to use the payable account
                      await db.from("journal_lines")
                        .update({ account_id: icConfig.payable_account_id, description: "CxP Intercompañía" })
                        .eq("journal_id", journalId)
                        .eq("account_id", payAccountId)
                        .gt("credit", 0);

                      // Record in intercompany_transactions
                      await db.from("intercompany_transactions").insert({
                        group_id: payerGroupId,
                        source_entity_id: bankAcct.entity_id,
                        target_entity_id: txn.entity_id,
                        journal_id_source: payerJournalId,
                        journal_id_target: journalId,
                        amount: txn.amount,
                        currency: txn.currency || "DOP",
                        description: txn.description || null,
                        transaction_date: txn.transaction_date,
                        is_settled: false,
                      });
                    }
                  } else if (pjErr) {
                    skipped.push(`${label}: IC payer journal: ${pjErr.message}`);
                  }
                } catch (icErr: any) {
                  skipped.push(`${label}: IC error: ${icErr.message || "unknown"}`);
                }
              } else {
                skipped.push(`${label}: IC sin config para grupo ${payerGroupId}`);
              }
            }
          }
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
