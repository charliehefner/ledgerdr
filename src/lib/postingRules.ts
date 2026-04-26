import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 1 Posting Rules engine — client wrapper.
 *
 * Calls the `evaluate_posting_rules` RPC and returns the matching rules,
 * highest-priority first (entity-specific before global, then by `priority`).
 *
 * Callers merge actions themselves (first match wins per field) so they can
 * decide whether to skip already-edited fields.
 */

export type PostingRuleContext = "transaction_entry" | "bank_quick_entry";

export interface PostingRulePayload {
  vendor?: string | null;
  description?: string | null;
  document?: string | null;       // NCF
  amount?: number | null;
  currency?: string | null;
  transaction_type?: string | null; // purchase | sale | payment
  context?: PostingRuleContext;
}

/**
 * Phase 2: extra journal lines (splits / accruals / surcharges).
 * Resolved server-side in `generate-journals`. See PostingRulesManager
 * for the editor UI and validation rules.
 */
export type PostingRuleExtraSplit =
  | { type: "percent"; value: number }       // % of net amount
  | { type: "fixed"; value: number }         // flat amount in txn currency
  | { type: "remainder" };                   // leftover on this side (max 1 per side)

export interface PostingRuleExtraLine {
  account_code: string;
  side: "debit" | "credit";
  split: PostingRuleExtraSplit;
  cost_center?: "general" | "agricultural" | "industrial";
  description?: string;
}

/**
 * Phase 2.5: multi-period amortization spec.
 * When present on a purchase rule, `generate-journals` posts the original
 * transaction as DR Prepaid / CR Bank and then creates N additional monthly
 * journals (DR Expense / CR Prepaid) starting on `start_date`.
 */
export interface PostingRuleAmortize {
  /** Number of monthly slices, 2..60. */
  months: number;
  /** First slice date (ISO yyyy-mm-dd). Subsequent slices fall on the same day-of-month of following months. */
  start_date: string;
  /** Account that receives the monthly expense. Defaults to `master_account_code`. */
  expense_account_code?: string;
  /** Asset account that holds the prepaid balance. Defaults to "1480". */
  prepaid_account_code?: string;
}

export interface PostingRuleAction {
  master_account_code?: string;
  /**
   * Optional explicit credit account. When set, generate-journals will use it
   * instead of the auto-resolved bank/AP/AR account on the credit side.
   * Useful for reclassifications and non-standard liability postings.
   * Leave empty for normal flow (~95% of cases).
   */
  credit_account_code?: string;
  project_code?: string;
  cbs_code?: string;
  cost_center?: "general" | "agricultural" | "industrial";
  append_note?: string;
  /** Phase 2 — additional balanced lines added by the engine. */
  extra_lines?: PostingRuleExtraLine[];
  /** When true and any debit extras exist, suppress the default debit-to-master line. */
  replace_main_debit?: boolean;
  /** When true and any credit extras exist, suppress the default bank/AP/AR credit line. */
  replace_main_credit?: boolean;
  /** Phase 2.5 — multi-period amortization. Purchase transactions only. */
  amortize?: PostingRuleAmortize;
}

export interface MatchedRule {
  rule_id: string;
  rule_name: string;
  priority: number;
  actions: PostingRuleAction;
}

/**
 * Fetch matching rules from the database for a given input payload.
 */
export async function evaluatePostingRules(
  entityId: string | null,
  payload: PostingRulePayload
): Promise<MatchedRule[]> {
  // Bail early if nothing identifying is present
  const hasInput =
    (payload.vendor && payload.vendor.trim()) ||
    (payload.description && payload.description.trim()) ||
    (payload.document && payload.document.trim()) ||
    payload.amount != null;
  if (!hasInput) return [];

  const { data, error } = await supabase.rpc("evaluate_posting_rules", {
    p_entity_id: entityId,
    p_payload: payload as any,
  });

  if (error) {
    // Don't break the form on rule errors — just skip suggestions
    console.warn("[postingRules] evaluation failed:", error.message);
    return [];
  }

  return (data || []) as MatchedRule[];
}

/**
 * Merge action sets from multiple matched rules: first match wins per field.
 * Returns a flat object of suggestions ready to spread into form state.
 */
export function mergeRuleActions(rules: MatchedRule[]): PostingRuleAction {
  const merged: PostingRuleAction = {};
  for (const rule of rules) {
    const a = rule.actions || {};
    if (a.master_account_code && !merged.master_account_code)
      merged.master_account_code = a.master_account_code;
    if (a.credit_account_code && !merged.credit_account_code)
      merged.credit_account_code = a.credit_account_code;
    if (a.project_code && !merged.project_code) merged.project_code = a.project_code;
    if (a.cbs_code && !merged.cbs_code) merged.cbs_code = a.cbs_code;
    if (a.cost_center && !merged.cost_center) merged.cost_center = a.cost_center;
    if (a.append_note && !merged.append_note) merged.append_note = a.append_note;
  }
  return merged;
}

/**
 * Silently log which rules touched fields on a transaction.
 * Failures are swallowed — audit logging must never block transaction save.
 */
export async function logRuleApplications(params: {
  transactionId: string;
  rules: MatchedRule[];
  appliedFields: Record<string, unknown>;
  context?: PostingRuleContext;
}): Promise<void> {
  if (!params.rules.length) return;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;

    const rows = params.rules.map((r) => ({
      rule_id: r.rule_id,
      transaction_id: params.transactionId,
      context: params.context || "transaction_entry",
      applied_fields: params.appliedFields,
      applied_by: userId,
    }));
    await supabase.from("posting_rule_applications").insert(rows as any);
  } catch (e) {
    console.warn("[postingRules] audit log failed:", e);
  }
}
