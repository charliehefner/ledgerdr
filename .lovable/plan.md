## Changes

### 1. Default RNL value in Letters dialog
**File:** `src/components/hr/EmployeeLetterDialog.tsx` (line 71)

Change `useState("")` to `useState("132214048-0001")` so the RNL field is pre-populated. User can still override it.

### 2. Append legal phrase to biweekly salary clause in contracts
**File:** `supabase/functions/generate-hr-letter/index.ts` (line 597)

Modify the PRIMERO clause so it reads:
> ...totalizando RD$ X (X pesos) quincenales, **menos los debidos descuentos de ley.** Pagados por quincena.

## Notes
- Only contract-type letters use the biweekly clause. Employment verification letters remain unchanged.
- No DB or i18n changes needed.
