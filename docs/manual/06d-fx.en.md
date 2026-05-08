# Chapter 6d — FX (Exchange rates and revaluation)

## 1. Purpose

This chapter covers two distinct FX features that often get confused with each other but serve very different purposes.

1. **Daily official rate (BCRD)** — the system automatically captures the USD/DOP rate published every morning by the Banco Central de la República Dominicana. This rate is used as a suggested default on any multi-currency transaction.
2. **Period-end FX revaluation** — at month-end, the system recomputes the DOP value of any open foreign-currency document (in AP, AR, and Home Office) using the rate of the closing date, and posts the difference to account 8510.

The first keeps day-to-day transactions priced consistently; the second keeps the balance sheet honest at close.

## 2. Roles and permissions

Access is governed by role. "read" is view-only and "—" means the action is unavailable.

| Action | Admin | Accountant | Others |
|---|---|---|---|
| View rates | ✓ | ✓ | read |
| Force rate scrape | ✓ | ✓ | — |
| Run period-end revaluation | ✓ | ✓ | — |

## 3. Daily official rate

### 3.1 Where it comes from

A scheduled function queries the Banco Central de la República Dominicana every morning and stores the day's USD/DOP rate in the `exchange_rates` table.

### 3.2 Where it is used

The captured rate feeds several places in the application as a suggested default — never as a hard requirement:

- Home Office dialogs (auto-suggested rate when registering an advance or repayment).
- Foreign-currency invoice capture.
- Multi-currency bank movements.
- The "Unrealized FX" tile on the Home Office view.

### 3.3 When the rate is missing

If the cron job fails, or the day is a holiday and BCRD does not publish a rate, the system handles the gap gracefully but visibly:

- Forms show an empty rate field and force the user to type a value manually.
- The "Unrealized FX" tile shows `—`.
- To resolve: Admin → Settings → run a manual scrape, or insert the rate by hand for that date.

## 4. Period-end FX revaluation

### 4.1 When to run it

The revaluation should be run at the end of each accounting month, **before** closing the period. Ideally on the last calendar day of the month, using the BCRD rate for that same day.

### 4.2 How to run it

1. Accounting → toolbar → **Reevaluar FX al Cierre** (Period-end FX revaluation).
2. Capture the **As-of Date**.
3. Choose the **Accounting Period** (only periods in `open` status appear in the picker).
4. Click **Execute Revaluation**. Two RPCs run in sequence:
   - `revalue_open_ap_ar` — re-prices open AP and AR documents in foreign currency.
   - `revalue_open_home_office` — re-prices open Home Office advance tranches.
5. A confirmation toast reports the number of documents and tranches revalued.

> [SCREENSHOT: Period-end revaluation dialog with as-of date and period picker]

### 4.3 What the calculation does

For each open foreign-currency document or tranche, the system computes:

- Original value = FC amount × historical rate.
- As-of value = FC amount × as-of rate.
- Difference = As-of − Original.

It then posts one journal entry per document:

- If the difference favors the entity, the journal posts Dr document / Cr 8510 (gain).
- Otherwise, it posts Dr 8510 (loss) / Cr document.

Each revaluation is stored in `fx_revaluations` with `is_active = true` until one of two things happens:

- The document is settled (payment or void) and a trigger deactivates the open revaluation, or
- A new revaluation supersedes the previous one.

### 4.4 Home Office vs AP/AR

The **Reevaluar FX** button runs both RPCs together for the same period, so a single click covers AP, AR, and Home Office. The Home Office journal touches `2160` and is linked to the specific advance so it can be drilled down later.

## 5. Business rules and validations

A few rules govern how revaluation behaves. Knowing them avoids surprises at close.

- Only periods in `open` status accept revaluations.
- Revaluation is **non-destructive**: it never modifies the original advances or documents; it only creates rows in `fx_revaluations` and a difference journal.
- Account **8510** holds both FX gains and losses, signed accordingly.
- Zero-difference revaluations produce no journal — the calculation runs, but nothing is posted.
- When an open document or advance is settled, its open FX revaluation is deactivated by trigger; the difference becomes "realized" and is posted from the payment or repayment flow, not from here.

## 6. Accounting impact

| Case | Journal |
|---|---|
| Open AR, peso depreciates (more DOP) | Dr AR / Cr 8510 |
| Open AR, peso appreciates | Dr 8510 / Cr AR |
| Open AP, peso depreciates | Dr 8510 / Cr AP |
| Home Office, peso depreciates | Dr 8510 / Cr 2160 |

The mental model: a depreciating peso means more DOP are needed to settle the same foreign-currency obligation, so foreign-currency liabilities (AP, 2160) grow on the credit side; foreign-currency receivables (AR) also grow, but on the debit side.

## 7. Common errors

- **"Select a specific entity"** — the revaluation button requires a fixed entity. It does not work from the consolidated view.
- **Nothing to revalue** — every open document is in DOP, or all foreign-currency documents have already been revalued at that date.
- **Double revaluation** — running revaluation twice for the same date computes against the last revalued value and most often posts zero. It isn't an error, but it does clutter the journal.
- **No BCRD rate today** — capture the rate manually or retry the scrape before running revaluation.

## 8. Related chapters

- Chapter 6b — Home Office
- Chapter 7 — AR / AP
- Chapter 6a — Accounting periods and closing

## Glossary

- **BCRD** — Banco Central de la República Dominicana, the source of the official daily USD/DOP exchange rate.
- **Daily official rate** — The USD/DOP rate captured every morning from BCRD; used as a suggestion on multi-currency transactions.
- **`exchange_rates`** — The database table where the daily rate is stored.
- **Period-end FX revaluation** — A month-end recomputation of the DOP value of open foreign-currency documents, with the difference posted to 8510.
- **As-of date** — The date whose rate is used to revalue open foreign-currency balances.
- **Account 2160** — Home Office payable account; touched by Home Office FX revaluations.
- **Account 8510** — FX gain/loss account; holds both gains and losses signed accordingly.
- **`fx_revaluations`** — The table that stores each revaluation result, with `is_active = true` while the underlying document remains open.
- **Open document / tranche** — An AP or AR document, or a Home Office advance tranche, that has not yet been fully settled.
- **Realized FX** — The FX difference recognized when a document is actually settled (paid, voided, or repaid); posted from the payment flow, not from revaluation.
- **Unrealized FX** — The FX difference recognized while a document is still open; posted by revaluation and reversed when the document is settled.
- **`revalue_open_ap_ar`** — RPC that revalues open AP and AR foreign-currency documents.
- **`revalue_open_home_office`** — RPC that revalues open Home Office advance tranches.
