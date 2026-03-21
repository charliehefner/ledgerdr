## Plan: Contextual Help Panel with Bilingual Markdown Chapters

### Overview

Add a `?` help icon next to page headings that opens a slide-out panel showing the relevant user manual chapter. Chapters are stored as markdown files in `public/help/{lang}/`, editable via the code editor, and added incrementally over time.

### File Structure

```text
public/help/
  en/
    14-operations.md      ← first chapter
  es/
    14-operations.md      ← first chapter
```

Chapters are added over time — the help button only appears on pages that have a corresponding file. Missing files show a "chapter coming soon" message.

### Implementation

**Step 1 — Install `react-markdown`** dependency for rendering markdown in the panel.

**Step 2 — Create `src/components/layout/HelpPanelButton.tsx`**

- Small `HelpCircle` icon button
- On click, fetches `/help/${language}/${chapter}.md` using the current language from `LanguageContext`
- Opens a `Sheet` (right slide-out) displaying rendered markdown with Tailwind prose styling
- Handles missing files gracefully with a "coming soon" fallback
- Includes a download link for the raw `.md` file

**Step 3 — Add `helpChapter` prop to `TabbedPageLayout.tsx`**

- Optional `helpChapter?: string` prop
- When provided, renders `HelpPanelButton` next to the title in the header

**Step 4 — Wire into pages** — Add the `helpChapter` prop to each page component. Pages without a chapter file yet simply won't show the button (component checks file existence). Initial wiring for all pages with only Operations having actual content:

| Page | `helpChapter` value |
|------|-------------------|
| Operations | `14-operations` |
| Transactions | `04-transactions` |
| Accounting | `06-accounting` |
| All others | Mapped but file added later |

**Step 5 — Create initial chapter files** — Create placeholder `public/help/en/14-operations.md` and `public/help/es/14-operations.md` with basic structure you can then edit with your Word content.

### Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `react-markdown` |
| `src/components/layout/HelpPanelButton.tsx` | New — help icon + sheet panel |
| `src/components/layout/TabbedPageLayout.tsx` | Add `helpChapter` prop, render help button |
| `src/pages/Transactions.tsx` | Add help button to header |
| `src/pages/Operations.tsx` | Pass `helpChapter="14-operations"` |
| `src/pages/Accounting.tsx` | Pass `helpChapter="06-accounting"` |
| ~12 other page files | Pass appropriate `helpChapter` values |
| `public/help/en/14-operations.md` | New — placeholder chapter |
| `public/help/es/14-operations.md` | New — placeholder chapter |
| `src/i18n/en.ts` | Add help panel strings |
| `src/i18n/es.ts` | Add help panel strings |

## Plan: Audit and Fix All Vulnerable Select Components — ✅ COMPLETED

### Summary of Changes

**Prevention layer added:**
- `src/components/ui/select.tsx` — Dev-time console warning when `SelectItem` receives `value=""`

**Pick-and-trigger selects fixed (`value=""` → `value={undefined}`):**
- `src/components/herbicide/FieldSelectionSection.tsx`
- `src/components/herbicide/ProductSelectionSection.tsx`

**Nullable form selects fixed (`value={x}` → `value={x || undefined}`):**
- `src/components/transactions/TransactionForm.tsx` — 8 selects (master_acct_code, project_code, cbs_code, dgii_tipo_ingreso, dgii_tipo_bienes_servicios, pay_method, transfer_from_account, transfer_to_account)
- `src/components/accounting/JournalEntryForm.tsx` — journal line account_id
- `src/components/accounting/BankAccountsList.tsx` — chart_account_id
- `src/components/accounting/PaymentDialog.tsx` — bankAccountId
- `src/components/hr/ServicesView.tsx` — provider_id, master_acct_code, pay_method

**Already safe (no changes needed):**
- Files using native `<select>` with `<option value="">` (DayLaborView, OperationsLogView, ContractedServicesView, RecurringEntriesView)
- Files where Select always has non-empty default values (currency selectors, filter selects with "all" defaults)
- `EditTransactionDialog.tsx` — previously fixed with `__none__` sentinel
