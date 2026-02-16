

## Receipt OCR Scanning + Vendor Auto-Fill Rules

### What Gets Built

**1. "Escanear Recibo" (Scan Receipt) button** on the Transaction Form that sends a receipt image to Nanonets for OCR extraction and auto-fills the form fields.

**2. Vendor-to-Account Rules** table and Settings UI so vendors like "SHELL" automatically map to account 5611.

### How It Works

- Tap "Escanear Recibo" on the transaction form
- Upload a file or take a photo (reuses existing camera patterns)
- Image is sent to a backend function that calls the Nanonets pre-built receipt model
- Extracted fields auto-fill: Vendor Name, RNC, Date, Amount, ITBIS/Tax, NCF number, Payment Method
- If a vendor rule exists (e.g., SHELL = account 5611), the account code fills automatically too
- The receipt image is queued as a `payment_receipt` attachment
- Review, correct anything, save as normal
- If OCR fails or returns bad data, just fix manually -- no harm done

### Nanonets Field Mapping

The pre-built receipt model extracts standard fields. Here is how they map to your transaction form:

| Nanonets Field | Transaction Field | Notes |
|---|---|---|
| Merchant_Name | name (Nombre) | e.g., "SHELL LOS LLANOS" |
| Date | transaction_date | Parsed to date object |
| Total_Amount | amount (Monto) | e.g., 4300.00 |
| Tax_Amount | itbis (ITBIS) | e.g., 0.00 |
| Receipt_Number | document (Documento/NCF) | e.g., E310002253769 |
| Card_Tender | pay_method | Maps to "Tarjeta" if present |

The vendor's RNC will be extracted by searching the raw OCR text for the pattern "RNC: XXXXXXXXX" since the pre-built model may not have a dedicated RNC field for Dominican receipts.

---

### Technical Details

**Secrets to store:**
- `NANONETS_API_KEY` -- the API key (will be requested securely)
- `NANONETS_MODEL_ID` -- value: `04d637f0-0acd-11f1-9c16-1e3ad82e7321`

**Database migration: `vendor_account_rules` table**

```sql
CREATE TABLE public.vendor_account_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL UNIQUE,
  master_acct_code text NOT NULL,
  project_code text,
  cbs_code text,
  description_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_account_rules ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated roles that access transactions
CREATE POLICY "vendor_rules_read" ON public.vendor_account_rules
  FOR SELECT TO authenticated USING (true);

-- Write: admin, management, accountant only
CREATE POLICY "vendor_rules_write" ON public.vendor_account_rules
  FOR ALL TO authenticated USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    IN ('admin', 'management', 'accountant')
  );
```

**New Edge Function: `supabase/functions/ocr-receipt/index.ts`**
- Receives base64 image from frontend
- Sends to Nanonets API: `POST https://app.nanonets.com/api/v2/OCR/Model/{MODEL_ID}/LabelFile/`
- Uses Basic auth with the API key
- Parses the Nanonets JSON response, extracting predictions for each field label
- Searches raw OCR text for RNC pattern (Dominican-specific)
- Returns structured JSON: `{ vendor_name, rnc, date, amount, itbis, document, pay_method }`
- Follows existing auth pattern (manual JWT validation, role check)
- Added to `config.toml` with `verify_jwt = false`

**New Component: `src/components/transactions/ScanReceiptButton.tsx`**
- A button with camera icon + "Escanear Recibo" text
- On click: opens file picker (accepts image/*, .pdf)
- Shows loading spinner while OCR processes
- On success: calls `onResult` callback with extracted data
- On failure: shows toast error

**Modified: `src/components/transactions/TransactionForm.tsx`**
- Import and place `ScanReceiptButton` above the form inside the Card header area
- New `handleOcrResult()` function that maps extracted data to form fields (only fills empty fields)
- Extend `updateField('name', ...)` to also look up `vendor_account_rules` and auto-fill `master_acct_code`, `project_code`, `cbs_code` when a match is found
- Fetch vendor rules via React Query

**New Component: `src/components/settings/VendorAccountRules.tsx`**
- CRUD table for vendor-to-account mappings
- Add/Edit/Delete rules
- "Auto-detectar" button that scans transaction history for vendors with consistent account usage and suggests rules
- Admin-only access (consistent with Settings page permissions)

**Modified: `src/pages/Settings.tsx`**
- New "Reglas de Proveedor" tab (with icon) in the TabsList
- Wrapped in `canModifySettings` guard

**Modified: `src/lib/api.ts`**
- Add `fetchVendorRules()`, `createVendorRule()`, `updateVendorRule()`, `deleteVendorRule()` functions

**Modified: `supabase/config.toml`**
- Add `[functions.ocr-receipt]` with `verify_jwt = false`

### Files Summary

| Action | File |
|---|---|
| Create | `supabase/functions/ocr-receipt/index.ts` |
| Create | `src/components/transactions/ScanReceiptButton.tsx` |
| Create | `src/components/settings/VendorAccountRules.tsx` |
| Modify | `supabase/config.toml` |
| Modify | `src/components/transactions/TransactionForm.tsx` |
| Modify | `src/lib/api.ts` |
| Modify | `src/pages/Settings.tsx` |
| Migration | `vendor_account_rules` table + RLS policies |

### Risk

Zero risk to existing workflow. The scan button is purely additive. If Nanonets returns bad data or is unreachable, a toast appears and manual entry continues as before. The vendor rules feature works independently of OCR too.

