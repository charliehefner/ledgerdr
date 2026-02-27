

## Plan: Add "Generate Depreciation" Button to Accounting Fixed Assets Tab

### Database Migration

1. **Add `DEP` journal type sequence** and update `generate_journal_number()` trigger to handle `'DEP'` prefix
2. No new tables needed — `depreciation_schedule` already exists with `asset_id`, `period_date`, `depreciation_amount`, `journal_id`

### New File: `src/components/equipment/useDepreciationGeneration.ts`

Hook that:
- Fetches active fixed assets with `in_service_date` set, remaining book value > 0, and `depreciation_expense_account` + `accumulated_depreciation_account` configured
- Checks `depreciation_schedule` to skip already-processed period/asset combos
- For each eligible asset, calculates: `monthly = (acquisition_value - salvage_value) / (useful_life_years * 12)`
- Creates a DEP draft journal with two lines (debit expense account, credit accumulated depreciation account)
- Inserts `depreciation_schedule` record linking asset → journal
- Updates `fixed_assets.accumulated_depreciation += amount`
- Shows progress and returns created/skipped counts

### Frontend Changes

**`src/components/equipment/FixedAssetsView.tsx`**
- Add "Generar Depreciación" button next to "Agregar Activo"
- Month/year picker dialog to select the depreciation period
- Frequency selector: monthly or quarterly (quarterly = 3× monthly amount)
- Confirmation dialog with count of eligible assets, progress bar during generation, summary on completion

**`src/components/accounting/JournalView.tsx`**
- Add `'DEP'` to the `TypeFilter` type and filter buttons

**`src/components/accounting/JournalEntryForm.tsx`**
- Add `'DEP'` option to the journal type selector

### Files Modified
- 1 database migration (new sequence, trigger update)
- `src/components/equipment/useDepreciationGeneration.ts` (new)
- `src/components/equipment/FixedAssetsView.tsx`
- `src/components/accounting/JournalView.tsx`
- `src/components/accounting/JournalEntryForm.tsx`

