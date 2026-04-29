## Goal

Apply both letter-rendering fixes:

1. **True right-edge justification** — replace the character-width heuristic (`0.52 × size`) with real Adobe Core14 Helvetica WinAnsi metrics so wrapping and `Tw` (word-space) calculations are pixel-accurate.
2. **Anti-orphan signature pagination** — when the only items spilling onto a new page are the signature group, retry the layout with tighter gaps so the sig lands on the previous page. If even tightened layout overflows, fall back to the current behavior.

## Changes

### 1. Real Helvetica metrics

- Add `supabase/functions/generate-hr-letter/helvetica-widths.ts` exporting `HELV_W` and `HELV_BOLD_W` — two 256-entry arrays of 1/1000-em widths, one per font, indexed by WinAnsi byte. Values come from the published Adobe Core14 AFM tables (already extracted and verified locally — space=278, A=667, W=944, i=222, ñ=556).
- Replace `estTextWidth` in `index.ts`:
  ```ts
  function estTextWidth(text, size, bold) {
    const W = bold ? HELV_BOLD_W : HELV_W;
    let w = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const byte = cp < 0x80 ? cp : (UNI_TO_WINANSI[cp] ?? 0x20);
      w += W[byte] || W[0x20];
    }
    return (w * size) / 1000;
  }
  ```
- Add `UNI_TO_WINANSI` mapping for the same characters `escapePdf` already handles (á é í ó ú ñ ü ÁÉÍÓÚÑ, en-dash → hyphen).
- Effect: every wrapped line's measured width matches what Helvetica actually draws, so the `Tw` slack distributed across word gaps lines up the right edge to within a fraction of a point.

### 2. Anti-orphan retry

- Convert the spacing constants `GAP_PARA / GAP_SECTION / GAP_SIG_TOP` into mutable module variables seeded from a `DEFAULT_GAPS` object. Add a `setGaps(mode: "default" | "compact")` helper:
  - `default`: 12 / 22 / 50 (current values).
  - `compact`: 8 / 14 / 30.
- Wrap each generator's body with a `renderWithRetry(generator)` helper:
  1. Run the generator with default gaps → run pagination.
  2. If `totalPages > 1` AND every item on the last page has `groupId === "sig"` → reset items, switch to compact gaps, re-run the generator, re-paginate.
  3. If the compact pass fits on one page (or one fewer page than the default), keep it; otherwise revert to the default render.
  4. Always restore default gaps before returning.
- Cleanest implementation: factor each `generateXxxPdf` into a `layoutXxx(): PdfItem[]` function. `renderWithRetry` calls `layoutXxx` once, inspects, optionally calls again with compact gaps, then calls `buildPdf` on the chosen items.

### 3. QA

- Regenerate the four Edy Rodriguez letters as `_v3` PDFs in `/mnt/documents/`.
- Rasterize each page, visually verify:
  - Right edges of every justified line sit flush at the 540pt mark (page width 612 − right margin 72).
  - Contrato signature now appears on page 1 (compact retry succeeded), or remains on page 2 if even compact overflows.
  - Other three letters unchanged in appearance.
- Redeploy `generate-hr-letter`.

## Out of scope

- Letter wording.
- Letterhead images.
- Switching to a real PDF library.
