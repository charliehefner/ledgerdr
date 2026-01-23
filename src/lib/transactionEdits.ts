import { supabase } from '@/integrations/supabase/client';

export interface TransactionEdit {
  transaction_id: string;
  document?: string | null;
}

/**
 * Get local edits for a specific transaction
 */
export async function getTransactionEdit(transactionId: string): Promise<TransactionEdit | null> {
  const { data, error } = await supabase
    .from('transaction_edits')
    .select('transaction_id, document')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching transaction edit:', error);
    return null;
  }

  return data;
}

/**
 * Get local edits for multiple transactions
 */
export async function getTransactionEdits(transactionIds: string[]): Promise<Record<string, TransactionEdit>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_edits')
    .select('transaction_id, document')
    .in('transaction_id', transactionIds);

  if (error) {
    console.error('Error fetching transaction edits:', error);
    return {};
  }

  const editsMap: Record<string, TransactionEdit> = {};
  data?.forEach(edit => {
    editsMap[edit.transaction_id] = edit;
  });

  return editsMap;
}

/**
 * Save or update a local edit for a transaction
 */
export async function saveTransactionEdit(transactionId: string, edit: Partial<Omit<TransactionEdit, 'transaction_id'>>): Promise<boolean> {
  const { error } = await supabase
    .from('transaction_edits')
    .upsert({
      transaction_id: transactionId,
      ...edit,
    }, {
      onConflict: 'transaction_id',
    });

  if (error) {
    console.error('Error saving transaction edit:', error);
    return false;
  }

  return true;
}
