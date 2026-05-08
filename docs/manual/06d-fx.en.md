# Chapter 6d — FX (Exchange rates and revaluation)

## 1. Purpose

This chapter covers two distinct features that are often confused:

1. **Daily official rate (BCRD)** — automatic capture of the USD/DOP rate
   published by the Central Bank, used as a suggestion on any multi-currency
   transaction.
2. **Period-end FX revaluation** — recomputes the DOP value of open
   foreign-currency documents at the period end (AP, AR and Home Office),
   posting an adjustment to 8510.

## 2. Roles and permissions

| Action | Admin | Accountant | Others |
|---|---|---|---|
| View rates | ✓ | ✓ | read |
| Force rate scrape | ✓ | ✓ | — |
| Run period-end revaluation | ✓ | ✓ | — |

## 3. Daily official rate

### 3.1 Where it comes from

A scheduled function queries the Banco Central de la República Dominicana
each morning and stores the USD/DOP rate in `exchange_rates` for the day.

### 3.2 Where it is used

- Home Office dialogs (auto-suggested rate).
- Foreign-currency invoice capture.
- Multi-currency bank movements.
- "Unrealized FX" tile on Home Office.

### 3.3 When the rate is missing

If the cron fails or it's a holiday:

- Forms show an empty rate field and force manual entry.
- "Unrealized FX" tile shows `—`.
- Action: Admin → Settings → run manual scrape, or insert the rate by hand.

## 4. Period-end FX revaluation

### 4.1 When to run it

At the end of each accounting month, **before** closing the period. Ideally
the last calendar day of the month using BCRD's rate for that day.

### 4.2 How to run it

1. Accounting → toolbar → **Reevaluar FX al Cierre** (Period-end FX
   revaluation).
2. Capture the **As-of Date**.
3. Choose the **Accounting Period** (only `open` periods appear).
4. **Execute Revaluation**. Two RPCs run:
   - `revalue_open_ap_ar` — open AP and AR documents in foreign currency.
   - `revalue_open_home_office` — open Home Office advance tranches.
5. A toast confirms number of documents / tranches revalued.

### 4.3 What the calculation does

For each open foreign-currency document or tranche:

- Original value = FC amount × historical rate.
- As-of value = FC amount × as-of rate.
- Difference = As-of − Original.

Posts one journal per document:

- If the difference favors the entity: Dr document / Cr 8510 (gain).
- Otherwise: Dr 8510 (loss) / Cr document.

Each revaluation is stored in `fx_revaluations` with `is_active = true`
until:

- The document is settled (payment or void) and a trigger deactivates the
  open revaluation, **or**
- A new revaluation supersedes the previous one.

### 4.4 Home Office vs AP/AR

The **Reevaluar FX** button runs both RPCs together for one period. The Home
Office journal touches `2160` and is linked to the specific advance for
drilldown.

## 5. Business rules and validations

- Only `open` periods accept revaluations.
- Revaluation is **non-destructive**: it never modifies advances or
  documents, only creates rows in `fx_revaluations` and a difference
  journal.
- Account **8510** holds both FX gains and losses (signed accordingly).
- Zero-difference revaluations produce no journal.
- When an open document or advance is settled, its open FX revaluation is
  deactivated by trigger; the difference becomes "realized" and is posted
  from the payment / repayment flow, not here.

## 6. Accounting impact

| Case | Journal |
|---|---|
| Open AR, peso depreciates (more DOP) | Dr AR / Cr 8510 |
| Open AR, peso appreciates | Dr 8510 / Cr AR |
| Open AP, peso depreciates | Dr 8510 / Cr AP |
| Home Office, peso depreciates | Dr 8510 / Cr 2160 |

## 7. Common errors

- **"Select a specific entity"** — the button requires a fixed entity; it
  does not work in consolidated view.
- **Nothing to revalue** — all documents are in DOP or already revalued at
  that date.
- **Double revaluation** — running twice for the same date computes against
  the last revalued value and likely posts zero. Not an error, but it
  clutters the journal.
- **No BCRD rate today** — capture manually or retry the scrape before
  revaluing.

## 8. Related chapters

- Chapter 6b — Home Office
- Chapter 7 — AR / AP
- Chapter 6a — Accounting periods and closing
