

## Plan: Improve OCR Annotation Detection

### Problem
The AI model is not reliably detecting the payment method (upper-left) and account number (upper-right) annotations on scanned invoices. These can be either handwritten or typed/stamped.

### Root Causes
1. **Model choice**: `gemini-2.5-flash` is weaker at fine-grained image reading vs `gemini-2.5-pro`
2. **Prompt wording**: Current prompt says "handwritten" only — doesn't account for typed/stamped annotations
3. **Insufficient emphasis**: The annotation instructions are buried in a long rules list

### Changes (single file: `supabase/functions/ocr-receipt/index.ts`)

1. **Upgrade model** from `google/gemini-2.5-flash` to `google/gemini-2.5-pro` for stronger vision/OCR capability

2. **Rewrite the system prompt** to:
   - Separate annotation detection into a **priority section** at the top of the rules
   - Explicitly state annotations can be **handwritten (pen), typed, or rubber-stamped**
   - Add concrete visual examples: "you may see 'CC IND', 'CC AGRI', 'CC MGT', 'industria', 'agri', 'management' in various handwriting styles"
   - Expand the account code description: "a 4-digit number like 5611, 7010, 7690, 5210, often circled or underlined"
   - Instruct the model to **scan the four corners of the image first** before reading the main receipt content
   - Add fallback mapping: partial matches like "ind" → `cc_industry`, "agr" → `cc_agri`, "mgt"/"mgmt" → `cc_management`

3. **Enhance the user message** to explicitly call out: "Pay special attention to any annotations in the upper-left and upper-right corners of the image — these contain the payment method and account code respectively."

### Technical Details

The edge function prompt will be restructured as:

```
STEP 1 — ANNOTATIONS (do this FIRST):
Scan all four corners and margins for pen/typed/stamped notes.
- UPPER-LEFT: payment method identifier (handwritten or typed)
  Maps: "cc industria"/"cc ind"/"ind" → cc_industry, 
        "cc agri"/"agr" → cc_agri,
        "cc management"/"cc mgt"/"mgmt" → cc_management,
        "efectivo"/"cash" → cash,
        "transferencia" → bank_transfer
- UPPER-RIGHT: 4-digit account code (e.g. 5611, 7010, 7690)
  Often circled, underlined, or written larger than surrounding text.

STEP 2 — RECEIPT DATA:
Extract printed receipt fields (vendor, RNC, date, amount, etc.)
```

No database changes. No frontend changes.

