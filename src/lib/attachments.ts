import { supabase } from '@/integrations/supabase/client';

export type AttachmentCategory = 'ncf' | 'payment_receipt' | 'quote';

export interface TransactionAttachment {
  transaction_id: string;
  attachment_url: string;
  attachment_category: AttachmentCategory;
}

// Get attachment file path for a transaction from local database (legacy - single attachment)
export async function getAttachmentUrl(transactionId: string | number): Promise<string | null> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('attachment_url')
    .eq('transaction_id', String(transactionId))
    .maybeSingle();

  if (error) {
    console.error('Error fetching attachment:', error);
    return null;
  }

  return data?.attachment_url || null;
}

// Get all attachments for a transaction by category
export async function getAttachmentsByCategory(transactionId: string | number): Promise<Record<AttachmentCategory, string | null>> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('attachment_url, attachment_category')
    .eq('transaction_id', String(transactionId));

  if (error) {
    console.error('Error fetching attachments:', error);
    return { ncf: null, payment_receipt: null, quote: null };
  }

  const result: Record<AttachmentCategory, string | null> = {
    ncf: null,
    payment_receipt: null,
    quote: null
  };

  data?.forEach(item => {
    const category = item.attachment_category as AttachmentCategory;
    if (category in result) {
      result[category] = item.attachment_url;
    }
  });

  return result;
}

// Get attachment URLs for multiple transactions (returns payment_receipt by default for backward compatibility)
export async function getAttachmentUrls(transactionIds: (string | number)[]): Promise<Record<string, string>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id, attachment_url, attachment_category')
    .in('transaction_id', transactionIds.map(String))
    .eq('attachment_category', 'payment_receipt');

  if (error) {
    console.error('Error fetching attachments:', error);
    return {};
  }

  const result: Record<string, string> = {};
  data?.forEach(item => {
    result[item.transaction_id] = item.attachment_url;
  });

  return result;
}

// Get all attachments for multiple transactions, organized by transaction and category
export async function getAllAttachmentUrls(transactionIds: (string | number)[]): Promise<Record<string, Record<AttachmentCategory, string | null>>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id, attachment_url, attachment_category')
    .in('transaction_id', transactionIds.map(String));

  if (error) {
    console.error('Error fetching attachments:', error);
    return {};
  }

  const result: Record<string, Record<AttachmentCategory, string | null>> = {};
  
  // Initialize all transactions with empty categories
  transactionIds.forEach(id => {
    result[String(id)] = { ncf: null, payment_receipt: null, quote: null };
  });

  data?.forEach(item => {
    const txId = item.transaction_id;
    const category = item.attachment_category as AttachmentCategory;
    if (result[txId] && category in result[txId]) {
      result[txId][category] = item.attachment_url;
    }
  });

  return result;
}

// Save or update attachment URL for a transaction with specific category
export async function saveAttachment(
  transactionId: string | number, 
  attachmentUrl: string,
  category: AttachmentCategory = 'payment_receipt'
): Promise<boolean> {
  const { error } = await supabase
    .from('transaction_attachments')
    .upsert(
      { 
        transaction_id: String(transactionId), 
        attachment_url: attachmentUrl,
        attachment_category: category
      },
      { 
        onConflict: 'transaction_id,attachment_category' 
      }
    );

  if (error) {
    console.error('Error saving attachment:', error);
    return false;
  }

  return true;
}

// Delete attachment for a transaction (specific category or all)
export async function deleteAttachment(
  transactionId: string | number,
  category?: AttachmentCategory
): Promise<boolean> {
  let query = supabase
    .from('transaction_attachments')
    .delete()
    .eq('transaction_id', String(transactionId));

  if (category) {
    query = query.eq('attachment_category', category);
  }

  const { error } = await query;

  if (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }

  return true;
}

// Get a signed URL for viewing an attachment (for private bucket)
export async function getSignedAttachmentUrl(attachmentUrl: string): Promise<string | null> {
  if (!attachmentUrl) return null;

  // Extract the file path from the stored URL
  const match = attachmentUrl.match(/transaction-attachments\/(.+)$/);
  if (!match) {
    console.error('Could not extract file path from URL:', attachmentUrl);
    return null;
  }

  const filePath = match[1];

  try {
    // Get the current session to include auth token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('No active session for signed URL request');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('get-signed-url', {
      body: { filePath },
    });

    if (error) {
      // Don't spam console with auth errors - just return null silently
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    // Silently fail to prevent screen freeze
    return null;
  }
}

// Check if a transaction has a payment receipt attachment
export async function hasPaymentReceipt(transactionId: string | number): Promise<boolean> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('id')
    .eq('transaction_id', String(transactionId))
    .eq('attachment_category', 'payment_receipt')
    .maybeSingle();

  if (error) {
    console.error('Error checking payment receipt:', error);
    return false;
  }

  return !!data;
}

// Get payment receipt status for multiple transactions
export async function getPaymentReceiptStatus(transactionIds: (string | number)[]): Promise<Record<string, boolean>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id')
    .in('transaction_id', transactionIds.map(String))
    .eq('attachment_category', 'payment_receipt');

  if (error) {
    console.error('Error fetching payment receipt status:', error);
    return {};
  }

  const result: Record<string, boolean> = {};
  transactionIds.forEach(id => {
    result[String(id)] = false;
  });
  
  data?.forEach(item => {
    result[item.transaction_id] = true;
  });

  return result;
}
