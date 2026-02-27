

## Problem

The toolbar has two filter groups side by side, each starting with a "Todos" button — one for status (Todos / Borradores / Publicados) and one for type (Todos / GJ / PJ / ...). This is confusing and redundant.

## Solution

Clean up the toolbar by:

1. **Replace the status "Todos" with a label** — Add a small label "Estado:" before the status buttons and remove the "Todos" option; instead use an explicit reset (clicking the active button deselects it back to "all").
2. **Replace the type "Todos" with a label** — Add "Tipo:" label before the type buttons, same deselect-to-reset pattern.
3. **Use a `Select` dropdown for the type filter** instead of many small buttons — the 8+ type buttons take up a lot of space and will grow. A compact `<Select>` with options is cleaner.
4. **Move the key to the Fragment** — Fix the React key warning (currently `key` is on `<TableRow>` inside a Fragment instead of the Fragment itself).

### Changes — single file: `src/components/accounting/JournalView.tsx`

- **Status filter**: Keep as 3 toggle buttons but rename "Todos" → label "Estado:" placed before the group. The buttons become just "Borradores" / "Publicados" / "Todos" but with "Todos" visually distinct or replaced with a reset icon.
  - Simplest: just add "Estado:" label before status buttons, and "Tipo:" label before type buttons. This makes the two "Todos" contextually clear.
- **Type filter**: Replace the row of 8 buttons with a `<Select>` dropdown: "Todos los tipos", GJ, PJ, SJ, PRJ, DEP, RJ, CLJ.
- **Fragment key fix**: Change `<>` to `<React.Fragment key={j.id}>` and remove key from the inner TableRow.

