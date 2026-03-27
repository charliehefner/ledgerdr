/**
 * Pure utility functions for AP/AR document auto-creation logic.
 * Extracted from TransactionForm for testability.
 */

export interface ApArFormData {
  transaction_direction: string;
  pay_method: string;
  due_date: string | null | undefined;
  master_acct_code: string;
}

/** Determine if an AP/AR document should be auto-created for a transaction */
export function shouldCreateApAr(form: ApArFormData, isTransfer: boolean): boolean {
  if (isTransfer) return false;
  if (form.transaction_direction === 'payment' || form.transaction_direction === 'investment') return false;

  const isAdvance = form.master_acct_code.startsWith('1690');
  const hasCreditOrDueDate = !!(form.due_date || form.pay_method === 'credit');

  return hasCreditOrDueDate || isAdvance;
}

/** Get the correct GL account code for the AP/AR document */
export function getApArAccountCode(isAdvance: boolean, direction: 'payable' | 'receivable'): string {
  if (isAdvance) return '1690';
  return direction === 'receivable' ? '1210' : '2101';
}

/** Determine the AP/AR direction based on the transaction */
export function getApArDirection(form: ApArFormData): 'payable' | 'receivable' {
  const isAdvance = form.master_acct_code.startsWith('1690');
  if (isAdvance) return 'payable';
  return form.transaction_direction === 'sale' ? 'receivable' : 'payable';
}

/** Calculate default due date (+30 days) when credit but no explicit due_date */
export function getDefaultDueDate(transactionDate: string | Date): string {
  const d = new Date(transactionDate);
  d.setDate(d.getDate() + 30);
  // Format as YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}
