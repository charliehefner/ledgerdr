import { supabase } from "@/integrations/supabase/client";

export type DrilldownSourceType =
  | "transaction"
  | "payroll_run"
  | "depreciation_entry"
  | "fixed_asset"
  | "goods_receipt"
  | "purchase_order"
  | "bank_recon_match"
  | "recurring_template"
  | "accrual"
  | "manual"
  | "home_office_advance"
  | "home_office_repayment"
  | "home_office_accrual"
  | "home_office_fx_reval"
  | "cip_capitalize";

export interface DrilldownLink {
  link_id: string;
  source_type: DrilldownSourceType;
  source_id: string;
  source_label: string | null;
  route: string | null;
  state_badge: string | null;
}

export async function resolveDrilldown(journalId: string): Promise<DrilldownLink[]> {
  if (!journalId) return [];
  const { data, error } = await supabase.rpc("drilldown_resolve" as any, {
    p_journal_id: journalId,
  });
  if (error) {
    console.error("[drilldown_resolve]", error);
    return [];
  }
  return (data ?? []) as DrilldownLink[];
}

export const SOURCE_TYPE_LABEL_ES: Record<DrilldownSourceType, string> = {
  transaction: "Transacción",
  payroll_run: "Nómina",
  depreciation_entry: "Depreciación",
  fixed_asset: "Activo fijo",
  goods_receipt: "Recepción",
  purchase_order: "Orden de compra",
  bank_recon_match: "Conciliación bancaria",
  recurring_template: "Plantilla recurrente",
  accrual: "Provisión",
  manual: "Asiento manual",
  home_office_advance: "Aporte Casa Matriz",
  home_office_repayment: "Repago Casa Matriz",
  home_office_accrual: "Devengo de interés",
  home_office_fx_reval: "Reval. FX Casa Matriz",
  cip_capitalize: "Capitalización CIP",
};

export const SOURCE_TYPE_LABEL_EN: Record<DrilldownSourceType, string> = {
  transaction: "Transaction",
  payroll_run: "Payroll",
  depreciation_entry: "Depreciation",
  fixed_asset: "Fixed asset",
  goods_receipt: "Goods receipt",
  purchase_order: "Purchase order",
  bank_recon_match: "Bank reconciliation",
  recurring_template: "Recurring template",
  accrual: "Accrual",
  manual: "Manual entry",
  home_office_advance: "Home office advance",
  home_office_repayment: "Home office repayment",
  home_office_accrual: "Interest accrual",
  home_office_fx_reval: "Home office FX reval",
  cip_capitalize: "CIP capitalization",
};
