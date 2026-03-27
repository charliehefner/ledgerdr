

## Add "Investment" Transaction Type + JORD AB as Source/Destination

### Summary
Add a 4th transaction direction called **Investment** and add **JORD AB** as both a source and destination option in the transfer account dropdowns.

### Changes

#### 1. Add `investment` transaction direction

**`src/components/transactions/TransactionForm.tsx`**
- Update the type union to include `'investment'` alongside `purchase | sale | payment`
- Add `<SelectItem value="investment">` to the direction dropdown
- Investment behaves like a **transfer** (from/to accounts, internal, account code `0000`), so reuse the same transfer UI logic:
  - When `investment` is selected, set `master_acct_code` to `0000` and show the From/To account selectors
  - Update all `=== 'payment'` checks to also match `'investment'` (validation, form clearing, submission mapping)

**`src/lib/api.ts`**
- Update the `transaction_direction` type to include `'investment'`

**`src/i18n/en.ts`** and **`src/i18n/es.ts`**
- Add `"txForm.investment": "Investment"` (en) / `"txForm.investment": "Inversión"` (es)

#### 2. Add JORD AB to both Source and Destination dropdowns

Currently, the "Casa Matriz" (JORD AB, account `2160`) only appears in the **To** dropdown. Changes:

**`src/components/transactions/TransactionForm.tsx`**
- Add the `headOfficeAccounts` group to the **From** (source) dropdown as well, with a "Casa Matriz" section — same pattern as the To dropdown
- This allows JORD AB as both source and destination for transfers and investments

#### 3. No database changes needed
- The `transaction_direction` column is `text`, not an enum — it already accepts any string value
- Account `2160` already exists in `chart_of_accounts`
- Correct account linkage will be configured later per user request

### Technical notes
- The `isTransfer` logic (line ~268) will become `const isTransfer = form.transaction_direction === 'payment' || form.transaction_direction === 'investment'`
- Investment transactions will be marked `is_internal: true` like transfers
- The `EditTransactionDialog` may also need the investment option added if it has a direction selector

