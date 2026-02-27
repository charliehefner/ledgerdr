

## Plan: Enhance OCR to Recognize Handwritten Account & Credit Card Notes

### What changes
Two modifications to the edge function `supabase/functions/ocr-receipt/index.ts`:

1. **Update the AI prompt** to instruct the model to look for handwritten notes:
   - **Top-left corner**: Credit card identifier — map "cc industria" → `cc_industry`, "cc agri" → `cc_agri`, "cc management" → `cc_management`
   - **Upper-right quadrant**: Account code (4-digit number like 5611, 7010, etc.)

2. **Add a new `master_acct_code` field** to the OCR response JSON schema, so the AI extracts the handwritten account code.

3. **Update the `OcrResult` interface** in `ScanReceiptButton.tsx` to include `master_acct_code`.

4. **Update `handleOcrResult`** in `TransactionForm.tsx` to apply the extracted account code (only if the field is currently empty, same as other fields).

### Prompt changes (edge function)

Add to the system prompt:
- Instruction to look for handwritten text in the top-left for credit card (mapping to exact values: `cc_management`, `cc_agri`, `cc_industry`) and upper-right for a 4-digit account code
- Add `"master_acct_code"` field to the expected JSON output
- Clarify that handwritten notes should not be confused with printed receipt data

### Frontend changes

- `ScanReceiptButton.tsx`: Add `master_acct_code?: string` to `OcrResult`
- `TransactionForm.tsx` `handleOcrResult`: Add `if (result.master_acct_code && !prev.master_acct_code) updated.master_acct_code = result.master_acct_code;`

### Files modified
- `supabase/functions/ocr-receipt/index.ts` — prompt enhancement + new field in response
- `src/components/transactions/ScanReceiptButton.tsx` — interface update
- `src/components/transactions/TransactionForm.tsx` — apply new OCR field

