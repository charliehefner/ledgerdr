import { supabase } from '@/integrations/supabase/client';
import { updateTransaction } from './api';

export interface TransactionEdit {
  transaction_id: string;
  document?: string | null;
}

/**
 * Get local edits for a specific transaction
 * @deprecated - Transaction edits are now stored directly in transactions table
 */
export async function getTransactionEdit(transactionId: string): Promise<TransactionEdit | null> {
  // Now we just return null since edits are in the main transactions table
  return null;
}

/**
 * Get local edits for multiple transactions
 * @deprecated - Transaction edits are now stored directly in transactions table
 */
export async function getTransactionEdits(transactionIds: string[]): Promise<Record<string, TransactionEdit>> {
  // Return empty since edits are now in the main transactions table
  return {};
}

/**
 * Save or update a local edit for a transaction
 * Now updates the transactions table directly
 */
export async function saveTransactionEdit(transactionId: string, edit: Partial<Omit<TransactionEdit, 'transaction_id'>>): Promise<boolean> {
  try {
    await updateTransaction(transactionId, {
      document: edit.document,
    });
    return true;
  } catch (error) {
    console.error('Error saving transaction edit:', error);
    return false;
  }
}
