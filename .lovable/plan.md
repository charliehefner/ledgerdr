I checked the backend data: the day-labor closure did create the transaction, and it should be visible in both Transactions and Financial Ledger.

Confirmed transaction:

```text
Legacy ID: 581
Transaction ID: d09af74f-10ef-4974-9a98-1c3efb9b95df
Date: 01 May 2026
Created: 01 May 2026 21:48 UTC
Description: Jornales Semana al 01/05/2026
Account: 7690
Amount: RD$13,100.00
Internal: yes
Voided: no
Entity: Jord Dominicana
```

It is currently the 10th newest non-voided transaction, so with no filters it should appear in the default first page of Transactions and in Financial Ledger.

The likely problem is not that the transaction failed to generate. The problem is that the UI can show stale transaction query data after a day-labor week is closed, and the day-labor close backend function also needs hardening.

Plan to fix:

1. Fix transaction list refresh behavior
   - Make Transactions and Financial Ledger refetch transaction data when the page is opened/mounted, instead of relying on the 5-minute cached query window.
   - Ensure the day-labor close action invalidates all transaction-related lists, including Financial Ledger (`reportTransactions`), not just Recent Transactions.

2. Make the day-labor close function entity-safe
   - Update the close-week backend function to require/pass the selected `entity_id` explicitly.
   - Filter day-labor entries by both `week_ending_date` and `entity_id` before summing and closing.
   - Validate that the current user has access to that entity before creating the transaction.
   - This avoids future cases where a same-date week in another entity could be combined or closed incorrectly.

3. Populate the transaction account FK correctly
   - The generated day-labor transaction has `master_acct_code = 7690` but `account_id = NULL`.
   - Backfill existing generated day-labor transactions to point to account 7690.
   - Update the close-week function so all future day-labor transactions insert both `master_acct_code` and `account_id`.

4. Improve closure feedback
   - After closing a week, show the generated transaction legacy ID / transaction ID in the success message so it can be searched immediately.
   - Keep the PDF/receipts generation, but make the transaction creation result more visible.

5. Verify after implementation
   - Confirm the existing transaction 581 remains visible through the same query used by the app.
   - Confirm a future day-labor close creates one transaction for the selected entity only.
   - Confirm Transactions and Financial Ledger refresh without needing a hard browser reload.