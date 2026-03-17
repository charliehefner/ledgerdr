

# Add Credit Note Alert in Transaction Form

## Overview
When a user selects a vendor name in the "Nueva Transacción" form, check if that vendor has any outstanding credit notes (Notas de Crédito) in `ap_ar_documents`. If so, display a prominent warning banner before the user submits a payment, so they can apply the credit first.

## Changes

### 1. `src/components/transactions/TransactionForm.tsx`
- Add a query that fires when `form.name` changes (debounced): look up `ap_ar_documents` where `contact_name = form.name`, `document_type = 'credit_memo'`, `status` is not `paid`/`void`, and `balance_remaining > 0`.
- If results exist, render an `Alert` banner (warning variant) below the name field showing: "Este proveedor tiene X nota(s) de crédito pendiente(s) por {total amount}. Considere aplicarla(s) antes de registrar un nuevo pago."
- The alert appears for both `purchase` and `sale` directions.

### 2. `src/components/accounting/ApArDocumentList.tsx`
- The `credit_memo` type already exists in the document type dropdown. No schema changes needed.
- Credit memos are created manually from the AP/AR "Nuevo Documento" dialog with type "Nota de Crédito".
- Credit memos have a `total_amount` representing the credit, `balance_remaining` tracks the unapplied portion.

### 3. No database changes required
- `ap_ar_documents` already supports `document_type` as a free text field with `credit_memo` as a value.
- The query uses existing columns: `contact_name`, `document_type`, `status`, `balance_remaining`.

### Implementation detail
- Query in TransactionForm uses `supabase.from('ap_ar_documents').select('id, balance_remaining, currency, document_number').eq('contact_name', form.name).eq('document_type', 'credit_memo').not('status', 'in', '("paid","void")').gt('balance_remaining', 0)`
- Only runs when `form.name.length >= 2` and direction is `purchase` or `sale`
- Uses the existing `Alert` component from `@/components/ui/alert` with `AlertTriangle` icon

