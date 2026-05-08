# LedgerDr — User Manual (Phase 1)

This folder contains factually-grounded Markdown drafts of the user manual. Each
chapter was written from the actual application source (RPCs, triggers, RLS,
React views) so the business rules in the text match what the database
enforces.

## How to use these drafts

1. **Polish in Claude Desktop / Claude Code** — paste a chapter into Claude with
   the prompt below. Ask it to add tone, examples, and screenshots.
2. **Add screenshots** where you see `> [SCREENSHOT: ...]` placeholders.
3. **Convert to PDF** (any tool — `pandoc`, `md-to-pdf`, Word "Save as PDF",
   Google Docs, etc.).
4. **Drop the PDF** into `public/help/{lang}/<chapter-code>.pdf`. The in-app
   `HelpPanelButton` will pick it up automatically.

## Chapter ↔ helpChapter code mapping

| File | helpChapter code | App location |
|---|---|---|
| `04-purchasing.{es,en}.md` | `04-purchasing` | Purchasing page |
| `05-treasury.{es,en}.md` | `05-treasury` | Treasury page |
| `06b-casa-matriz.{es,en}.md` | `06-accounting` (section) | Accounting → Casa Matriz tab |
| `06c-cip.{es,en}.md` | `06-accounting` (section) | Accounting → CIP tab |
| `06d-fx.{es,en}.md` | `06-accounting` (section) | Accounting toolbar (Reevaluar FX) |

The three `06-*` sub-chapters are meant to be **concatenated** into a single
`06-accounting.pdf` so the existing help binding still resolves. Suggested
TOC order inside that PDF:

```text
1. Casa Matriz / Home Office
2. Construction in Progress (CIP)
3. FX — Daily rates and period-end revaluation
```

## Suggested Claude Desktop polish prompt

> You are editing a section of an internal accounting application user manual
> for a Dominican Republic agricultural company. The audience is the office
> manager and accountant — non-technical but financially literate. Spanish is
> the primary working language.
>
> Keep every business rule, account number, formula, and account-code reference
> exactly as written. Do not invent rules. You may:
>
> - Improve flow, headings, and tone.
> - Expand short bullets into clearer sentences.
> - Add a one-paragraph intro per section.
> - Suggest where a screenshot would help (mark `> [SCREENSHOT: ...]`).
> - Add a glossary box at the end of each chapter.
>
> Do NOT change: account numbers, RPC names, role names, percentages,
> day-count conventions, NCF rules, or the order of steps in a workflow.
>
> Output a single, clean Markdown chapter ready for PDF conversion.

## Phase 1 chapters (this delivery)

- Treasury (05)
- Casa Matriz / Home Office (06 sub)
- CIP — Construction in Progress (06 sub)
- Purchasing (04)
- FX — daily rates and period-end revaluation (06 sub)

## Phase 2 (next, accounting-area)

Accounting core, AP/AR, Fixed Assets, DGII reporting, Budget, Intercompany.

## Phase 3 (later, operational)

HR/Payroll, Operations, Inventory, Fuel, Equipment, Industrial, Cronograma,
Alerts, Admin/Settings.
