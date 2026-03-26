

## Plan: Re-remap Bank GL Codes to Match ADM Exactly

### Key Insight
Journal lines reference accounts by UUID, not by code. So we just rename the `account_code` on existing chart_of_accounts rows — no journal_lines need to move.

### Step 1: Rename GL Accounts (single migration)

Using temporary codes to avoid unique constraint conflicts during the swap:

| UUID | Current Code → Temp → Final | Final ADM Name |
|------|-----|------|
| ad3e634c | 1940 → soft-delete | *(was header "Cuentas Bancarias ADM")* |
| 69d968ce | 1942 → soft-delete | *(was "BDI USD regular" — merged into Premium)* |
| 8b00af84 | 1941 → **1940** | Other bank account-4010176533-DOP |
| aff84712 | 1946 → **1942** | Premium Bank BDI--4010176526 US$ |
| 4d729f39 | 1943 → **1943** (rename only) | Other bank accountI-4010176501-EURO |
| 214f5030 | 1944 → **1945** | Other bank account- BHD-36900090011 |
| 1d98d04f | 1945 → **1946** | Other bank account- BHD-US\$36900090020 |

### Step 2: Add Missing ADM Accounts

| Code | Name | Type |
|------|------|------|
| 1944 | Premium Banco BDI-4010176501-EURO | ASSET (bank, EUR) |
| 1948 | Other bank account- EUR \$4010176501 | ASSET (bank, EUR) |

*(1947 "Tarjeta de credito 3746" already exists)*

### Step 3: Merge Bank Accounts

- **Delete** the "BDI USD regular" bank_accounts row (75aaff36) since user confirmed only Premium exists
- **Update display names** on remaining 5 bank_accounts rows to match ADM names
- **Fix Premium account_number** from "1942" to the correct value

### What Does NOT Need to Change
- **Zero journal_lines need to move** — they reference UUIDs, and those UUIDs keep their data
- **85 BHD DOP journal lines** stay on UUID 214f5030 (code just relabels from 1944→1945)
- **`bank_accounts.chart_account_id`** stays the same for all rows (UUIDs unchanged)
- **`payment_method_accounts`** stays correct (references UUIDs)
- **`close_day_labor_week` function** hardcodes UUID 84653770 (BHD DOP) — unchanged
- **No app code changes** — zero hardcoded 194x references in src/

### Risk
Effectively zero — purely relabeling metadata on existing UUIDs. All foreign key references remain intact.

