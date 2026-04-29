## Goal

Make all four HR letters (Contrato, Terminación, Carta al Banco, Vacaciones) look like polished, professional documents:

1. **Justified body text** — left and right margins aligned for every wrapped paragraph.
2. **Clean signature blocks** — consistent, meaningful lines (no random underscore lengths or stray dashes).
3. **Predictable spacing** — paragraph gaps follow a small, fixed set of values instead of arbitrary `y -= 30 / 50 / 60` jumps.
4. **Vertically balanced page** — content and signatures distributed so the letter doesn't pile at the top with empty space at the bottom.

All work is in `supabase/functions/generate-hr-letter/index.ts` plus a redeploy.

## Changes

### 1. Add a justified word-wrap renderer in `buildPdf`

Replace the current word-wrap branch (lines ~139–169) with one that supports `align: "justify" | "left"` per `PdfLine`:

- Wrap words into lines exactly as today, using the same width estimate.
- For every wrapped line **except the last** of a paragraph: distribute the leftover horizontal space evenly between words by inserting extra glyph spacing.
- In raw PDF this is done with the `Tw` (word-space) operator: `Tw <extraSpace> <text> Tj` then reset `Tw 0`. Compute `extraSpace = (maxWidth - estimatedWidth) / max(1, wordCount - 1)`, clamped to a sensible max (e.g. 6pt) so we don't get rivers of whitespace on short lines.
- Last line of each paragraph and any line with a single word: render left-aligned (no `Tw`).
- Default alignment for every body paragraph in the four letters becomes `"justify"`. Headings, dates, signatures, salutations stay left-aligned.

### 2. Standardize spacing constants

Introduce per-letter constants instead of ad-hoc numbers:

```
const GAP_PARA = 14;     // between paragraphs
const GAP_SECTION = 22;  // between sections (title → body, body → closing)
const GAP_SIG = 70;      // space reserved above signature block
const LINE_H = 15.4;     // current 11pt line height (unchanged)
```

Replace the scattered `y -= 20 / 25 / 30 / 40 / 50 / 60` with these. Result: rhythm becomes uniform across all letters.

Also fix the wrap-height calculation. Today it uses `Math.ceil(text.length * 11 * 0.52 / mw)` to estimate lines, which under/overshoots. Change `buildPdf` to **return** the final `y` after rendering each wrapped line (or expose it via a small helper like `pushParagraph(lines, text, y, opts) → newY`). Each generator then uses the real consumed height instead of estimating twice.

### 3. Redesign signature blocks

A single helper used by all four letters:

```
function pushSignature(lines, x, y, name, subtitle?) {
  // Solid 180pt rule, name centered under it, optional subtitle line below
  lines.push({ kind: "rule", x, y, width: 180 });
  lines.push({ text: name, x: x + (180 - estWidth(name)) / 2, y: y - 13, size: 10, bold: true });
  if (subtitle) lines.push({ text: subtitle, x: x + (180 - estWidth(subtitle)) / 2, y: y - 26, size: 9 });
}
```

- Drop the underscore strings (`"___________________________"`) and draw a real horizontal line via a new `kind: "rule"` PdfLine handled in `buildPdf` with `m … l S` PDF ops. Eliminates the ragged underscore widths between letters.
- Name is **bold** and **centered** under the rule; role/cédula is one smaller line beneath. No more three stacked left-aligned lines of varying length.
- Two-column layouts (Contrato, Terminación, Vacaciones) use `x = 80` (left) and `x = 352` (right) so both blocks are symmetric around the page center.

### 4. Per-letter layout adjustments

**Contrato (`generateHiringPdf`)**
- All `ENTRE / PRIMERO / SEGUNDO / …` clauses rendered justified.
- "SE HA CONVENIDO Y PACTADO LO SIGUIENTE:" centered using measured width instead of hardcoded `x = 160`.
- Signature row: left = company (name + RNC), right = employee (name + cédula), using `pushSignature`. Anchored at a computed `sigY` that leaves at least `GAP_SIG` below the closing paragraph but never below `marginBottom + 60`.

**Terminación (`generateTerminationPdf`)**
- Title centered via measured width (no more `titleX = 140 / 210` switch).
- Body and "prestaciones" paragraph justified.
- Signatures: employee bottom-left, manager bottom-right (currently both stacked on the left). Uses `pushSignature` for both.

**Carta al Banco (`generateBankLetterPdf`)**
- Body and request paragraph justified.
- "Sin otro particular," and "Atentamente," collapsed into the same `GAP_PARA` rhythm.
- Single centered signature block (not left-aligned).

**Vacaciones (`generateVacationPdf`)**
- Date right-aligned by measured width against the right margin (currently hardcoded `x = 380`).
- Body and closing line justified.
- Two `pushSignature` blocks at symmetric x positions; remove the duplicated underscore lines.

### 5. Vertical balance

After laying out the body, compute `remaining = currentY - (marginBottom + signatureBlockHeight)`. If `remaining > 40`, shift the signature block down by `remaining / 2` so the letter sits roughly centered between header and footer instead of crowding the top. Cap the shift so the block never crosses the bottom letterhead.

### 6. QA

After redeploying `generate-hr-letter`, regenerate the four Edy Rodriguez sample PDFs by calling the edge function the same way as last round, then `pdftoppm` each to JPEG and visually inspect:

- Justified edges flush on the right margin.
- Signature rules identical width across all letters.
- Even paragraph rhythm.
- No overlap with top/bottom letterhead images.
- Vacation date sits at the right margin; titles are visually centered.

Iterate on spacing constants until all four pass. Replace the `Edy_Rodriguez_*.pdf` artifacts in `/mnt/documents/` with `_v2` versions for side-by-side comparison.

## Out of scope

- Wording/legal content of the letters (unchanged).
- Letterhead images (unchanged).
- Switching to a real PDF library — we keep the hand-rolled builder and just extend it with `Tw` justification and a `rule` primitive.
