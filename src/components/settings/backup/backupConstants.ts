import { supabase } from '@/integrations/supabase/client';

// Priority-ordered list for FK-safe INSERT ordering.
// Tables listed here will be exported first, in this order.
// Any tables discovered dynamically that are NOT in this list
// will be appended alphabetically at the end.
export const TABLE_PRIORITY_ORDER = [
  'projects', 
  'cbs_codes',
  'user_roles',
  'farms',
  'fields',
  'operation_types',
  'fuel_equipment',
  'fuel_tanks',
  'implements',
  'inventory_items',
  'employees',
  'payroll_periods',
  'employee_benefits',
  'employee_documents',
  'employee_incidents',
  'employee_salary_history',
  'employee_vacations',
  'employee_loans',
  'employee_timesheets',
  'period_employee_benefits',
  'day_labor_entries',
  'day_labor_attachments',
  'transactions',
  'transaction_attachments',
  'transaction_edits',
  'fuel_transactions',
  'pending_fuel_submissions',
  'tractor_maintenance',
  'operations',
  'operation_inputs',
  'inventory_purchases',
  'ap_ar_documents',
  'ap_ar_payments',
  'advance_allocations',
  'service_contracts',
  'service_contract_entries',
  'service_contract_line_items',
  'service_contract_payments',
  'cronograma_weeks',
  'cronograma_entries',
  'rainfall_records',
  'jornaleros',
  'exchange_rates',
  'scheduled_user_deletions',
  // Accounting tables
  'chart_of_accounts',
  'accounting_periods',
  'tax_codes',
  'journals',
  'journal_lines',
  'bank_accounts',
  'bank_statement_lines',
  'fixed_assets',
  'fixed_asset_depreciation_entries',
  'depreciation_schedule',
  'asset_depreciation_rules',
  'contacts',
  'contact_bank_accounts',
  'budget_lines',
  'accounting_audit_log',
  'recurring_journal_templates',
  'recurring_journal_template_lines',
  'ap_ar_document_transactions',
  'alert_configurations',
  // Service provider tables
  'service_providers',
  'service_entries',
  'service_entry_payments',
  // Other
  'prestaciones_parameters',
  'liquidation_cases',
  'transaction_audit_log',
] as const;

/**
 * Fetch the full list of public tables from the database,
 * ordered by FK-safe priority first, then alphabetically for the rest.
 */
export async function getOrderedTableList(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_all_public_tables');
  
  if (error || !data) {
    console.warn('Failed to fetch dynamic table list, falling back to priority list:', error?.message);
    return [...TABLE_PRIORITY_ORDER];
  }
  
  const allTableNames = (data as any[]).map((r: any) => r.table_name as string);
  const prioritySet = new Set<string>(TABLE_PRIORITY_ORDER);
  
  // Start with priority-ordered tables that actually exist
  const ordered: string[] = [];
  for (const t of TABLE_PRIORITY_ORDER) {
    if (allTableNames.includes(t)) {
      ordered.push(t);
    }
  }
  
  // Append any remaining tables not in the priority list (alphabetically)
  const remaining = allTableNames
    .filter(t => !prioritySet.has(t))
    .sort();
  
  return [...ordered, ...remaining];
}
