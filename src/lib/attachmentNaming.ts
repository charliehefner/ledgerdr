import type { AttachmentCategory } from '@/lib/attachments';

const CATEGORY_PREFIXES: Record<AttachmentCategory, string> = {
  ncf: 'NCF',
  payment_receipt: 'PAGO',
  quote: 'COT',
};

/**
 * Generates a structured file name for transaction attachments.
 * Format: {transactionId}_{categoryPrefix}_{YYYY-MM-DD}.{ext}
 * 
 * Examples:
 *   "1234_NCF_2026-02-16.jpg"
 *   "5678_PAGO_2026-02-16.pdf"
 *   "9012_COT_2026-02-16.png"
 * 
 * Falls back to timestamp-based name if no transaction ID is available.
 */
export function generateAttachmentFileName(
  fileExtension: string,
  category: AttachmentCategory = 'payment_receipt',
  transactionId?: string | number
): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const prefix = CATEGORY_PREFIXES[category];
  const ext = fileExtension.replace(/^\./, '');

  if (transactionId) {
    // Use the transaction ID (could be UUID or legacy number)
    const txId = String(transactionId);
    // For UUIDs, use first 8 chars; for numeric IDs use as-is
    const shortId = txId.includes('-') ? txId.split('-')[0] : txId;
    return `${shortId}_${prefix}_${dateStr}.${ext}`;
  }

  // Fallback for new transactions (no ID yet)
  const timestamp = Date.now();
  return `NEW_${prefix}_${dateStr}_${timestamp}.${ext}`;
}
