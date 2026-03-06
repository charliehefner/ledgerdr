

## Petty Cash Replenishment Workflow

### What needs to happen

The imprest system requires each petty cash fund to have a **fixed amount** (monto fijo). When expenses accumulate, a "Reponer Fondo" button calculates total unreplenished expenses and creates a transfer transaction to restore the fund to its fixed amount. Any cash over/short is recorded separately.

### Database Change

Add `fixed_amount numeric` column to `bank_accounts` table (nullable, only relevant for `petty_cash` type accounts). This stores the imprest amount for each fund.

```sql
ALTER TABLE public.bank_accounts ADD COLUMN fixed_amount numeric DEFAULT NULL;
```

### UI Changes (`src/components/accounting/PettyCashView.tsx`)

**1. Fund form dialog** — Add a "Monto Fijo del Fondo" (Fixed Fund Amount) input field to the create/edit fund dialog. This is the imprest amount the fund should always return to.

**2. Fund table** — Add a "Monto Fijo" column showing the imprest amount for each fund.

**3. Replenishment dialog** — New "Reponer Fondo" button per fund row (or global). Opens a dialog that:
- Shows the fund's fixed amount
- Calculates total expenses since the last replenishment (last transfer TO this fund)
- Shows expected cash on hand = fixed_amount - total_expenses_since_last_recharge
- Has an "Efectivo Contado" (Cash Counted) input for the actual cash on hand
- Auto-calculates the difference (Cash Over/Short = counted - expected)
- Shows the replenishment amount needed = fixed_amount - counted
- Has a "Cuenta Origen" (Source Account) dropdown to select which bank account funds the replenishment
- On confirm: creates a transfer transaction (direction = `payment`, from = source bank, to = petty cash fund, amount = replenishment amount)
- If there's a cash over/short, shows a note/warning (manual journal entry for now; can be automated later)

**4. Transaction query refinement** — Track "last replenishment date" per fund by finding the most recent transfer TO that fund, then only sum expenses since that date for the replenishment calculation.

### Flow Summary

```text
Fund: "Caja Chica Principal" — Monto Fijo: RD$10,000

Since last replenishment:
  Expenses:           RD$ 7,230.00
  Expected cash:      RD$ 2,770.00
  Cash counted:       RD$ 2,750.00  ← user inputs
  ────────────────────────────────
  Over/Short:         RD$   -20.00  (Faltante)
  Replenishment:      RD$ 7,250.00  ← auto-calculated

  [Source: Banco Popular ▼]  [Reponer Fondo ✓]
```

### Files to Edit

| File | Changes |
|------|---------|
| **Migration** | Add `fixed_amount` column to `bank_accounts` |
| `src/components/accounting/PettyCashView.tsx` | Add fixed_amount to form/table, add Replenishment dialog with calculation logic, create transfer transaction on confirm |
| `src/integrations/supabase/types.ts` | Auto-regenerated after migration |

