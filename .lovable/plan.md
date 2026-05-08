## #16 — Lightweight Purchase Order Module (Three-Way Match)

Add a minimal PO system that lets buyers commit spend before invoices arrive, then matches Receipt + Invoice + PO before allowing AP posting.

### Goals
- Capture purchase commitments (PO) with supplier, lines, expected total.
- Record goods receipts (GR) against PO lines (partial allowed).
- On AP bill creation, match against PO + GR; flag variances; block over-billing beyond tolerance.
- Keep it scoped: no RFQ, no PO revisions workflow, no budget encumbrance ledger.

### Data Model

**`purchase_orders`**
- `entity_id`, `po_number` (auto, per entity), `supplier_id`, `status` (`draft|open|partially_received|received|closed|cancelled`)
- `currency`, `order_date`, `expected_date`, `notes`
- `subtotal`, `tax_total`, `total` (generated from lines)
- `created_by`, timestamps

**`purchase_order_lines`**
- `po_id`, `line_no`, `item_id` (nullable for service), `description`, `account_id`, `cost_center_id`
- `qty_ordered`, `qty_received` (running), `qty_invoiced` (running)
- `unit_price`, `tax_rate`, `line_total`

**`goods_receipts`** + **`goods_receipt_lines`**
- Header: `entity_id`, `po_id`, `gr_number`, `received_date`, `received_by`, `notes`
- Lines: `gr_id`, `po_line_id`, `qty_received`, optional `lot/serial`

**Link to AP**
- Add `po_id` (nullable) and `gr_id` (nullable) to `ap_ar_documents`.
- Add `ap_ar_document_lines.po_line_id` (nullable) for line-level match.

### RPCs / Triggers

1. `create_purchase_order(p_entity_id, p_supplier_id, p_currency, p_lines jsonb, ...)` — inserts header + lines, computes totals, sets `open`.
2. `receive_goods(p_po_id, p_lines jsonb, p_received_date)` — inserts GR, increments `qty_received` on PO lines via trigger, advances PO status.
3. `match_invoice_to_po(p_apar_id)` — called inside `create_ap_ar_document` when `po_id` is set:
   - For each invoice line with `po_line_id`: ensure `qty_invoiced + new_qty <= qty_received * (1 + tolerance)`.
   - Price tolerance: |unit_price - po_unit_price| / po_unit_price ≤ `price_tolerance_pct` (config, default 5%).
   - On pass: increment `qty_invoiced`; on fail: raise + flag `match_status = 'variance'`.
4. `cancel_purchase_order(p_po_id)` — only if no GR/invoice consumed.

Settings row in `entity_settings`: `po_qty_tolerance_pct`, `po_price_tolerance_pct`, `po_three_way_required` (boolean — when true, AP bills with `po_id` must have a GR).

### UI

New route `/purchasing` with three tabs:
- **Purchase Orders** — list + create dialog (line grid using existing item picker, supplier picker, account picker). Detail drawer shows lines with received/invoiced progress bars.
- **Goods Receipts** — pick open PO, enter received qty per line, save.
- **Match Status** — list of AP bills linked to POs with badges: `matched`, `variance`, `awaiting_receipt`.

Update `ApArDocumentList` create dialog: optional "Link to PO" picker → auto-fills lines from PO; shows match status badge.

Sidebar: add "Compras (PO)" entry under Accounting section.

### Files

**Created**
- `supabase/migrations/<ts>_purchase_orders.sql` — tables, RLS, triggers, RPCs.
- `src/pages/Purchasing.tsx`
- `src/components/purchasing/PurchaseOrderList.tsx`
- `src/components/purchasing/PurchaseOrderDialog.tsx`
- `src/components/purchasing/PurchaseOrderDetail.tsx`
- `src/components/purchasing/GoodsReceiptList.tsx`
- `src/components/purchasing/GoodsReceiptDialog.tsx`
- `src/components/purchasing/MatchStatusList.tsx`
- `src/lib/purchaseOrders.ts` (typed client helpers + PDF print)

**Modified**
- `src/components/accounting/ApArDocumentList.tsx` — PO picker + match badge.
- `src/App.tsx` — route.
- `src/components/layout/AppSidebar.tsx` — nav entry.
- `src/components/settings/*` — tolerances + `po_three_way_required` toggle.
- `.lovable/plan.md` — mark #16 ✅.

### Out of Scope (deferred)
- PO approval workflow (reuse existing `approval_policies` later by adding `purchase_order` resource type).
- PO revisions/versioning history.
- Budget encumbrance posting (commit GL entries on PO).
- Blanket POs and release schedules.
- Vendor portal / RFQ.

### Acceptance
- Create PO → receive partial → create AP bill linked to PO → match passes within tolerance.
- Over-receiving beyond tolerance is blocked.
- Over-billing (qty_invoiced > qty_received) is blocked when three-way required.
- PO status auto-advances to `partially_received` / `received` / `closed`.
