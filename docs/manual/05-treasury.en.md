# Chapter 5 — Treasury

## 1. Purpose

Treasury manages all cash and cash equivalents: bank accounts, credit cards,
petty cash, internal transfers between owned accounts, credit-card payments
and supplier prepayments. It is the window where actual money movement is
recorded before being closed against accounting.

## 2. Roles and permissions

| Role | Reconciliation | Bank accounts | Cards | Petty cash | Internal transfers | CC payments | Advances |
|---|---|---|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accountant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supervisor | read | read | read | read | read | read | read |
| Office | — | — | — | **write** | — | — | — |
| Viewer | read | read | read | read | read | read | read |

The **Office** role lands directly on Petty Cash; the other tabs are hidden.

## 3. Screen tour

`Treasury` is split into tabs:

- **Bank reconciliation** — import bank statements and match lines to journal
  entries.
- **Bank accounts** — create and maintain accounts per entity and currency.
- **Credit cards** — register cards and their transactions.
- **Petty cash** — slips, replenishments, weekly closures.
- **Internal transfers** — between two owned accounts.
- **CC payments** — bank-to-card payments with fees.
- **Supplier advances** — prepayments booked to **1690** ready to apply to a
  future invoice.

> [SCREENSHOT: full-width Treasury tabs]

## 4. Step-by-step workflows

### 4.1 Create a bank account

1. Treasury → **Bank accounts** → **New**.
2. Capture: name, bank, number, **currency** (DOP/USD/EUR/SEK), type, chart
   account (`chart_account_id`), and entity.
3. Save. The account becomes active (`is_active = true`).

### 4.2 Internal transfer

An internal transfer is not income or expense — it is movement between owned
accounts. It posts through the bridge account **0000 — Internal Transfers**.

1. Treasury → **Internal Transfers** → **New**.
2. Choose source, destination, date and amount.
3. If currencies differ, capture FX rate. Realized FX difference posts to
   **8510**.
4. Save. Two balanced journal entries are generated through 0000.

### 4.3 Credit-card payment

1. Treasury → **CC Payments** → **New payment**.
2. Choose the card, paying bank, date, amount and any fees.
3. Posts Dr Card / Cr Bank (+ fees to their account).

### 4.4 Supplier advance

1. Treasury → **Supplier Advances** → **New**.
2. Capture supplier, source bank, date, amount and reference.
3. Posts **Dr 1690 / Cr Bank**. The advance becomes available to apply to a
   future invoice from Accounts Payable (Chapter 7).

### 4.5 Petty cash (Office role included)

1. Treasury → **Petty cash** → **New slip** for each expense.
2. **Replenish** generates the journal from bank to cash.
3. Weekly closures lock the slips for the period.

### 4.6 Bank reconciliation

1. Treasury → **Reconciliation**.
2. Import the bank statement (format supported per entity).
3. The system suggests automatic matches by amount and date.
4. Mark matched items reconciled; investigate differences.
5. Detected bank fees are auto-categorized.

## 5. Business rules and validations

- **Bridge account 0000** is reserved for internal transfers; its end-of-day
  balance must be zero.
- **Account 1690** is reserved for supplier advances.
- **Closed periods** block any movement insertion with a date inside the
  period.
- **Multi-currency**: each movement stores foreign-currency amount, rate and
  DOP amount. Realized FX difference is isolated to **8510**.

## 6. Accounting impact

| Operation | Typical journal |
|---|---|
| Internal transfer | Dr Bank dest / Cr 0000; Dr 0000 / Cr Bank src |
| CC payment | Dr Card liability / Cr Bank |
| Supplier advance | Dr 1690 / Cr Bank |
| Petty cash replenishment | Dr 1110 (cash) / Cr Bank |
| Reconciled fee | Dr Bank fee expense / Cr Bank |

## 7. Common errors

- **"Destination account missing chart_account_id"** — the bank account is
  not linked to a chart account; edit it and complete the field.
- **"Period closed"** — captured date falls in a locked period.
- **Unexpected FX difference** — the captured rate differs from the official
  daily rate; verify BCRD for that day (see Chapter 6d — FX).

## 8. Related chapters

- Chapter 6 — Accounting (journals, periods, chart of accounts)
- Chapter 6d — FX (official rates and revaluation)
- Chapter 7 — Accounts Receivable & Payable (advance application)
