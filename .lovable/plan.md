

# Petty Cash Accounts for Manager Reimbursements

## Current State
- One petty cash account exists: **Caja Chica** (DOP, fixed amount: 5,000, mapped to GL 1910 "Efectivo en mano")
- The Petty Cash UI already supports multiple funds with the imprest replenishment workflow

## Proposed Setup

### 1. Create GL Sub-Accounts
Add two new postable sub-accounts under 1910 for proper ledger separation:

| Code | Name | Purpose |
|------|------|---------|
| 1911 | Caja Chica Finca | Farm petty cash (imprest fund with fixed balance) |
| 1912 | Caja Chica Industria | Industry petty cash (reimbursement-based) |

### 2. Create Two Petty Cash Funds in Treasury
Using the existing Petty Cash tab UI (no code changes needed):

- **Caja Chica Finca** — mapped to GL 1911, with a `fixed_amount` (e.g., 10,000 DOP) for imprest replenishment
- **Caja Chica Industria** — mapped to GL 1912, with `fixed_amount = 0` (reimbursement model, no standing balance)

### 3. Rename or Deactivate Original
Optionally deactivate the original "Caja Chica" (GL 1910) once balances are transferred to the new funds.

## Technical Steps
1. **Database migration**: Insert two new rows into `chart_of_accounts` (1911, 1912) as postable accounts under the ASSET type
2. **Data insert**: Create two new `bank_accounts` rows with `account_type = 'petty_cash'`
3. **No code changes required** — the existing Petty Cash view, replenishment dialog, and transaction payment method dropdown all work with multiple petty cash accounts already

## Notes
- The reimbursement workflow for Industry: manager pays out-of-pocket, submits receipt, transaction is recorded against "Caja Chica Industria", and reimbursement is made via bank transfer
- Both funds will appear in the Payment Method dropdown under the "Caja Chica" group when creating transactions
- GL balances will be tracked independently per fund

