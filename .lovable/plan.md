

## Plan: Bank Reconciliation — OFX Import + Quick Journal Creation

### 1. Add OFX parser to `BankReconciliationView.tsx`

- Add a `parseOFX(text: string)` function that:
  - Splits content on `<STMTTRN>` blocks
  - Extracts `DTPOSTED` (→ YYYY-MM-DD), `NAME`/`MEMO` (→ description), `TRNAMT` (→ amount, already signed), `FITID` (→ reference), `TRNTYPE` (informational)
  - Extracts account metadata from `BANKID`, `ACCTID`, `LEDGERBAL` for an import summary toast
- Update file input `accept` from `.csv` to `.csv,.ofx` (line 236)
- Rename button label from "Importar CSV" to "Importar Estado" (line 238)
- Add a `handleFileImport` dispatcher that checks file extension — routes `.ofx` to `handleOFXImport`, `.csv` to existing `handleCSVImport`
- OFX import deduplicates by checking existing `reference` values for the selected bank account before inserting

### 2. Add "Crear Entrada" button on unmatched lines

- Add a new column in the table for an action button (visible only when `!line.is_reconciled`)
- Button opens a new `QuickEntryDialog` that:
  - Pre-fills date from `statement_date`, amount from `amount`, description from `description`
  - Shows an account selector (from `chart_of_accounts` where `allow_posting = true`)
  - On submit: creates a journal (via `create_journal_from_transaction` or direct insert) with two lines — the selected expense/income account and the bank's mapped GL account
  - Auto-marks the bank line as reconciled and links it via `matched_journal_id`

### 3. Auto-categorization rules for bank charges

- Add a helper map of common BDI description patterns to suggested account codes:
  - `COMISION` → 6520 (Bank Charges)
  - `IMPUESTO LEY` → 6530 (Taxes & Fees)
  - `ITBIS` → 1650 (ITBIS)
  - `INTERES` → 6510 (Interest Expense)
- When the QuickEntryDialog opens, auto-select the matching account if the description matches a pattern
- User can always override the suggestion

### Files changed

- **`src/components/accounting/BankReconciliationView.tsx`** — OFX parser, file dispatcher, button rename, "Crear Entrada" column, QuickEntryDialog integration
- **New: `src/components/accounting/QuickEntryDialog.tsx`** — Dialog component for creating a journal entry from a bank line with auto-categorization

### No database changes needed

The existing `bank_statement_lines` and `journals`/`journal_lines` tables already have all required columns.

