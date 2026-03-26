

## Plan: Rename 1942 to Standard BDI USD Name

### Current State
- **Active account `1942`** (UUID `aff84712`): "Premium Bank BDI--4010176526 US$" — **0 journal lines**
- **Bank account row** (`202a5e14`): "Premium Bank BDI--4010176526 US$", linked to the same UUID

### Changes (data updates only, no schema changes)

1. **Rename chart_of_accounts `1942`** from "Premium Bank BDI--4010176526 US$" to **"BDI USD 4010176526"**
2. **Rename bank_accounts row** (`202a5e14`) from "Premium Bank BDI--4010176526 US$" to **"BDI USD 4010176526"**

That's it — two UPDATE statements via the insert tool. No code changes needed.

