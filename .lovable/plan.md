

## Plan: Audit Triggers, Month-End Checklist, and Restore Documentation

### Overview

Three improvements to strengthen operational integrity:
1. Extend the existing audit trigger to cover inventory and fuel tables
2. Add a pre-closing validation checklist that blocks period status advancement when issues exist
3. Add restore instructions to the backup README

---

### Step 1: Add Audit Triggers on Inventory and Fuel Tables

**Migration SQL** — Attach the existing `audit_trigger_func()` to six tables that currently lack audit trails:

```sql
CREATE TRIGGER audit_inventory_items
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_inventory_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_fuel_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.fuel_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_fuel_tanks
  AFTER INSERT OR UPDATE OR DELETE ON public.fuel_tanks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_operations
  AFTER INSERT OR UPDATE OR DELETE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_operation_inputs
  AFTER INSERT OR UPDATE OR DELETE ON public.operation_inputs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
```

No code changes needed — the trigger function already exists and handles all three operations.

---

### Step 2: Month-End Closing Checklist

**New component: `src/components/accounting/PeriodClosingChecklist.tsx`**

A checklist component shown in `PeriodsView.tsx` when a user clicks the status-advance button. It runs four server-side checks before allowing the transition from `open → closed`:

| Check | Query | Blocks? |
|-------|-------|---------|
| Unlinked transactions | `count_unlinked_transactions(start, end)` | Yes |
| Unposted journals | Count journals where `posted = false` in date range | Yes |
| Missing exchange rates | Count USD transactions with `exchange_rate IS NULL` | Yes |
| Unreconciled bank accounts | Count `bank_statement_lines` with `is_reconciled = false` | Warning only |

**UI flow:**
- User clicks "→ Closed" button on a period
- An AlertDialog opens showing the checklist with pass/fail indicators
- If any blocking check fails, the "Proceed" button is disabled
- Warnings (like unreconciled accounts) show yellow but don't block

**File: `src/components/accounting/PeriodsView.tsx`** — Replace the inline status-advance button with the checklist dialog for `open → closed` transitions. Other transitions (closed → reported → locked) proceed as-is.

**i18n additions** to `src/i18n/en.ts` and `src/i18n/es.ts`:
- `accounting.checklist.title` — "Month-End Closing Checklist" / "Lista de Verificación de Cierre"
- `accounting.checklist.unlinked` — "Unlinked transactions" / "Transacciones sin asiento"
- `accounting.checklist.unposted` — "Unposted journals" / "Asientos sin publicar"
- `accounting.checklist.missingFx` — "Missing exchange rates" / "Tasas de cambio faltantes"
- `accounting.checklist.unreconciled` — "Unreconciled bank lines" / "Líneas bancarias sin conciliar"
- `accounting.checklist.pass` / `accounting.checklist.fail` / `accounting.checklist.warn`

---

### Step 3: Document Restore Procedure

**File: `src/components/settings/backup/backupUtils.ts`** — Update the README content that gets included in the backup ZIP to add a "Restore Procedure" section with step-by-step `psql` instructions: create schema, import data CSVs in dependency order, and restore storage files.

---

### Files Changed

| File | Change |
|------|--------|
| New migration | Add 6 audit triggers |
| `src/components/accounting/PeriodClosingChecklist.tsx` | New component — pre-close validation |
| `src/components/accounting/PeriodsView.tsx` | Integrate checklist before status advance |
| `src/i18n/en.ts` | Add checklist translations |
| `src/i18n/es.ts` | Add checklist translations |
| `src/components/settings/backup/backupUtils.ts` | Add restore instructions to README |

