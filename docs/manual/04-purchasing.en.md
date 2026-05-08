# Chapter 4 — Purchasing

## 1. Purpose

Purchasing manages the full cycle: purchase order (PO) → goods receipt →
supplier invoice → link to Accounts Payable. It enforces DGII rules (NCF, B11
withholding) and integrates OCR attachments for scanned invoices.

## 2. Roles and permissions

| Action | Admin | Management | Accountant | Supervisor | Others |
|---|---|---|---|---|---|
| View POs | ✓ | ✓ | ✓ | ✓ | read |
| Create PO | ✓ | ✓ | ✓ | ✓ | — |
| Receive goods | ✓ | ✓ | ✓ | ✓ | — |
| Capture invoice | ✓ | ✓ | ✓ | — | — |
| Validate PO ↔ invoice match | ✓ | — | ✓ | — | — |

## 3. Screen tour

**Purchasing** page with three tabs:

- **Purchase Orders** — list, search, create, line detail.
- **Goods Receipts** — what arrived and when, linked to the PO.
- **Invoices pending match** — invoices captured in AP whose match against PO
  + receipt is still pending.

> [SCREENSHOT: Purchasing → PO table with status badges]

PO statuses: `open`, `partially_received`, `received`, `closed`, `cancelled`.

## 4. Step-by-step workflows

### 4.1 Create a PO

1. Purchasing → **New PO**.
2. Capture supplier (auto-completes from Contacts), date, currency, notes.
3. Add lines: item, quantity, unit price, target account.
4. **Create**. RPC `create_purchase_order` generates the PO in `open` and
   assigns `po_number`.

### 4.2 Receive goods

1. Purchasing → **Receipts** → **New receipt**.
2. Choose the PO (only open / partially-received POs appear).
3. Per line, capture received quantity (≤ pending).
4. Notes and date.
5. **Receive**. RPC `receive_goods` updates `qty_received` per line, adjusts
   inventory stock, and advances the PO status.

### 4.3 Capture the supplier invoice

The invoice enters from **Accounts Payable** (Chapter 7) capturing NCF, date,
amount, and the PO link. Attach the scan: the OCR (Gemini 2.5 Pro) suggests
amount, NCF, and date that the user confirms.

#### NCF / B11 rules

- Accepted NCF types are validated against DGII (B01, B02, B11, B14, B15).
- **B11 — Informal-supplier voucher**: if the invoice is B11, the system
  automatically applies:
  - **100 % ITBIS withholding**: Dr ITBIS prepaid / Cr 2310 ITBIS payable.
  - **ISR withholding** at the service's rate.
  The supplier is paid the net.
- Duplicates: capture is blocked if another invoice with the same RNC + NCF
  exists in the period.

### 4.4 Validate PO ↔ invoice match

1. Purchasing → **Invoices pending match** → invoice row.
2. **Validate match**. RPC `validate_po_invoice_match` checks:
   - Invoiced qty ≤ received qty.
   - Invoice total = sum of lines (within tolerance).
   - Currencies and supplier match.
3. Status moves to `matched` and the invoice is released for payment.

## 5. Business rules and validations

- **Cannot invoice more than received** per line.
- **Closed period** blocks receipts and invoices dated in the period.
- **Attachments**: each PO/receipt/invoice supports multiple files
  (`transaction_attachments`); standard path
  `entity/{entity_id}/po/{po_id}/...`.
- **Multi-currency**: PO and invoice can be in non-DOP currencies; the
  invoice rate defines the booked amount.
- **Editing**: a PO with receipts cannot modify already-received lines.

## 6. Accounting impact

POs themselves do **not** post journals. Journals are generated on:

| Event | Journal |
|---|---|
| Goods receipt | Dr Inventory (14xx) / Cr GR/IR (2120) |
| Invoice | Dr GR/IR (2120) / Cr 2110 (AP) ± taxes |
| B11 invoice | + Dr ITBIS prepaid / Cr 2310 (withholding) + Dr 2110 / Cr 2330 (ISR retained) |
| Payment | Dr 2110 / Cr Bank (Chapter 7) |

## 7. Common errors

- **"Duplicate NCF"** — invoice already exists for that RNC + NCF.
- **"Quantity exceeds received"** at match — capture the missing receipt
  first.
- **OCR failed** — scan quality is low; type fields manually.
- **`closed` PO cannot receive** — reopening requires admin (creating a new
  PO is usually preferable).

## 8. Related chapters

- Chapter 7 — Accounts Payable (invoice capture and payment)
- Chapter 6a — Accounting core (journals and periods)
- Chapter 9 — DGII (606 / 607 / 608, withholdings)
