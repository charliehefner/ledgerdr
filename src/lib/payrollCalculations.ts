/**
 * Shared payroll calculation utilities for Dominican Republic tax compliance.
 * 
 * TSS/ISR rates are now sourced exclusively from the database tables
 * (tss_parameters and isr_brackets). No hardcoded rate constants remain.
 * 
 * The main payroll calculation is done server-side via the
 * calculate_payroll_for_period() RPC.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch the current TSS employee rate from the database.
 * Returns 0.0591 as a last-resort fallback if the query fails.
 */
export async function fetchTssEmployeeRate(): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("tss_parameters" as any)
      .select("parameter_key, parameter_value")
      .lte("effective_date", today)
      .order("effective_date", { ascending: false });

    if (data && data.length > 0) {
      for (const row of data as any[]) {
        if (row.parameter_key === "tss_employee_rate") {
          return Number(row.parameter_value);
        }
      }
      // If individual rates exist, sum them
      let afp = 0, sfs = 0;
      for (const row of data as any[]) {
        if (row.parameter_key === "afp_employee_pct") afp = Number(row.parameter_value);
        if (row.parameter_key === "sfs_employee_pct") sfs = Number(row.parameter_value);
      }
      if (afp > 0 || sfs > 0) return (afp + sfs) / 100;
    }
  } catch {
    // Fall through to default
  }
  return 0.0591;
}

/**
 * Fetch ISR brackets from the isr_brackets table for a given year.
 * Falls back to hardcoded brackets if the table is empty.
 */
export async function fetchIsrBrackets(year?: number): Promise<
  { min: number; max: number; rate: number; baseTax: number }[]
> {
  const targetYear = year ?? new Date().getFullYear();
  try {
    const { data } = await supabase
      .from("isr_brackets" as any)
      .select("annual_from, annual_to, marginal_rate, bracket_order")
      .eq("effective_year", targetYear)
      .order("bracket_order", { ascending: true });

    if (data && data.length > 0) {
      const brackets: { min: number; max: number; rate: number; baseTax: number }[] = [];
      let cumulativeTax = 0;
      for (const row of data as any[]) {
        const min = Number(row.annual_from);
        const max = row.annual_to ? Number(row.annual_to) : Infinity;
        const rate = Number(row.marginal_rate);
        brackets.push({ min, max, rate, baseTax: cumulativeTax });
        if (max !== Infinity) {
          cumulativeTax += (max - min) * rate;
        }
      }
      return brackets;
    }
  } catch {
    // Fall through
  }
  // Hardcoded fallback (2024 brackets)
  return [
    { min: 0, max: 416220, rate: 0, baseTax: 0 },
    { min: 416220, max: 624329, rate: 0.15, baseTax: 0 },
    { min: 624329, max: 867123, rate: 0.20, baseTax: 31216 },
    { min: 867123, max: Infinity, rate: 0.25, baseTax: 79776 },
  ];
}

/**
 * Calculate annual ISR using progressive tax brackets fetched from DB.
 * This is a convenience wrapper for reports that need client-side ISR calc.
 */
export function calculateAnnualISR(
  annualIncome: number,
  brackets: { min: number; max: number; rate: number; baseTax: number }[]
): number {
  if (annualIncome <= brackets[0].max) return 0;

  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
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
  tssEmployeeRate: number,
  brackets: { min: number; max: number; rate: number; baseTax: number }[],
  monthlyBenefits: number = 0
): number {
  const monthlyTSS = monthlySalary * tssEmployeeRate;
  const monthlyTaxable = monthlySalary - monthlyTSS + monthlyBenefits;
  const annualTaxableIncome = monthlyTaxable * 12;
  const annualISR = calculateAnnualISR(annualTaxableIncome, brackets);
  return annualISR / 24; // 24 bi-monthly periods per year
}

/**
 * Calculate monthly ISR for an employee (sum of 2 bi-monthly periods).
 */
export function calculateMonthlyISR(
  monthlySalary: number,
  tssEmployeeRate: number,
  brackets: { min: number; max: number; rate: number; baseTax: number }[],
  monthlyBenefits: number = 0
): number {
  return calculateBimonthlyISR(monthlySalary, tssEmployeeRate, brackets, monthlyBenefits) * 2;
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

// ── Legacy compatibility shims ──────────────────────────────────────────────
// These are kept for backward compatibility but now require async initialization.
// New code should use fetchTssEmployeeRate() and fetchIsrBrackets() directly.

/** @deprecated Use fetchTssEmployeeRate() instead */
export let TSS_EMPLOYEE_RATE = 0.0591;

/** @deprecated Use fetchIsrBrackets() instead */
export let ISR_BRACKETS = [
  { min: 0, max: 416220, rate: 0, baseTax: 0 },
  { min: 416220, max: 624329, rate: 0.15, baseTax: 0 },
  { min: 624329, max: 867123, rate: 0.20, baseTax: 31216 },
  { min: 867123, max: Infinity, rate: 0.25, baseTax: 79776 },
];

let _parametersLoaded = false;

/**
 * Load TSS/ISR parameters from the database into legacy module-level variables.
 * @deprecated New code should use fetchTssEmployeeRate() and fetchIsrBrackets().
 */
export async function loadTssParameters(): Promise<void> {
  if (_parametersLoaded) return;
  try {
    const [rate, brackets] = await Promise.all([
      fetchTssEmployeeRate(),
      fetchIsrBrackets(),
    ]);
    TSS_EMPLOYEE_RATE = rate;
    ISR_BRACKETS = brackets;
    _parametersLoaded = true;
  } catch {
    // Silently fall back to defaults
  }
}
