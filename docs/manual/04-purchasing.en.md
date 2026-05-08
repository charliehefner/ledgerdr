# Chapter 4 — Purchasing

## 1. Purpose

The Purchasing module handles every step of how goods enter the company and how those goods become money owed to suppliers. It carries a transaction from the moment you place a purchase order (PO), through the physical arrival of goods at the warehouse, to the supplier's invoice and its eventual link with Accounts Payable. Along the way the system enforces Dominican Republic tax rules — in particular NCF validation and the B11 informal-supplier withholding regime — and it integrates OCR on scanned invoice attachments so capture is faster and more accurate.

In short, Purchasing is where you commit the company to a future expense, confirm what was actually delivered, and reconcile that reality with what the supplier eventually bills you.

## 2. Roles and permissions

Access to Purchasing is governed by role. The table below shows what each role may do; "read" means the user can view the data but not change it, and "—" means the action is not available.

| Action | Admin | Management | Accountant | Supervisor | Others |
|---|---|---|---|---|---|
| View POs | ✓ | ✓ | ✓ | ✓ | read |
| Create PO | ✓ | ✓ | ✓ | ✓ | — |
| Receive goods | ✓ | ✓ | ✓ | ✓ | — |
| Capture invoice | ✓ | ✓ | ✓ | — | — |
| Validate PO ↔ invoice match | ✓ | — | ✓ | — | — |

Note that only Admin and Accountant can validate the match between PO, receipt, and invoice — this is by design, since matching is the control point that releases an invoice for payment.

## 3. Screen tour

The Purchasing page is organized into three tabs, each one tied to a stage of the workflow.

- **Purchase Orders** — the master list. From here you can search, filter, open a PO to see its lines, or start a new one.
- **Goods Receipts** — a record of what physically arrived and when, always tied back to the originating PO.
- **Invoices pending match** — invoices that Accounts Payable has captured but whose match against the PO and the goods receipt is still pending.

> [SCREENSHOT: Purchasing → PO table with status badges]

A PO progresses through one of five statuses: `open`, `partially_received`, `received`, `closed`, `cancelled`. The status is set automatically by the system based on receipts and invoices — you do not change it manually.

## 4. Step-by-step workflows

This section walks through the core actions a typical user will perform: creating a PO, receiving goods, capturing the supplier invoice, and validating the match.

### 4.1 Create a PO

1. Go to Purchasing → **New PO**.
2. Capture the supplier (the field auto-completes from Contacts), date, currency, and any notes.
3. Add one line per item, specifying quantity, unit price, and the target account.
4. Click **Create**. The RPC `create_purchase_order` generates the PO in `open` status and assigns the next `po_number`.

> [SCREENSHOT: New PO form with line-item editor]

### 4.2 Receive goods

1. Purchasing → **Receipts** → **New receipt**.
2. Choose the PO. Only POs in `open` or `partially_received` status appear in the picker.
3. For each line, capture the quantity received. The amount must be less than or equal to the quantity still pending on that line.
4. Add notes and the receipt date.
5. Click **Receive**. The RPC `receive_goods` updates `qty_received` on each line, adjusts inventory stock, and advances the PO status accordingly.

> [SCREENSHOT: Goods receipt form showing pending vs received quantities]

### 4.3 Capture the supplier invoice

Supplier invoices are not captured directly inside Purchasing. They enter the system from **Accounts Payable** (Chapter 7), where the user records the NCF, the invoice date, the amount, and the link back to the PO. When the scanned invoice is attached, the OCR engine (Gemini 2.5 Pro) reads the document and suggests the amount, NCF, and date for the user to confirm.

#### NCF / B11 rules

NCF handling is one of the more rule-heavy parts of Purchasing, because it ties directly to DGII compliance.

- Accepted NCF types are validated against DGII: B01, B02, B11, B14, B15.
- **B11 — Informal-supplier voucher**: when the invoice is a B11, the system automatically applies:
  - **100 % ITBIS withholding**: Dr ITBIS prepaid / Cr 2310 ITBIS payable.
  - **ISR withholding** at the rate corresponding to the service.
  The supplier receives the net amount after these withholdings.
- Duplicates are blocked at capture: the system will not allow a second invoice with the same RNC + NCF combination inside the same period.

### 4.4 Validate PO ↔ invoice match

1. Go to Purchasing → **Invoices pending match** and open the invoice row.
2. Click **Validate match**. The RPC `validate_po_invoice_match` checks three things:
   - Invoiced quantity is less than or equal to received quantity.
   - Invoice total equals the sum of its lines (within the configured tolerance).
   - Currency and supplier match the PO.
3. If the checks pass, the invoice status moves to `matched` and the invoice is released for payment.

> [SCREENSHOT: Pending-match queue with one invoice selected]

## 5. Business rules and validations

A handful of rules apply across the entire Purchasing flow. Knowing them in advance avoids common surprises at month-end.

- **You cannot invoice more than was received** on a given line.
- **A closed period** blocks both receipts and invoices dated within that period.
- **Attachments**: every PO, receipt, and invoice can carry multiple files in `transaction_attachments`, stored under the standard path `entity/{entity_id}/po/{po_id}/...`.
- **Multi-currency**: POs and invoices can be issued in currencies other than DOP. The exchange rate on the invoice — not the PO — defines the booked amount.
- **Editing**: once a PO has receipts, the lines that have already been received cannot be modified. Untouched lines remain editable.

## 6. Accounting impact

The PO itself is a planning document and does **not** post any journal entry. Accounting movements are generated only when something physical happens to inventory or money:

| Event | Journal |
|---|---|
| Goods receipt | Dr Inventory (14xx) / Cr GR/IR (2120) |
| Invoice | Dr GR/IR (2120) / Cr 2110 (AP) ± taxes |
| B11 invoice | + Dr ITBIS prepaid / Cr 2310 (withholding) + Dr 2110 / Cr 2330 (ISR retained) |
| Payment | Dr 2110 / Cr Bank (Chapter 7) |

The GR/IR account (2120, "Goods Received / Invoice Received") is the bridge between physical receipts and invoiced amounts. A balance there at month-end signals that the company has received goods that have not yet been invoiced, or invoiced amounts that have not yet been received — a useful diagnostic when reviewing AP at close.

## 7. Common errors

The errors below come up most often in day-to-day work. Each one points to a specific cause and a clear next step.

- **"Duplicate NCF"** — an invoice already exists in the system for that RNC + NCF combination. Search AP before re-capturing.
- **"Quantity exceeds received"** at the match step — capture the missing goods receipt first, then retry the match.
- **OCR failed** — the scan quality was too low for the model to read reliably. Type the fields manually.
- **A `closed` PO cannot receive** — reopening a closed PO requires Admin; in most cases creating a new PO is the cleaner path.

## 8. Related chapters

- Chapter 7 — Accounts Payable (invoice capture and payment)
- Chapter 6a — Accounting core (journals and periods)
- Chapter 9 — DGII (606 / 607 / 608, withholdings)

## Glossary

- **PO (Purchase Order)** — A document committing the company to buy specific goods or services from a supplier at agreed terms. Does not generate accounting entries on its own.
- **Goods receipt** — The internal record confirming that a PO's items have physically arrived. Triggers the inventory journal entry.
- **Three-way match** — The control that compares PO, goods receipt, and supplier invoice before authorizing payment.
- **NCF (Número de Comprobante Fiscal)** — DGII-issued tax voucher number that authorizes a supplier's invoice. Each type (B01, B02, B11, B14, B15) has its own tax treatment.
- **B11** — NCF type for invoices issued to informal suppliers. Triggers automatic 100 % ITBIS withholding plus ISR withholding at the applicable rate.
- **ITBIS** — Dominican Republic value-added tax (Impuesto sobre Transferencias de Bienes Industrializados y Servicios).
- **ISR** — Dominican Republic income tax (Impuesto sobre la Renta).
- **RNC** — Dominican taxpayer identification number (Registro Nacional del Contribuyente).
- **GR/IR (account 2120)** — Goods Received / Invoice Received clearing account; bridges physical receipt and invoiced amount.
- **AP (Accounts Payable)** — The 2110 liability account where supplier invoices accumulate until paid.
- **RPC** — A backend function called by the application (for example `create_purchase_order`, `receive_goods`, `validate_po_invoice_match`).
- **DGII** — Dominican Republic tax authority (Dirección General de Impuestos Internos).
