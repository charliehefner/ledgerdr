import { supabase } from '@/integrations/supabase/client';
import { generateAttachmentFileName } from '@/lib/attachmentNaming';
import type { AttachmentCategory } from '@/lib/attachments';

/**
 * Gets a signed URL for a file in the private transaction-attachments bucket.
 * Signed URLs expire after 1 hour for security.
 */
export async function getSignedUrl(attachmentUrl: string): Promise<string | null> {
  if (!attachmentUrl) return null;

  // Extract the file path from the public URL
  // URL format: https://[project].supabase.co/storage/v1/object/public/transaction-attachments/receipts/filename.jpg
  const match = attachmentUrl.match(/transaction-attachments\/(.+)$/);
  if (!match) {
    console.error('Could not extract file path from URL:', attachmentUrl);
    return null;
  }

  const filePath = match[1];

  try {
    const { data, error } = await supabase.functions.invoke('get-signed-url', {
      body: { filePath },
    });

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Failed to get signed URL:', error);
    return null;
  }
}

/**
 * Uploads a file to the transaction-attachments bucket.
 * Returns the file path (not the signed URL) for storage in the database.
 */
export async function uploadAttachment(
  file: File,
  category: AttachmentCategory = 'payment_receipt',
  transactionId?: string | number
): Promise<{ filePath: string; error?: string } | null> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = generateAttachmentFileName(fileExt, category, transactionId);
  const filePath = `receipts/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('transaction-attachments')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return { filePath: '', error: uploadError.message };
  }

  // Return just the file path - the database stores this path,
  // and we generate signed URLs on demand for viewing
  return { filePath };
}

/**
 * Gets the file path portion from a full URL or stored path.
 */
export function extractFilePath(url: string): string | null {
  const match = url.match(/transaction-attachments\/(.+)$/);
  return match ? match[1] : null;
}
