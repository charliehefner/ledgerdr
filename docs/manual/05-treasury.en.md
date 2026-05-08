# Chapter 5 — Treasury

## 1. Purpose

The Treasury module is the operational window where every actual movement of money is recorded before it is closed against accounting. It manages all cash and cash equivalents in the company: bank accounts, credit cards, petty cash, internal transfers between accounts the company owns, credit-card payments, and supplier prepayments.

If Purchasing tracks what the company has committed to spend and Accounts Payable tracks what it owes, Treasury is where the funds physically leave or enter — and where the books are reconciled with what the bank actually shows.

## 2. Roles and permissions

Access to Treasury is governed by role. The table below shows what each role may do across the seven Treasury areas. "read" means the user can view but not change; "write" means full read-and-write; "—" means the area is hidden.

| Role | Reconciliation | Bank accounts | Cards | Petty cash | Internal transfers | CC payments | Advances |
|---|---|---|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accountant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supervisor | read | read | read | read | read | read | read |
| Office | — | — | — | **write** | — | — | — |
| Viewer | read | read | read | read | read | read | read |

The **Office** role lands directly on Petty Cash and sees nothing else; the other tabs are hidden so the user is never asked to choose between irrelevant options.

## 3. Screen tour

Treasury is split into tabs, each one tied to a specific kind of money movement.

- **Bank reconciliation** — import bank statements and match lines against journal entries.
- **Bank accounts** — create and maintain bank accounts per entity and currency.
- **Credit cards** — register cards and the transactions made on them.
- **Petty cash** — capture slips, run replenishments, lock weekly closures.
- **Internal transfers** — move money between two accounts the company owns.
- **CC payments** — pay credit cards from a bank account, including any fees.
- **Supplier advances** — prepayments to suppliers booked to **1690**, ready to apply against a future invoice.

> [SCREENSHOT: full-width Treasury tabs]

## 4. Step-by-step workflows

This section covers the most common Treasury actions, in the order a user is most likely to encounter them.

### 4.1 Create a bank account

1. Treasury → **Bank accounts** → **New**.
2. Capture: name, bank, number, **currency** (DOP/USD/EUR/SEK), type, chart account (`chart_account_id`), and entity.
3. Save. The account becomes active (`is_active = true`).

> [SCREENSHOT: New bank account form]

### 4.2 Internal transfer

An internal transfer is neither income nor expense — it is movement between two accounts the company owns. To keep both sides balanced, the system posts through the bridge account **0000 — Internal Transfers**.

1. Treasury → **Internal Transfers** → **New**.
2. Choose the source account, destination account, date, and amount.
3. If the two accounts are in different currencies, capture the FX rate. Any realized FX difference posts to **8510**.
4. Save. Two balanced journal entries are generated through 0000.

### 4.3 Credit-card payment

1. Treasury → **CC Payments** → **New payment**.
2. Choose the card, the bank account paying it, the date, the amount, and any fees.
3. The system posts Dr Card / Cr Bank, with any fees recorded in their corresponding account.

### 4.4 Supplier advance

A supplier advance is a prepayment made before an invoice exists. It is parked in **1690** and stays there until it can be applied against a real invoice in Accounts Payable.

1. Treasury → **Supplier Advances** → **New**.
2. Capture supplier, source bank, date, amount, and reference.
3. The system posts **Dr 1690 / Cr Bank**. The advance becomes available to apply against a future invoice from Accounts Payable (Chapter 7).

### 4.5 Petty cash (Office role included)

Petty cash is the only Treasury area an Office user can write to, since they are typically the ones managing day-to-day small expenses.

1. Treasury → **Petty cash** → **New slip** for each expense.
2. Run **Replenish** to generate the journal entry from bank to cash.
3. Run weekly closures to lock the slips for the period.

> [SCREENSHOT: Petty cash slips list with weekly closure indicator]

### 4.6 Bank reconciliation

1. Treasury → **Reconciliation**.
2. Import the bank statement using the format supported for that entity.
3. The system suggests automatic matches based on amount and date.
4. Mark the matched items as reconciled and investigate any differences.
5. Bank fees that the system detects are auto-categorized.

> [SCREENSHOT: Reconciliation view with auto-matched lines highlighted]

## 5. Business rules and validations

A handful of rules apply across Treasury. Knowing them in advance avoids confusing balances at month-end.

- **Bridge account 0000** is reserved for internal transfers; its end-of-day balance must be zero.
- **Account 1690** is reserved for supplier advances and should not be used for anything else.
- **Closed periods** block the insertion of any movement dated inside the period.
- **Multi-currency**: every movement stores the foreign-currency amount, the rate, and the DOP amount. Any realized FX difference is isolated to **8510** so it never contaminates operating accounts.

## 6. Accounting impact

| Operation | Typical journal |
|---|---|
| Internal transfer | Dr Bank dest / Cr 0000; Dr 0000 / Cr Bank src |
| CC payment | Dr Card liability / Cr Bank |
| Supplier advance | Dr 1690 / Cr Bank |
| Petty cash replenishment | Dr 1110 (cash) / Cr Bank |
| Reconciled fee | Dr Bank fee expense / Cr Bank |

The two accounts to keep an eye on are **0000** (which should net to zero each day) and **1690** (which should clear as advances are applied to invoices). A persistent balance in either is a signal something didn't close cleanly.

## 7. Common errors

- **"Destination account missing chart_account_id"** — the bank account isn't linked to a chart account. Edit it and complete the field.
- **"Period closed"** — the captured date falls inside a locked period. Adjust the date or, if appropriate, ask Admin to reopen the period.
- **Unexpected FX difference** — the captured rate differs from the official daily rate. Verify the BCRD rate for that day (see Chapter 6d — FX).

## 8. Related chapters

- Chapter 6 — Accounting (journals, periods, chart of accounts)
- Chapter 6d — FX (official rates and revaluation)
- Chapter 7 — Accounts Receivable & Payable (advance application)

## Glossary

- **Treasury** — The operational area covering all actual movements of cash and cash equivalents.
- **Bank account** — An account belonging to the company at a bank, in a defined currency, linked to a chart account.
- **Internal transfer** — A movement between two accounts the company owns; passes through bridge account 0000.
- **Bridge account 0000** — Internal Transfers clearing account; net daily balance must be zero.
- **Account 1690** — Supplier advances; prepayments parked here until applied to an invoice.
- **Account 8510** — Realized FX gain/loss account; isolated from operating results.
- **Petty cash** — Small-value cash float managed at the office level; replenished from a bank account.
- **CC payment** — Bank-to-card payment that reduces card liability.
- **Supplier advance** — Prepayment made to a supplier before an invoice exists; later applied to an AP invoice.
- **Bank reconciliation** — The process of matching imported bank-statement lines against journal entries already in the system.
- **BCRD** — Banco Central de la República Dominicana, the source of the official daily exchange rate.
- **DOP / USD / EUR / SEK** — Currencies supported in Treasury (Dominican peso, US dollar, euro, Swedish krona).
