

# OCR Enhancement: Purchase Summary + Diesel Account Rule

## Overview
Two improvements to the receipt scanning workflow:

1. **Auto-categorize gas station diesel under $10,000 to account 5611** -- a conditional vendor rule applied after OCR extracts the data.
2. **Summarize purchased items in the description field** -- the AI will extract a short purchase summary (e.g., "8.45 gal diesel", "office supplies") and auto-fill the description.

---

## Changes

### 1. Update the `ocr-receipt` edge function
**File:** `supabase/functions/ocr-receipt/index.ts`

- Add a `description` field to the AI prompt's JSON output schema, instructing it to produce a short purchase summary (items, quantities, units when visible).
- Example output: `"description": "8.45 gal diesel"` or `"description": "Materiales de oficina, papel, toner"`.
- Return `description` in the response alongside existing fields.

### 2. Update the `OcrResult` interface
**File:** `src/components/transactions/ScanReceiptButton.tsx`

- Add `description?: string` to the `OcrResult` interface so the new field flows through.

### 3. Consume description in TransactionForm + diesel rule
**File:** `src/components/transactions/TransactionForm.tsx`

- In `handleOcrResult`: if `result.description` is present and description is empty, auto-fill it.
- After vendor rules are applied, add a conditional check: if the description contains "diesel" (case-insensitive) and the amount is under 10,000, set `master_acct_code` to `"5611"` (only if no account is already set).

### 4. Redeploy the edge function

---

## Technical Details

**AI Prompt addition** (in the system message JSON schema):
```
"description": "short summary of items purchased, e.g. '8.45 gal diesel', 'office supplies'"
```

**Diesel rule logic** (in `handleOcrResult`):
```typescript
// After vendor rules, apply diesel < 10k rule
const amt = parseFloat(updated.amount || '0');
const desc = (updated.description || '').toLowerCase();
if (!updated.master_acct_code && desc.includes('diesel') && amt > 0 && amt < 10000) {
  updated.master_acct_code = '5611';
}
```

This keeps the rule in code (not in the vendor_account_rules table) since it's amount-conditional, which the table schema doesn't support.

