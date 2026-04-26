## Problem

The Cronograma grid wraps every cell edited by anyone *other than* `cedenojord` or the `instructor` user (hardcoded IDs in `CronogramaGrid.tsx` lines 49–50) with a solid orange ring + orange dot indicator. Iramaia is not in that allowlist, so **100% of her entries get this treatment**, making her own text appear cramped against the ring and visually obscured by the corner dot — which matches the photo exactly.

This is by design (an audit trail of "who edited what"), but the visual treatment is too aggressive for legitimate editors and degrades readability of the text they just typed.

## Proposed fix (3 small changes to `src/components/cronograma/CronogramaGrid.tsx`)

### 1. Add Iramaia (and any future "trusted editor") to the allowlist
Promote the hardcoded IDs into a list and add Iramaia's user_id so her edits don't get the orange ring at all (treated like cedenojord's edits — the schedule owner). I'll need her user_id; I can pull it from the database or you can confirm her username.

### 2. Soften the visual when the ring IS shown
Even for non-allowlisted users, improve text legibility:
- Change `ring-2 ring-inset` → `ring-1` with a small inner padding so the text isn't flush against the colored border
- Move the corner dot from `top-0 right-0` to `-top-1 -right-1` (outside the cell) so it never overlaps text
- Slightly lighten the ring color (`ring-orange-300` instead of `ring-orange-400`) so it's an indicator, not a frame

### 3. (Optional) Make the highlight respect a setting
Add a small `localStorage` toggle ("Show edit indicators") so each user can hide the orange rings on their own machine without affecting others. Useful since the indicators are mainly meaningful to the schedule owner reviewing changes — not to the person doing the editing.

## Files to edit
- `src/components/cronograma/CronogramaGrid.tsx` — allowlist + ring/dot styling (lines 48–51, 1023–1028, 1119–1162)

## What I need from you
- Confirm Iramaia should be in the "trusted editor" list (i.e. her edits should NOT be flagged) — or if her edits should still be flagged but just rendered more legibly (option 2 only).
- If yes to allowlist, I'll look up her user_id from the database (no need for you to provide it).

## Out of scope
- This is purely a styling/allowlist change. The audit trail in the database (`updated_by`, `updated_at`) is unaffected — the Audit Log will still show every edit she made.
