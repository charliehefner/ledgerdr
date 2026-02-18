

# Auto-Generate Journal Entries from Transactions

## Overview

Add a `payment_method_accounts` configuration table and a "Generar desde Transacciones" button in the Journal tab. Each non-void transaction without an existing journal will produce a double-entry journal as a Draft for accountant review.

## Double-Entry Logic

For each transaction:

```text
Debit   master_acct_code         (amount - itbis)   or full amount if no ITBIS
Debit   1650 (IVA recuperable)   itbis              (only if itbis > 0)
Credit  [mapped pay_method acct] amount             (full amount)
```

## Current Data

- 154 active transactions, 0 journals yet
- 6 distinct pay_methods: `transfer_bhd`, `transfer_bdi`, `cc_management`, `Transfer BHD` (legacy), `cash`, `null` (1 record)
- Relevant accounts found in chart_of_accounts:
  - `1910` Efectivo en mano (cash)
  - `1930` Cuenta de empresa (primary bank)
  - `1940` Otra cuenta bancaria (secondary bank)
  - `1650` IVA recuperable (ITBIS debit)

## Implementation Steps

### Step 1 -- Database Migration

Create `payment_method_accounts` table:
- `id` (uuid, PK)
- `pay_method` (text, unique, not null) -- matches `transactions.pay_method`
- `account_id` (uuid, FK to chart_of_accounts)
- `created_at`, `updated_at`
- RLS: same `has_role()` pattern (admin/management/accountant write, viewer/supervisor read)

Also create `itbis_config` single-row table or just use a known constant (`1650`).

Seed the table with initial mappings (user can adjust via UI):

| pay_method | account_code | account_name |
|---|---|---|
| cash | 1910 | Efectivo en mano |
| transfer_bhd | 1930 | Cuenta de empresa |
| Transfer BHD | 1930 | Cuenta de empresa |
| transfer_bdi | 1940 | Otra cuenta bancaria |
| cc_management | 1930 | Cuenta de empresa |

### Step 2 -- Journal Generation Logic (client-side)

Implemented in a new file `src/components/accounting/useJournalGeneration.ts`:

1. Fetch all non-void transactions that do NOT have a matching `journals.transaction_source_id`
2. For each transaction:
   - Look up the `chart_of_accounts` row for `master_acct_code`
   - Look up the `payment_method_accounts` mapping for `pay_method`
   - Create a journal with `transaction_source_id` linked, date = transaction_date, description = transaction description
   - Create 2 or 3 journal_lines (expense debit, optional ITBIS debit, payment credit)
3. Insert in batches
4. Return count of generated journals

### Step 3 -- UI: "Generar desde Transacciones" Button

Add to `JournalView.tsx` toolbar:
- A "Generar desde Transacciones" button (visible only to write-access users)
- Shows a confirmation dialog with count of unlinked transactions
- Progress indicator during generation
- After completion, invalidates the journals query to show new drafts

### Step 4 -- Payment Method Mapping UI

New component `src/components/accounting/PaymentMethodMappingDialog.tsx`:
- A dialog accessible from the Journal toolbar (gear icon)
- Table showing each pay_method and its mapped account (dropdown from chart_of_accounts)
- Add/edit/remove mappings
- Validates that all active pay_methods have a mapping before generation

### Step 5 -- Show Transaction Link on Journals

In `JournalView.tsx`, update the journal query to include `transaction_source_id`. When a journal was generated from a transaction, show a small link/badge indicating the source.

## Files Changed

| File | Action |
|---|---|
| New migration | `payment_method_accounts` table + seed data + RLS |
| `src/components/accounting/useJournalGeneration.ts` | New -- generation logic hook |
| `src/components/accounting/PaymentMethodMappingDialog.tsx` | New -- config UI for mappings |
| `src/components/accounting/JournalView.tsx` | Update -- add generation button, config button, transaction source indicator |

## What Stays the Same

- Manual journal creation and the review/approval workflow remain unchanged
- Generated journals are Drafts -- accountant reviews and posts each one
- Existing triggers handle numbering, balance validation, and post-locking

