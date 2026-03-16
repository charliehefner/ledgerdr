

# Fix Accounting Audit Findings 1, 3-10

Skipping Finding 2 (bank account GL links) per your instruction — waiting on accountant.

## Finding 1 — Journal Generation Broken for UUID pay_methods (CRITICAL)

**File**: `supabase/functions/generate-journals/index.ts`

The Edge Function resolves `pay_method` via the `payment_method_accounts` mapping table, which only has legacy string keys. New transactions store bank account UUIDs.

**Fix**: After the existing `mappingMap` lookup fails, check if `pay_method` looks like a UUID. If so, look it up directly in `bankAccountMap` to get `chart_account_id`. Fall back to legacy mapping only for old string-based values.

```text
payAccountId resolution flow:
  1. Try mappingMap.get(pay_method)          ← legacy strings
  2. If null, try bankAccountMap.get(pay_method)?.chart_account_id  ← UUID
  3. If still null → skip with error
```

Also handle transfer `pay_method` the same way (already uses `bankAccountMap`, but the source lookup at line ~170 needs the same dual-path).

## Finding 3 — DGII 606 Forma de Pago Wrong (HIGH)

**File**: `src/components/accounting/dgiiConstants.ts`

`getFormaDePago()` only checks a static map. UUID pay_methods all default to "01" (Efectivo).

**Fix**: The function can't do async DB lookups. Instead, change `DGII606Table` (and `DGII607Table` if applicable) to accept a `bankAccounts` lookup array prop, and resolve the forma de pago from `account_type`:
- `bank` → "02" (Transferencia)
- `credit_card` → "03" (Tarjeta)
- `petty_cash` → "01" (Efectivo)

Update `getFormaDePago` to accept an optional bank accounts array as second parameter.

**Files**: `src/components/accounting/dgiiConstants.ts`, `src/components/accounting/DGII606Table.tsx`, `src/components/accounting/DGII607Table.tsx`, `src/components/accounting/DGIIReportsView.tsx`

## Finding 4 — PaymentMethodMappingDialog Obsolete (MEDIUM)

**File**: `src/components/accounting/JournalView.tsx`

Remove the Settings gear button that opens `PaymentMethodMappingDialog`. The mapping is now implicit via `bank_accounts.chart_account_id`. Keep the component file for now (no breaking deletion) but remove its usage from the Journal UI.

## Finding 5 — Cross-Currency Transfer Journal Imbalance (MEDIUM)

**File**: `supabase/functions/generate-journals/index.ts`

When source and destination currencies differ, force both debit and credit to use `sourceAmount` (the DOP-equivalent amount), keeping the journal balanced in the reporting currency. Store the original currency info on the journal header. The current branching logic at lines 186-204 is over-complicated and produces wrong results.

**Fix**: Simplify to always use `sourceAmount` for both sides. The journal's `exchange_rate` and `currency` metadata already capture the conversion context.

## Finding 6 — Voided Transaction Doesn't Void AP/AR Document (MEDIUM)

**Database migration**: Add a trigger on `transactions` that fires when `is_void` changes to `true`. It finds any `ap_ar_documents` where `linked_transaction_ids` contains the voided transaction ID and sets their status to `void`.

```sql
CREATE OR REPLACE FUNCTION public.void_ap_ar_on_transaction_void()
RETURNS trigger ...
  -- Find ap_ar_documents with this transaction in linked_transaction_ids
  UPDATE ap_ar_documents
  SET status = 'void'
  WHERE linked_transaction_ids @> ARRAY[NEW.id]::uuid[];
```

## Finding 7 — No Exchange Rate on AP/AR Payment Journals (MEDIUM)

**File**: `src/components/accounting/PaymentDialog.tsx`

After creating the journal via RPC, set `currency` and `exchange_rate` on it (same pattern already used in `generate-journals`). Use the document's currency and fetch the current rate if non-DOP.

Add after journal creation (line ~99):
```typescript
await supabase.from("journals").update({
  currency: document.currency,
  exchange_rate: document.currency !== 'DOP' ? currentRate : 1,
}).eq("id", journalId);
```

## Finding 8 — Client-Side Depreciation Loop (LOW)

Skip for now — this is a performance optimization, not a correctness issue. Flag for future Edge Function migration.

## Finding 9 — Unlinked Count Has No Date Filter (LOW)

**File**: `src/components/accounting/useJournalGeneration.ts`

The `countUnlinked()` call passes `{}` (no dates). This is actually intentional — the Generate Journals button processes ALL unlinked transactions regardless of date range. No change needed; this is working as designed.

## Finding 10 — Aging Report Ignores Currency (LOW)

**File**: `src/components/accounting/AgingReportView.tsx`

The aging already groups by `contact_name + currency` (line 76: `key = contact_name_currency`), and each row shows a currency column. The totals row at the bottom mixes currencies, which is misleading.

**Fix**: Group totals by currency. Show separate total rows per currency, or remove the mixed total.

---

## Summary of Changes

| Finding | File(s) | Type |
|---------|---------|------|
| 1 | `generate-journals/index.ts` | Edge function edit |
| 3 | `dgiiConstants.ts`, `DGII606Table.tsx`, `DGII607Table.tsx`, `DGIIReportsView.tsx` | Code edit |
| 4 | `JournalView.tsx` | Remove mapping dialog usage |
| 5 | `generate-journals/index.ts` | Edge function edit |
| 6 | SQL migration | New trigger |
| 7 | `PaymentDialog.tsx` | Code edit |
| 9 | No change | Working as designed |
| 10 | `AgingReportView.tsx` | Code edit |

Findings 2 (waiting on accountant) and 8 (low priority performance) are deferred.

