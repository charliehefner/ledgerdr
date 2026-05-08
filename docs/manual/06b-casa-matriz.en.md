# Chapter 6b — Home Office (Casa Matriz)

## 1. Purpose

The Home Office module tracks contributions made by the foreign parent company — for example **JORD AB** in USD — to the local operating entity. Those contributions can take several forms: cash, equipment, an expense paid on behalf of the local entity, or value charged into a construction-in-progress (CIP) project. Whatever the form, the module carries the principal in both the foreign currency and DOP, accrues interest on a monthly cycle, calculates the FX difference at the moment of repayment, and lets you revalue any open balance at period end.

In effect, Casa Matriz is the running ledger between the parent and the local entity — a long-running intercompany account that needs careful treatment because it crosses currencies and bears interest.

## 2. Roles and permissions

Access is governed by role. "read" means view-only and "—" means the action is unavailable.

| Action | Admin | Management | Accountant | Others |
|---|---|---|---|---|
| View Home Office | ✓ | ✓ | ✓ | read |
| Record advance / repayment | ✓ | ✓ | ✓ | — |
| Manual interest accrual | ✓ | ✓ | ✓ | — |
| Capitalize interest to principal | ✓ | ✓ | ✓ | — |
| Period-end revaluation | ✓ | — | ✓ | — |

Period-end revaluation is restricted to Admin and Accountant because it is a close-the-books action that interacts with FX rates and rolls into financial statements.

## 3. Screen tour

The module lives under Accounting → **Casa Matriz** tab.

- A header strip with four key statistics: Principal in foreign currency, Principal in DOP (at historical rates), Accrued interest, and Unrealized FX (valued at today's rate).
- A **New entry** button, plus a menu offering **Record repayment** and **Accrue month**.
- An **Export statement** button that produces an Excel or PDF report of all movements with totals.
- Three tables below the header: **Advances**, **Repayments**, and **Monthly accruals**.

> [SCREENSHOT: Casa Matriz view showing the 4 stat tiles]

## 4. Step-by-step workflows

This section walks through the day-to-day operations: recording advances and repayments, running the monthly interest accrual, capitalizing interest, and producing a statement.

### 4.1 Record an advance

1. Click **New entry**.
2. Capture **date**, **kind**, **currency**, **amount**, and **rate**.
3. The **kind** drives where the entry posts on the debit side:
   - *Cash transfer* → the receiving bank account.
   - *Equipment (capitalize to fixed asset)* → the asset account (1xxx).
   - *Equipment (CIP)* → an existing CIP project.
   - *Equipment / inventory* → the inventory account (14xx).
   - *Expense paid on behalf* → the relevant expense account.
   - *Other* → any postable account.
4. Set the **interest rate** (annual) and **basis** (actual/365, actual/360, 30/360, or none). Equipment kinds default to **0 %**; cash defaults to **inherit** the parent's rate (4 % for JORD AB). Both values can be overridden on a per-advance basis.
5. Add a free-text reference and description.
6. Click **Register**. The system posts **Dr [destination] / Cr 2160** (Home Office payable). The advance is linked to its journal entry via `journal_source_links` so it can be drilled down later.

> [SCREENSHOT: New advance form with kind selector]

### 4.2 Record a repayment

1. From the menu, choose **Record repayment**.
2. Capture date, currency, amount, rate, and the source bank account.
3. Click **Post repayment**. The system posts **Dr 2160 / Cr Bank**. The difference between the FIFO-consumed advance rates and today's rate is posted to **8510** as realized FX.

### 4.3 Monthly interest accrual

The cron job `home-office-interest-monthly` runs at 23:55 on days 28–31 of each month and checks whether the day is the last of the month. When it is, it calls `post_home_office_interest_accrual` for every party + entity combination, generating a single accrual per month:

- Days are computed according to each advance's `interest_basis`.
- The per-advance `interest_rate_pct` is used — there is no single global rate.
- The system posts **Dr 7510 (interest expense) / Cr 2160 (accrued)**.

To run the accrual manually outside the cron schedule, choose **Accrue month** from the menu.

### 4.4 Capitalize interest to principal

On any `accrued` row, click **Capitalize**. The interest stops being a separate accrual and becomes part of the linked advance's principal as a new "tranche", carrying the prevailing rate and basis. Use this option when the contract between parent and entity permits compounding.

### 4.5 Period-end FX revaluation

Period-end revaluation for Casa Matriz is run from the central FX flow described in Chapter 6d — FX. The **Reevaluar FX** button on the Accounting toolbar automatically includes Home Office balances alongside AP and AR.

### 4.6 Export statement

The header **Export statement** button produces an Excel or PDF document containing all advances, repayments, and accruals for the selected party, with a totals row and the four header statistics.

> [SCREENSHOT: Exported statement first page]

## 5. Business rules and validations

A few rules govern how the module behaves under the hood. Knowing them helps interpret the numbers correctly.

- Each advance stores **its own interest configuration** (`interest_rate_pct`, `interest_basis`). The cron uses per-advance values, not a global rate.
- Repayments consume advances **FIFO** and decrease `balance_remaining_fc`. When an advance reaches zero, the trigger `trg_ho_deactivate_fx_revals` deactivates that advance's open FX revaluations.
- Voiding an advance (`status = voided`) also deactivates its open FX revaluations.
- The balance is computed from the `home_office_balance` view at read time — it is not a stored figure.
- **2160** is reserved for Home Office payable. Any journal entry touching 2160 from outside this module will appear as drift against the calculated principal.

## 6. Accounting impact

| Operation | Journal |
|---|---|
| Advance | Dr [bank / asset / CIP / expense] / Cr 2160 |
| Interest accrual | Dr 7510 / Cr 2160 |
| Capitalization | Dr 2160 (interest) / Cr 2160 (principal) — reclass |
| Repayment | Dr 2160 / Cr Bank (± 8510 if FX) |
| FX revaluation | Dr/Cr 2160 / Cr/Dr 8510 |

The pattern to keep in mind: all activity flows through **2160** on one side and either bank / asset / CIP / expense (on advances) or **8510** (on FX adjustments and realized FX at repayment) on the other.

## 7. Common errors

- **"Destination account missing"** — pick a bank, a CIP project, or an account corresponding to the advance kind.
- **"Invalid FX rate"** — the rate must be greater than zero; for USD, today's official rate is auto-suggested.
- **"Unrealized FX" stat shows —** — no BCRD rate exists for today (see Chapter 6d).
- **Duplicate accrual in a month** — a row already exists in `home_office_interest_accruals` for that month. The RPC ignores it once posted and regenerates only after the prior one is discarded.

## 8. Related chapters

- Chapter 6c — CIP (construction in progress)
- Chapter 6d — FX (period-end revaluation)
- Chapter 11 — Intercompany (Due To / Due From between sibling entities)

## Glossary

- **Home Office (Casa Matriz)** — The foreign parent company that contributes funds, equipment, or paid-on-behalf expenses to the local entity.
- **JORD AB** — The parent company in this configuration; its functional currency is USD.
- **Advance** — A contribution from the parent to the local entity, valued in foreign currency and DOP, with its own interest rate and basis.
- **Repayment** — A payment from the local entity back to the parent, consuming advances FIFO and triggering realized FX.
- **Account 2160** — Home Office payable; the running balance owed by the local entity to the parent.
- **Account 7510** — Interest expense generated by monthly accruals.
- **Account 8510** — Realized FX gain/loss on repayment and FX revaluation adjustments.
- **Interest basis** — The day-count convention used to compute interest (actual/365, actual/360, 30/360, or none).
- **Capitalization** — Folding accrued interest into the principal of an advance as a new tranche, so interest itself begins to bear interest.
- **CIP (Construction in Progress)** — A long-running asset project that can be the destination of an equipment advance (see Chapter 6c).
- **FIFO consumption** — When a repayment is registered, advances are consumed in order from oldest to newest.
- **`home_office_balance`** — The database view that computes the open balance at read time.
- **BCRD** — Banco Central de la República Dominicana, source of the official daily exchange rate.
- **RPC** — Backend function called by the application (for example `post_home_office_interest_accrual`).
