import { supabase } from '@/integrations/supabase/client';

export type AttachmentCategory = 'ncf' | 'payment_receipt' | 'quote';

export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  attachment_url: string;
  attachment_category: AttachmentCategory;
  created_at: string;
}

/** Single URL per category (legacy compat – returns first found) */
export type CategoryAttachmentsSingle = Record<AttachmentCategory, string | null>;

/** Multiple URLs per category */
export type CategoryAttachmentsMulti = Record<AttachmentCategory, TransactionAttachment[]>;

// Get attachment file path for a transaction from local database (legacy - single attachment)
export async function getAttachmentUrl(transactionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('attachment_url')
    .eq('transaction_id', transactionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching attachment:', error);
    return null;
  }

  return data?.attachment_url || null;
}

// Get all attachments for a transaction by category (single per category – legacy compat)
export async function getAttachmentsByCategory(transactionId: string): Promise<CategoryAttachmentsSingle> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('attachment_url, attachment_category')
    .eq('transaction_id', transactionId);

  if (error) {
    console.error('Error fetching attachments:', error);
    return { ncf: null, payment_receipt: null, quote: null };
  }

  const result: CategoryAttachmentsSingle = {
    ncf: null,
    payment_receipt: null,
    quote: null
  };

  data?.forEach(item => {
    const category = item.attachment_category as AttachmentCategory;
    if (category in result && !result[category]) {
      result[category] = item.attachment_url;
    }
  });

  return result;
}

// Get ALL attachments for a transaction grouped by category (supports multiple per category)
export async function getAttachmentsByCategoryMulti(transactionId: string): Promise<CategoryAttachmentsMulti> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('id, transaction_id, attachment_url, attachment_category, created_at')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching attachments:', error);
    return { ncf: [], payment_receipt: [], quote: [] };
  }

  const result: CategoryAttachmentsMulti = { ncf: [], payment_receipt: [], quote: [] };

  data?.forEach(item => {
    const category = item.attachment_category as AttachmentCategory;
    if (category in result) {
      result[category].push(item as TransactionAttachment);
    }
  });

  return result;
}

// Get attachment URLs for multiple transactions (returns payment_receipt by default for backward compatibility)
export async function getAttachmentUrls(transactionIds: string[]): Promise<Record<string, string>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id, attachment_url, attachment_category')
    .in('transaction_id', transactionIds)
    .eq('attachment_category', 'payment_receipt');

  if (error) {
    console.error('Error fetching attachments:', error);
    return {};
  }

  const result: Record<string, string> = {};
  data?.forEach(item => {
    if (!result[item.transaction_id]) {
      result[item.transaction_id] = item.attachment_url;
    }
  });

  return result;
}

// Get all attachments for multiple transactions, organized by transaction and category (first per category for compat)
export async function getAllAttachmentUrls(transactionIds: string[]): Promise<Record<string, CategoryAttachmentsSingle>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id, attachment_url, attachment_category')
    .in('transaction_id', transactionIds);

  if (error) {
    console.error('Error fetching attachments:', error);
    return {};
  }

  const result: Record<string, CategoryAttachmentsSingle> = {};
  
  transactionIds.forEach(id => {
    result[id] = { ncf: null, payment_receipt: null, quote: null };
  });

  data?.forEach(item => {
    const txId = item.transaction_id;
    const category = item.attachment_category as AttachmentCategory;
    if (result[txId] && category in result[txId] && !result[txId][category]) {
      result[txId][category] = item.attachment_url;
    }
  });

  return result;
}

// Get all attachments for multiple transactions with full multi-per-category support
export async function getAllAttachmentUrlsMulti(transactionIds: string[]): Promise<Record<string, CategoryAttachmentsMulti>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('id, transaction_id, attachment_url, attachment_category, created_at')
    .in('transaction_id', transactionIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching attachments:', error);
    return {};
  }

  const result: Record<string, CategoryAttachmentsMulti> = {};
  
  transactionIds.forEach(id => {
    result[id] = { ncf: [], payment_receipt: [], quote: [] };
  });

  data?.forEach(item => {
    const txId = item.transaction_id;
    const category = item.attachment_category as AttachmentCategory;
    if (result[txId] && category in result[txId]) {
      result[txId][category].push(item as TransactionAttachment);
    }
  });

  return result;
}

// Save attachment for a transaction (always inserts – multiple per category allowed)
export async function saveAttachment(
  transactionId: string, 
  attachmentUrl: string,
  category: AttachmentCategory = 'payment_receipt'
): Promise<boolean> {
  const { error } = await supabase
    .from('transaction_attachments')
    .insert({ 
      transaction_id: transactionId, 
      attachment_url: attachmentUrl,
      attachment_category: category
    });

  if (error) {
    console.error('Error saving attachment:', error);
    return false;
  }

  return true;
}

// Delete a specific attachment by its row ID
export async function deleteAttachmentById(attachmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('transaction_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }

  return true;
}

// Delete attachment for a transaction (specific category or all)
export async function deleteAttachment(
  transactionId: string,
  category?: AttachmentCategory
): Promise<boolean> {
  let query = supabase
    .from('transaction_attachments')
    .delete()
    .eq('transaction_id', transactionId);

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

  const match = attachmentUrl.match(/transaction-attachments\/(.+)$/);
  if (!match) {
    console.error('Could not extract file path from URL:', attachmentUrl);
    return null;
  }

  const filePath = match[1];

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('No active session for signed URL request');
      return null;
    }

    const { data, error } = await supabase.functions.invoke('get-signed-url', {
      body: { filePath },
    });

    if (error) {
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    return null;
  }
}

// Check if a transaction has a payment receipt attachment
export async function hasPaymentReceipt(transactionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('attachment_category', 'payment_receipt')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking payment receipt:', error);
    return false;
  }

  return !!data;
}

// Get payment receipt status for multiple transactions
export async function getPaymentReceiptStatus(transactionIds: string[]): Promise<Record<string, boolean>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id')
    .in('transaction_id', transactionIds)
    .eq('attachment_category', 'payment_receipt');

  if (error) {
    console.error('Error fetching payment receipt status:', error);
    return {};
  }

  const result: Record<string, boolean> = {};
  transactionIds.forEach(id => {
    result[id] = false;
  });
  
  data?.forEach(item => {
    result[item.transaction_id] = true;
  });

  return result;
}
