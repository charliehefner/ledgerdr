## Problem

The "Failed to send request to Edge function" error when generating Edy Rodriguez's termination letter (and any other letter type — termination, contract, bank, vacation) is caused by the `generate-hr-letter` edge function failing to boot.

### Root cause (confirmed via edge logs)

```
event loop error: NotFound: path not found:
/var/tmp/sb-compile-edge-runtime/generate-hr-letter/assets/top.jpg
at file:///.../generate-hr-letter/index.ts:128:41
```

The function does this at module init (lines 103–104):

```ts
const LETTERHEAD_TOP_BYTES = await Deno.readFile(new URL("./assets/top.jpg", import.meta.url));
const LETTERHEAD_BOTTOM_BYTES = await Deno.readFile(new URL("./assets/bottom.jpg", import.meta.url));
```

Supabase Edge Runtime does **not** bundle sibling binary assets (`.jpg`, `.png`, etc.) when deploying. Only `.ts`/`.js` source is shipped. So `Deno.readFile` fails on every cold start → function never boots → client gets the generic "Failed to send request" error.

This affects **all four letter types** (termination, contract, bank, vacation), since they all go through the same function.

## Fix

Embed the letterhead images directly into the source as base64 constants so they ship with the bundled `.ts` file — no filesystem reads needed.

### Steps

1. **Convert** the two existing assets to base64:
   - `supabase/functions/generate-hr-letter/assets/top.jpg` → base64 string
   - `supabase/functions/generate-hr-letter/assets/bottom.jpg` → base64 string

2. **Create** `supabase/functions/generate-hr-letter/letterhead-assets.ts` exporting:
   ```ts
   export const LETTERHEAD_TOP_B64 = "...";
   export const LETTERHEAD_BOTTOM_B64 = "...";
   ```
   Keeping it in a separate file keeps `index.ts` readable (the strings will be ~60 KB combined).

3. **Update** `supabase/functions/generate-hr-letter/index.ts` (lines 101–108):
   - Remove the `Deno.readFile` calls.
   - Import the base64 constants.
   - Decode them once at module init:
     ```ts
     import { LETTERHEAD_TOP_B64, LETTERHEAD_BOTTOM_B64 } from "./letterhead-assets.ts";
     const LETTERHEAD_TOP_BYTES = Uint8Array.from(atob(LETTERHEAD_TOP_B64), c => c.charCodeAt(0));
     const LETTERHEAD_BOTTOM_BYTES = Uint8Array.from(atob(LETTERHEAD_BOTTOM_B64), c => c.charCodeAt(0));
     ```

4. **Deploy** the function and retry termination letter for Edy Rodriguez to confirm.

5. **Memory update**: Append a note to `mem://features/hr-module/letterhead-formatting` documenting that letterhead images must be embedded as base64 in source, not loaded from disk, because Edge Runtime does not bundle binary assets.

### Files changed
- `supabase/functions/generate-hr-letter/letterhead-assets.ts` (new)
- `supabase/functions/generate-hr-letter/index.ts` (lines 101–108)
- `mem://features/hr-module/letterhead-formatting` (note added)

### Out of scope
The local `assets/` folder can stay as the source-of-truth originals; we just won't load them at runtime. If the letterhead images ever change, regenerate the base64 file from the new images.
