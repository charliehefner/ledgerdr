/**
 * Shared payroll calculation utilities for Dominican Republic tax compliance.
 * Used by PayrollSummary, IR-3 report, and IR-17 report.
 * 
 * Default values are hardcoded as fallbacks; the app can override them
 * by fetching from the tss_parameters table in the database.
 */

import { supabase } from "@/integrations/supabase/client";

// Default TSS Employee Rate: 3.04% AFP + 2.87% SFS = 5.91%
export let TSS_EMPLOYEE_RATE = 0.0591;

// Default ISR Progressive Tax Brackets (Annual Income - DOP)
export let ISR_BRACKETS = [
  { min: 0, max: 416220, rate: 0, baseTax: 0 },
  { min: 416220, max: 624329, rate: 0.15, baseTax: 0 },
  { min: 624329, max: 867123, rate: 0.20, baseTax: 31216 },
  { min: 867123, max: Infinity, rate: 0.25, baseTax: 79776 },
];

let _parametersLoaded = false;

/**
 * Load TSS/ISR parameters from the database. Call once at app init or payroll load.
 * Falls back to hardcoded defaults if the table is empty or fetch fails.
 */
export async function loadTssParameters(): Promise<void> {
  if (_parametersLoaded) return;
  try {
    const { data } = await supabase
      .from("tss_parameters" as any)
      .select("parameter_key, parameter_value")
      .order("effective_date", { ascending: false });

    if (!data || data.length === 0) return;

    const params = new Map<string, number>();
    // Take the first (most recent) value for each key
    for (const row of data as any[]) {
      if (!params.has(row.parameter_key)) {
        params.set(row.parameter_key, Number(row.parameter_value));
      }
    }

    if (params.has("tss_employee_rate")) TSS_EMPLOYEE_RATE = params.get("tss_employee_rate")!;
    if (params.has("isr_bracket_1_max")) {
      ISR_BRACKETS = [
        { min: 0, max: params.get("isr_bracket_1_max")!, rate: 0, baseTax: 0 },
        { min: params.get("isr_bracket_1_max")!, max: params.get("isr_bracket_2_max") ?? 624329, rate: 0.15, baseTax: params.get("isr_bracket_2_base_tax") ?? 0 },
        { min: params.get("isr_bracket_2_max") ?? 624329, max: params.get("isr_bracket_3_max") ?? 867123, rate: 0.20, baseTax: params.get("isr_bracket_3_base_tax") ?? 31216 },
        { min: params.get("isr_bracket_3_max") ?? 867123, max: Infinity, rate: 0.25, baseTax: params.get("isr_bracket_4_base_tax") ?? 79776 },
      ];
    }

    _parametersLoaded = true;
  } catch {
    // Silently fall back to defaults
  }
}

/**
 * Calculate annual ISR using Dominican Republic progressive tax brackets
 */
export function calculateAnnualISR(annualIncome: number): number {
  if (annualIncome <= ISR_BRACKETS[0].max) return 0;

  for (let i = ISR_BRACKETS.length - 1; i >= 0; i--) {
    const bracket = ISR_BRACKETS[i];
    if (annualIncome > bracket.min) {
      return bracket.baseTax + (annualIncome - bracket.min) * bracket.rate;
    }
  }
  return 0;
}

/**
 * Calculate the bi-monthly ISR for an employee given their monthly salary and benefits.
 * Returns the ISR amount for one payroll period (half-month).
 */
export function calculateBimonthlyISR(
  monthlySalary: number,
  monthlyBenefits: number = 0
): number {
  const monthlyTSS = monthlySalary * TSS_EMPLOYEE_RATE;
  const monthlyTaxable = monthlySalary - monthlyTSS + monthlyBenefits;
  const annualTaxableIncome = monthlyTaxable * 12;
  const annualISR = calculateAnnualISR(annualTaxableIncome);
  return annualISR / 24; // 24 bi-monthly periods per year
}

/**
 * Calculate monthly ISR for an employee (sum of 2 bi-monthly periods).
 */
export function calculateMonthlyISR(
  monthlySalary: number,
  monthlyBenefits: number = 0
): number {
  return calculateBimonthlyISR(monthlySalary, monthlyBenefits) * 2;
}

/**
 * Calculate retribuciones complementarias tax (27%) using gross-up formula.
 * Per DR tax law, the employer pays 27% on the grossed-up value.
 * Formula: benefit / 0.73 * 0.27
 */
export function calculateComplementaryTax(benefitAmount: number): number {
  if (benefitAmount <= 0) return 0;
  return (benefitAmount / 0.73) * 0.27;
}
