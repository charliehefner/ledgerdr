
# Audit Remediation - Lower Priority Items

This plan addresses the remaining audit findings in 4 manageable batches to avoid overwhelming the system.

---

## Batch 1: Type Safety - Eliminate `as any` Casts

The 196 `as any` casts fall into a few root causes that can be fixed systematically:

**A. Transaction type is missing fields** - `cost_center`, `itbis_retenido`, `isr_retenido`, `dgii_tipo_bienes_servicios` are used via `(t as any).field` because the `Transaction` interface in `src/types/index.ts` and `src/lib/api.ts` doesn't include them.
- Fix: Add the missing fields to both Transaction interfaces
- Files: `src/types/index.ts`, `src/lib/api.ts`, `src/components/invoices/EditTransactionDialog.tsx`, `src/components/accounting/useJournalGeneration.ts`, `src/components/transactions/RecentTransactions.tsx`

**B. Supabase query results cast to `any[]`** - Views like ProfitLossView and BalanceSheetView cast query results because TypeScript doesn't know the shape.
- Fix: Define proper result interfaces and use them instead of `any[]`
- Files: `src/components/accounting/ProfitLossView.tsx`, `src/components/accounting/BalanceSheetView.tsx`

**C. Inventory item missing DB columns** - `cas_number` and `normal_dose_per_ha` accessed via `as any`
- Fix: Add these to the InventoryItem type in `src/types/index.ts`
- Files: `src/types/index.ts`, `src/components/inventory/InventoryItemDialog.tsx`

**D. Supabase insert/update payload casts** - Used to bypass strict typing on `.insert()` / `.update()`
- Fix: Use type assertions to the proper Database table types or cast narrowly
- Files: `src/components/inventory/InventoryItemDialog.tsx`, `src/components/hr/PayrollSummary.tsx`

**E. Window API casts** (`showSaveFilePicker`) - Legitimate since this is a non-standard API
- Fix: Create a shared type declaration in `src/vite-env.d.ts`
- Files: `src/vite-env.d.ts`, `src/components/hr/IR17ReportView.tsx`, `src/components/hr/TSSAutodeterminacionView.tsx`

**F. jsPDF `lastAutoTable` property** - From jspdf-autotable plugin
- Fix: Declare module augmentation for jspdf-autotable
- Files: `src/components/operations/contracts/ContractReport.tsx`

**G. Select/filter value casts** - Minor UI casts like `setStatusFilter(v as any)`
- Fix: Properly type the state variables
- Files: `src/components/equipment/FixedAssetsView.tsx`

---

## Batch 2: Console Log Cleanup

132 console statements across 7 files. Strategy:

- **Keep**: `console.warn` in `DatabaseBackup.tsx` (error handling during export) and `MultiAttachmentCell.tsx` (graceful degradation)
- **Remove**: All `console.log` in `AuthContext.tsx` (12 statements - debug logging from development)
- **Remove**: `console.log` in `gpsgate-proxy/index.ts` edge function (4 statements)
- **Keep**: `console.warn` for non-critical failures (follow-up scheduling in OperationsLogView)

Net removal: ~16 statements. The rest are legitimate `console.warn`/`console.error` for error handling.

---

## Batch 3: Split LanguageContext.tsx (1,582 lines)

The translation dictionary makes up ~95% of this file. Split into:

1. **`src/i18n/es.ts`** - Spanish translations object (~700 lines)
2. **`src/i18n/en.ts`** - English translations object (~700 lines)
3. **`src/i18n/index.ts`** - Re-export combined translations record
4. **`src/contexts/LanguageContext.tsx`** - Slim context provider (~30 lines), imports from `src/i18n`

No behavioral changes - just file organization.

---

## Batch 4: Fix Legacy ID Fallback + Add Pagination Hook

**Legacy ID fix** in `api.ts`:
- Current: `id: t.legacy_id?.toString() || t.id` silently swaps UUIDs for legacy IDs, causing confusion downstream
- Fix: Keep `id` as the UUID, expose `legacy_id` as a separate field. Update attachment logic that depends on legacy_id to use the explicit field.

**Reusable pagination hook**:
- Create `src/hooks/usePagination.ts` with page size, current page, and total count
- Apply to the Transactions page (currently hardcoded `limit: 500`) as the first consumer
- Other modules can adopt it incrementally

---

## Execution Order

Each batch will be implemented as a separate message to keep changes reviewable and avoid crashes:

1. Batch 1 - Type safety (highest impact on developer experience)
2. Batch 2 - Console cleanup (quick win)
3. Batch 3 - LanguageContext split (largest file change, isolated risk)
4. Batch 4 - Legacy ID + pagination (behavioral change, needs care)

## Technical Notes

- No database migrations required for any of these changes
- All changes are backward-compatible
- The LanguageContext split is a pure refactor with zero runtime behavior change
- The legacy ID fix may affect attachment URLs if they rely on `legacy_id` as the path key -- this will be verified before changing
