

## Place Chapter 1 (Introduction) Help PDFs

### Assessment
Chapter 1 covers the **system overview, module map, and key concepts** — it's a general introduction, not tied to any specific module. The best home for it is the **Dashboard** page, which is the first thing users see after login and serves as the system's front door.

### Current State
- The Dashboard page uses `MainLayout` directly (not `TabbedPageLayout`), so it doesn't have a `helpChapter` prop today.
- Existing help PDFs live in `public/help/en/` and `public/help/es/`.

### Steps

1. **Copy PDFs** into the help directory:
   - `public/help/en/01-introduction.pdf` ← from `ch1_introduction.pdf`
   - `public/help/es/01-introduction.pdf` ← from `cap1_introduccion.pdf`

2. **Add the HelpPanelButton to Dashboard**: Import `HelpPanelButton` in `src/pages/Dashboard.tsx` and place it next to the Dashboard title heading, using `chapter="01-introduction"` — matching the pattern used on all other pages.

| File | Change |
|------|--------|
| `public/help/en/01-introduction.pdf` | New file (copy from upload) |
| `public/help/es/01-introduction.pdf` | New file (copy from upload) |
| `src/pages/Dashboard.tsx` | Add `HelpPanelButton` next to title |

