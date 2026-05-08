# Chapter 6b — Home Office (Casa Matriz)

## 1. Purpose

Home Office tracks contributions that the foreign parent (e.g. **JORD AB** in
USD) makes to the local operating entity. Each contribution can be cash,
equipment, an expense paid on behalf, or charged to a construction-in-progress
(CIP) project. The module carries the principal in foreign currency and DOP,
accrues interest monthly, calculates the FX difference on repayment, and lets
you revalue the open balance at period end.

## 2. Roles and permissions

| Action | Admin | Management | Accountant | Others |
|---|---|---|---|---|
| View Home Office | ✓ | ✓ | ✓ | read |
| Record advance / repayment | ✓ | ✓ | ✓ | — |
| Manual interest accrual | ✓ | ✓ | ✓ | — |
| Capitalize interest to principal | ✓ | ✓ | ✓ | — |
| Period-end revaluation | ✓ | — | ✓ | — |

## 3. Screen tour

Accounting → **Casa Matriz** tab:

- Header with 4 stats: Principal in foreign currency, Principal in DOP
  (historical), Accrued interest, Unrealized FX (at today's rate).
- **New entry** button + menu with **Record repayment** and **Accrue month**.
- **Export statement** button (Excel / PDF) with all movements and totals.
- Tables for **Advances**, **Repayments**, and **Monthly accruals**.

> [SCREENSHOT: Casa Matriz view showing the 4 stat tiles]

## 4. Step-by-step workflows

### 4.1 Record an advance

1. **New entry**.
2. Capture **date**, **kind**, **currency**, **amount**, **rate**.
3. **Kind** drives the destination account:
   - *Cash transfer* → receiving bank account.
   - *Equipment (capitalize to fixed asset)* → asset account (1xxx).
   - *Equipment (CIP)* → existing CIP project.
   - *Equipment / inventory* → inventory account (14xx).
   - *Expense paid on behalf* → expense account.
   - *Other* → any postable account.
4. **Interest rate** (annual) and **basis** (actual/365, actual/360, 30/360,
   none). Equipment kinds default to **0 %**; cash defaults to **inherit** the
   parent rate (4 % for JORD AB). Both can be overridden per advance.
5. Free-text reference and description.
6. **Register**. Posts **Dr [destination] / Cr 2160** (Home Office payable).
   The advance is linked to its journal via `journal_source_links` for
   drilldown.

### 4.2 Record a repayment

1. Menu → **Record repayment**.
2. Capture date, currency, amount, rate, and source bank.
3. **Post repayment** → **Dr 2160 / Cr Bank**. The difference between the
   FIFO-consumed advance rates and today's rate is posted to **8510** as
   realized FX.

### 4.3 Monthly interest accrual

The cron `home-office-interest-monthly` runs at 23:55 on days 28–31 and
checks if it is the last day of the month. If so, it calls
`post_home_office_interest_accrual` for every party + entity, producing one
accrual per month:

- Days computed per `interest_basis`.
- Per-advance `interest_rate_pct` is used (not a single global rate).
- Posts **Dr 7510 (interest expense) / Cr 2160 (accrued)**.

To run it manually: menu → **Accrue month**.

### 4.4 Capitalize interest to principal

On any `accrued` row → **Capitalize**. The interest stops being a separate
accrual and becomes part of the linked advance's principal as a new "tranche"
at the prevailing rate and basis. Use when the contract permits compounding.

### 4.5 Period-end FX revaluation

See Chapter 6d — FX. The **Reevaluar FX** button on the Accounting toolbar
includes Home Office automatically alongside AP/AR.

### 4.6 Export statement

The header **Export statement** button produces Excel or PDF with all
advances, repayments, and accruals for the selected party, plus a totals row
and the four header stats.

## 5. Business rules and validations

- Each advance stores **its own interest** (`interest_rate_pct`,
  `interest_basis`); the cron uses per-advance values, not a global rate.
- Repayments consume advances **FIFO** and decrease `balance_remaining_fc`.
  When an advance reaches zero, the trigger
  `trg_ho_deactivate_fx_revals` deactivates its open FX revaluations.
- Voiding an advance (`status = voided`) also deactivates its open FX
  revaluations.
- Balance is computed from the `home_office_balance` view; not stored.
- **2160** is the Home Office payable; any journal touching it from outside
  this module will appear as drift against the calculated principal.

## 6. Accounting impact

| Operation | Journal |
|---|---|
| Advance | Dr [bank / asset / CIP / expense] / Cr 2160 |
| Interest accrual | Dr 7510 / Cr 2160 |
| Capitalization | Dr 2160 (interest) / Cr 2160 (principal) — reclass |
| Repayment | Dr 2160 / Cr Bank (± 8510 if FX) |
| FX revaluation | Dr/Cr 2160 / Cr/Dr 8510 |

## 7. Common errors

- **"Destination account missing"** — pick a bank, CIP project or account
  according to the kind.
- **"Invalid FX rate"** — must be > 0; today's official rate is auto-suggested
  for USD.
- **"Unrealized FX" stat shows —** — no BCRD rate exists for today
  (see Chapter 6d).
- **Duplicate accrual in a month** — there is already a row in
  `home_office_interest_accruals` for that month; the RPC ignores when
  posted, regenerates when discarded.

## 8. Related chapters

- Chapter 6c — CIP (construction in progress)
- Chapter 6d — FX (period-end revaluation)
- Chapter 11 — Intercompany (Due To / Due From between sibling entities)
