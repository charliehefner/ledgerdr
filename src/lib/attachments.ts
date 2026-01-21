import { supabase } from '@/integrations/supabase/client';

// Get attachment URL for a transaction from local database
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

// Get attachment URLs for multiple transactions
export async function getAttachmentUrls(transactionIds: (string | number)[]): Promise<Record<string, string>> {
  if (transactionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id, attachment_url')
    .in('transaction_id', transactionIds.map(String));

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

// Save or update attachment URL for a transaction
export async function saveAttachment(transactionId: string | number, attachmentUrl: string): Promise<boolean> {
  const { error } = await supabase
    .from('transaction_attachments')
    .upsert(
      { 
        transaction_id: String(transactionId), 
        attachment_url: attachmentUrl 
      },
      { 
        onConflict: 'transaction_id' 
      }
    );

  if (error) {
    console.error('Error saving attachment:', error);
    return false;
  }

  return true;
}

// Delete attachment for a transaction
export async function deleteAttachment(transactionId: string | number): Promise<boolean> {
  const { error } = await supabase
    .from('transaction_attachments')
    .delete()
    .eq('transaction_id', String(transactionId));

  if (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }

  return true;
}
