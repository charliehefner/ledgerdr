# Multi-Category Transaction Attachments

## Overview

Transaction attachments now support three distinct categories, allowing users to organize different document types per transaction.

## Attachment Categories

| Category | English Label | Spanish Label | Required | Dashboard Table |
|----------|---------------|---------------|----------|-----------------|
| `ncf` | NCF | NCF | No (tracked via document field) | Pending NCF |
| `payment_receipt` | Payment Receipt | Comprobante de Pago | No* | Without Payment Receipt |
| `quote` | Quote | Cotización | No | N/A |

*Uploading either NCF or Payment Receipt satisfies the "Without Payment Receipt" requirement. Bank receipts are typically available online.

## Database Schema

The `transaction_attachments` table now includes:

```sql
attachment_category TEXT NOT NULL DEFAULT 'payment_receipt'
```

**Unique Constraint**: `(transaction_id, attachment_category)` - allows one attachment per category per transaction.

**Valid Categories**: `'ncf'`, `'payment_receipt'`, `'quote'`

## Dashboard Tables

1. **Transacciones Pendientes de NCF / Transactions Pending NCF**
   - Shows transactions without a document (NCF) field value
   - All non-voided transactions are included

2. **Sin Comprobante de Pago / Without Payment Receipt**  
   - Shows transactions without a `payment_receipt` attachment
   - **Excludes**: Nomina transactions (account 7010 or description contains "Nomina")
   - These exempted transactions can still upload attachments optionally

## UI Components

- `MultiAttachmentCell`: Displays attachment count badge, dropdown menu with all 3 categories, camera/file upload per category
- Shows ✓ next to categories that have attachments
- Hover preview shows first available image attachment

## Nomina Exemption Logic

```typescript
const isNominaTransaction = (tx: Transaction): boolean => {
  return tx.master_acct_code === '7010' || 
         (tx.description?.toLowerCase().includes('nomina') ?? false);
};
```

## Migration Notes

- Existing attachments were migrated to `payment_receipt` category
- The old `getAttachmentUrls()` function still works (returns payment_receipt only)
- New `getAllAttachmentUrls()` returns all categories organized by transaction ID
