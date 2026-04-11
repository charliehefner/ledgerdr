

# Complete Bilingual (EN/ES) Sweep

## Current State
- **~1,450 translation keys** already exist in `es.ts` and `en.ts`
- **127 component files** still contain hardcoded Spanish strings
- Affected modules: HR (17 files), Accounting (12), Fuel/Equipment (14), Operations (12), Settings (13), Inventory (6), Industrial (3), Driver Portal (7), Analytics (7), Transactions (6), Pages (9), Layout/UI (6)

## Approach

Work module-by-module. For each file:
1. Extract every hardcoded Spanish string into a new `t()` key
2. Add the Spanish value to `es.ts` and the English translation to `en.ts`
3. Replace the inline string with `t("key")`

This is a mechanical but large task — roughly **400-500 new keys** across 127 files.

## Batch Order (by module, largest first)

| Batch | Module | Files | Est. New Keys |
|-------|--------|-------|---------------|
| 1 | HR (employees, payroll, jornaleros, services) | 17 | ~90 |
| 2 | Accounting (DGII, payments, chart of accounts) | 12 | ~60 |
| 3 | Operations (farms, fields, contracts, maps) | 12 | ~55 |
| 4 | Settings (entities, users, approvals, backup) | 13 | ~50 |
| 5 | Fuel & Equipment (tanks, tractors, implements) | 14 | ~50 |
| 6 | Driver Portal (wizard steps, QR, meter) | 7 | ~35 |
| 7 | Analytics tabs | 7 | ~30 |
| 8 | Inventory | 6 | ~25 |
| 9 | Transactions & Invoices | 6 | ~25 |
| 10 | Pages, Layout, Industrial, remaining | 18 | ~40 |

## What Changes

- **`src/i18n/es.ts`** — add ~460 new keys (Spanish values matching current hardcoded text)
- **`src/i18n/en.ts`** — add ~460 new keys (English translations)
- **127 `.tsx` files** — replace hardcoded strings with `t("...")` calls, adding `useLanguage()` import where missing
- **No database changes, no new dependencies**

## Result

Every visible string in the app will flow through the `t()` function. Switching to English (or adding French later) becomes a matter of adding one new file per language — no component changes needed.

Due to the volume (127 files), I'll process this in multiple batches across several messages. Ready to start on your approval.

