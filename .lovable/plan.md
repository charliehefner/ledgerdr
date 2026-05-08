
# A/P & A/R Architecture Review

This is an **analysis-and-recommendations plan** (no code yet). It compares how this app generates, processes, and pays A/P and A/R documents against how mainstream accounting systems (QuickBooks, Xero, NetSuite, SAP B1, Odoo) implement the same flow, and proposes prioritized changes.

---

## 1. How standard accounting software handles A/P and A/R

The classic sub-ledger pattern used by every serious system has the following anatomy:

```text
                      ┌──────────────────────────┐
   Source documents → │  Bill / Vendor Invoice   │ → posts: Dr Expense / Cr 2101 A/P
                      │  Customer Invoice        │ → posts: Dr 1210 A/R / Cr Revenue
                      └──────────┬───────────────┘
                                 │ (creates open item)
                                 ▼
                      ┌──────────────────────────┐
                      │  A/P or A/R sub-ledger    │  open items, aging, status
                      └──────────┬───────────────┘
                                 │ (apply payment / credit / advance)
                                 ▼
                      ┌──────────────────────────┐
                      │  Payment / Receipt       │ → posts: Dr 2101 / Cr Bank
                      │                          │ → or: Dr Bank / Cr 1210
                      └──────────────────────────┘
```

Key invariants found in standard systems:

1. **Master records first.** A `Vendor` or `Customer` is a first-class entity with an ID, tax ID, default terms, default GL account, default currency, payment instructions. Documents reference the master, never a free-text name.
2. **One source document = one sub-ledger open item.** The bill/invoice is *the* open item; there is no separate "create the open item manually" step.
3. **Payments are many-to-many with documents.** One check can pay many bills, one bill can be paid by many checks. A `payment_application` table joins them with an amount.
4. **Credit memos, debit notes, and advances are sub-ledger documents** that *apply against* invoices through the same application table — they are not handled by a separate UI/flow.
5. **Status is derived**, not stored on the header. `status = open / partial / paid / void / written-off` is computed from `total – Σ applications`.
6. **Aging** runs off the sub-ledger, with snapshot-as-of-date support (so you can reproduce a prior month's aging).
7. **Currency**: each open item carries `currency`, `original_amount`, and `fx_rate_at_doc`. Payment carries `payment_currency`, `payment_fx_rate`, and the system books a **realized FX gain/loss** automatically when applied. Period-end posts an **unrealized FX gain/loss** revaluation.
8. **Posting integrity**: bills/invoices and payments each produce *one* journal each (or none, if held as draft). The journal and the sub-ledger document are linked 1:1 and cannot drift.
9. **Approvals and locking**: bills above a threshold need approval; once paid or voided, the document is locked from edits.
10. **Three-way match (mature systems)**: PO ↔ Receipt ↔ Bill, with tolerance.

---

## 2. How this codebase implements A/P and A/R today

### 2.1 Generation paths
There are **three** ways an A/P or A/R document gets created — and they don't all behave the same:

| Path | Where | What it does |
|---|---|---|
| **A. Manual** | `ApArDocumentList` → "Nuevo documento" | Direct insert into `ap_ar_documents`. No journal is posted. Free-text `contact_name`, optional `contact_rnc`. |
| **B. Auto from transaction** | `TransactionForm` + `apArUtils.shouldCreateApAr` + `create_transaction_with_ap_ar` RPC | When a purchase/sale is entered with `pay_method='credit'` OR a `due_date` OR a `1690` advance account, the RPC inserts the transaction *and* the AP/AR doc and the journal. |
| **C. Side effect of payment** | `PaymentDialog` | Posts journal + inserts a `transactions` row + inserts `ap_ar_payments` + updates `amount_paid`/`status` on the doc, all from the **client**. |

### 2.2 Data model
- `ap_ar_documents` — header + running totals (`amount_paid`, `balance_remaining`, `status`) stored, not derived.
- `ap_ar_payments` — payment events linked 1:1 to a document via `document_id` (no application table; one payment cannot be split across multiple invoices).
- `advance_allocations` — separate table, used only for advance-to-invoice mapping. Credit memos/debit notes have **no application mechanism** at all even though the dropdown exposes them.
- No `vendors`/`customers` master table tied to AP/AR — `contact_name` is free text. (CRM `contacts` exists but is decoupled per memory.)
- `entity_id`, `supplier_id`, `contract_id` exist on `ap_ar_documents` but `supplier_id` is not enforced and the create form doesn't set it.

### 2.3 Payment processing (`PaymentDialog.tsx`)
The client orchestrates **5 sequential writes** (journal → lines → transaction → link → payment → doc update) with manual rollback on failure. Notable issues:

- **Not atomic.** Partial failures depend on best-effort client cleanup. A network drop mid-flow leaves orphans.
- **Hard-coded fallback codes** `2100` / `1200` instead of `2101` / `1210` (mismatch with `apArUtils.getApArAccountCode`).
- **FX is wrong.** It only ever fetches `USD_DOP` (ignores `EUR_DOP`), and the *transaction* row is written with `exchange_rate: 1` for non-DOP, so FX is captured on the journal but not on the transaction — the two will disagree.
- **No realized FX gain/loss** when the bill was booked at one rate and paid at another.
- **Duplicate guard** is a 5-min lookup on `(document, date, amount, bank)` — fine for double-clicks, but not idempotent across sessions.
- **Status calc** uses 0.005 tolerance directly on stored numerics; standard practice rounds to 2 dp on the column itself.

### 2.4 Document processing
- `status` is mutated by hand in two places (PaymentDialog, allocateMutation, plus a trigger on `advance_allocations` presumably). Risk of drift.
- No "void" workflow that reverses the journal — voiding is implied by setting `status='void'` but the original journal stays posted.
- No partial credit memo application, no cross-document netting.
- No approval workflow on bills (the project has approval workflows for transactions; bills bypass them when entered via path A).
- **No three-way match** (PO → Receipt → Bill). The project has no PO concept at all.

### 2.5 Reporting
- Aging is computed in the **client** every render from the full document list (capped at 10,000). Works today but does not support "as-of" snapshots and won't scale.
- DGII 606/607 already pull from transactions, so AP/AR is *not* the source of regulatory reports — another sign the sub-ledger is partially decoupled.

---

## 3. Gap analysis

| Standard practice | Status here | Risk |
|---|---|---|
| Vendor/Customer master with default terms, GL, currency | Free-text `contact_name`; CRM not linked | Duplicate vendors, no terms enforcement, weak 1099/606 reliability |
| One source doc → one open item, journal in same transaction | Path A creates doc with no journal; Path C posts journal client-side | Sub-ledger ≠ GL; reconciliation drift |
| Payment → many docs (M:N application) | One payment, one document only | Can't record real-world checks paying multiple bills |
| Credit memos / debit notes apply against invoices | Type exists, no application UI | Dead UI options; users misuse them |
| Atomic posting (server-side transaction) | Client orchestrates 5 writes with manual rollback | Orphaned rows on failure |
| Derived status & balance | Stored & manually maintained | Drift between `amount_paid` and Σ`ap_ar_payments` |
| Multi-currency with realized/unrealized FX | Partial: FX captured on journal only, no realized gain/loss | Wrong P&L on FX bills |
| Void = reversing journal | Status flag only | GL stays posted after void |
| Approval thresholds on bills | Bypassed for path A | Control gap |
| Three-way match (PO/Receipt/Bill) | Not implemented | Acceptable for current scale |
| Aging snapshot as-of-date | Live calc only | Can't reproduce prior month aging |

---

## 4. Recommendations (prioritized)

### P0 — Correctness & data integrity (must fix)
1. **Move payment posting to a single RPC** `apply_ap_ar_payment(document_id, payment_date, amount, bank_account_id, fx_rate?)` that atomically: posts the journal, inserts payment, recomputes status. Delete the client-side orchestration in `PaymentDialog`.
2. **Replace stored `amount_paid` / `balance_remaining` / `status`** with a view (or trigger-maintained columns whose source of truth is `Σ ap_ar_payments + Σ advance_allocations`). Reduces drift.
3. **Fix fallback GL codes**: standardize on `2101` (AP) and `1210` (AR) everywhere; remove the `2100/1200` fallback.
4. **Fix FX in PaymentDialog**: respect EUR, write the same `exchange_rate` to both journal and transaction, and book a **realized FX gain/loss** line if `paid_rate != doc_rate`.
5. **Void semantics**: `void` must post a reversing journal and zero the open balance.

### P1 — Architectural alignment (high value)
6. **M:N payment application table** `ap_ar_payment_applications(payment_id, document_id, amount)`. UI lets one check pay multiple bills (the most-requested feature in any AP system). Existing `ap_ar_payments.document_id` becomes deprecated/migrated.
7. **Credit memo / debit note application** through the same application table. Removes the "type exists but does nothing" UI.
8. ✅ **Vendor/Customer master**: link `ap_ar_documents.supplier_id` to a real `business_partners` table (can be the existing `contacts` plus a thin partner extension carrying default terms, default GL, default currency, RNC). Validate at insert time. Migrate existing free-text names by RNC where possible.
9. ✅ **Approval gate for bills entered manually** (path A) — same threshold engine you already have for transactions.

### P2 — Process & controls
10. ✅ **Aging service**: server-side function `aging_as_of(date, direction)` returning per-currency buckets. Powers UI today, regulator-grade snapshots tomorrow.
11. **Period-end FX revaluation already exists** (`FxRevaluationButton`) — extend it to revalue open AP/AR sub-ledger items and post unrealized gain/loss.
12. ✅ **Edit lock**: posted/paid/void documents should be hard-locked (DB trigger), not just hidden buttons.
13. ✅ **Lock down generation paths**: collapse paths A/B/C into a single server-side `create_ap_ar_document` RPC so every doc gets the same validation, journal, and audit trail.

### P3 — Nice to have / future
14. ✅ Remittance advice PDF generation for vendor payments.
15. ✅ Statement of account PDF for customers.
16. **Deferred** — Lightweight purchase-order module to enable three-way match (multi-feature build, scope separately).
17. ✅ Customer credit limit checks at invoice creation.

---

## 5. What this analysis does **not** propose
- No change to DGII reporting (still sourced from `transactions` — that's a separate review).
- No change to inventory/stock tracking.
- No change to the petty cash / treasury flows.
- No multi-country abstraction (per memory: finish DR app first).

---

## 6. Suggested next step
If you want to act on this, the highest-leverage single change is **#1 + #2 + #6 together** — atomic server-side payment application against an M:N table, with derived status. That single migration eliminates most of the drift risks and unblocks credit-memo and split-payment features.

Tell me which recommendations you want turned into an implementation plan and I'll draft the migrations and UI changes.
