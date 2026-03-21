

## Plan: Audit and Fix All Vulnerable Select Components

### Problem

Radix `<Select value="">` crashes when the value is an empty string and no `<SelectItem value="">` exists. This affects any Select bound to nullable database columns or state that can be empty.

### Approach

Perform a project-wide audit of all 57 files using `<Select>` and apply the `__none__` sentinel pattern wherever the value can be null/empty.

### Scope

**Already fixed:** `EditTransactionDialog.tsx` (5 Selects), `OperationsLogView.tsx` (uses `__all__`)

**Known vulnerable — needs fix:**
- `src/components/herbicide/FieldSelectionSection.tsx` — `value=""`
- `src/components/herbicide/ProductSelectionSection.tsx` — `value=""`

**Needs audit for nullable values passed to Select:**
- `TransactionForm.tsx` — `form.dgii_tipo_ingreso`, `form.dgii_tipo_bienes_servicios`, `form.master_acct_code` (all can be empty on form init)
- `AccountingReportsView.tsx` — filter Selects initialized to `""`
- `JournalDetailDialog.tsx` — `journalType`
- All other Select usages across 57 files

### Fix Pattern

For every Select where the value can be `""` or `null`:

```tsx
// Before (crashes)
<Select value={maybeEmpty}>

// After (safe)
<Select value={maybeEmpty || "__none__"} onValueChange={v => set(v === "__none__" ? "" : v)}>
  <SelectContent>
    <SelectItem value="__none__">— Select —</SelectItem>
    ...
```

For Selects used as "pick and trigger" (like Herbicide), change `value=""` to `value={undefined}` so Radix shows the placeholder without crashing.

### Prevention

Add a runtime guard in `src/components/ui/select.tsx` — wrap `SelectItem` to throw a clear dev-only warning if `value=""` is passed, catching future mistakes at development time rather than in production.

### Files Changed

| File | Change |
|------|--------|
| `src/components/ui/select.tsx` | Add dev-time guard on SelectItem empty value |
| `src/components/herbicide/FieldSelectionSection.tsx` | Fix `value=""` → `value={undefined}` |
| `src/components/herbicide/ProductSelectionSection.tsx` | Fix `value=""` → `value={undefined}` |
| `src/components/transactions/TransactionForm.tsx` | Add sentinel for nullable DGII Selects |
| `src/components/accounting/AccountingReportsView.tsx` | Add sentinel for filter Selects |
| ~10 other files with nullable Select values | Apply sentinel pattern |

