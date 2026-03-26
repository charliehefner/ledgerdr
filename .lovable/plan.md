

## Plan: Clean Up Petty Cash Funds

### Current State
Three petty cash funds exist:
1. **"Caja Chica"** → GL 1910 (Efectivo en mano) — **1 transaction**
2. **"Caja Chica Industria"** → GL 1912 — **4 transactions**
3. **"Caja Chica Finca"** → GL 1911 — **0 transactions** ← to delete

### Action
1. **Delete** the "Caja Chica Finca" fund (id `552f80f4-3592-445a-bafc-30220cef84f7`) since it has zero transactions
2. **Update** the remaining "Caja Chica" fund to:
   - Rename to **"Caja Chica Finca"**
   - Re-map its GL account from 1910 → **1911** (Caja Chica Finca)

This leaves two funds:
- **Caja Chica Finca** → GL 1911
- **Caja Chica Industria** → GL 1912

### Technical Details
- Two data operations via the insert tool (DELETE + UPDATE on `bank_accounts`)
- No schema/migration changes needed
- No code changes needed

