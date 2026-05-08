
# User Manual — Production Plan

## Approach: Hybrid

I produce factually-grounded Markdown chapters using full access to your code, RPCs, RLS, i18n, and the memory index. You take the Markdown into Claude Desktop / Claude Code for tone polish, screenshots, and PDF conversion. Final PDFs drop into `public/help/{es,en}/<chapter>.pdf` where the existing `HelpPanelButton` already serves them in-app.

This avoids the main risk of letting Claude Desktop write from scratch: it would invent plausible-but-wrong business rules for double-entry posting, B11 withholding, FX revaluation, Casa Matriz interest accrual, period locking, etc. I have the actual logic — Claude Desktop does not.

## Phase 1 — Priority chapters (this loop)

Order: **Treasury → Casa Matriz / CIP → Purchasing → FX**

Each chapter follows a fixed structure so Claude Desktop can apply consistent formatting later:

```text
1. Purpose & when to use it
2. Roles & permissions (which of the 6 roles can do what)
3. Screen tour (tabs, key buttons, dialogs)
4. Step-by-step workflows (numbered, with field-level notes)
5. Business rules & validations (pulled from RPCs/triggers)
6. Accounting impact (which accounts, which journal source type)
7. Common errors & troubleshooting
8. Related chapters
```

### Chapter list for Phase 1

| File | Chapter code | Covers |
|---|---|---|
| `docs/manual/05-treasury.md` | `05-treasury` | Bank accounts, credit cards, petty cash, internal transfers, CC payments, supplier advances (1690), bank reconciliation |
| `docs/manual/06b-casa-matriz.md` | `06-accounting` (sub) | Home Office parties, advances (per-rate, per-basis), repayments, monthly interest accrual cron, capitalize-to-principal, FX revaluation of HO balances, statement export, drilldown |
| `docs/manual/06c-cip.md` | `06-accounting` (sub) | CIP projects: create, accumulate costs, capitalize to fixed asset, drilldown to capitalization journal |
| `docs/manual/04-purchasing.md` | `04-purchasing` | Purchase orders lifecycle, NCF rules, B11 informal-provider auto-withholding (100% ITBIS + ISR), receipt vs invoice, attachments, AP linkage |
| `docs/manual/06d-fx.md` | `06-accounting` (sub) | Two FX features: (a) BCRD daily exchange rate scrape + table, (b) period-end **Reevaluar FX** for open AP/AR + Casa Matriz; difference between the two, when to run, journal effects |

Sub-chapters for Casa Matriz / CIP / FX share the `06-accounting` PDF slot — they will be concatenated into `06-accounting.pdf` so the in-app help still resolves. I will note section anchors so Claude Desktop can build a TOC.

### Bilingual handling

Spanish first (your default language), English in parallel inside the same Markdown file using `## ES` / `## EN` sections per chapter, OR sibling files `*.es.md` / `*.en.md`. Default: **sibling files** — easier for PDF generation per language folder.

## Phase 2 — Remaining accounting-area chapters (next loop after approval)

- `06a-accounting-core.md` — Chart of accounts, cost centers/dimensions, journal entry, posting, period locking, recurring entries, audit log
- `07-apar.md` — Receivables & Payables, aging, supplier advances allocation
- `08-fixed-assets.md` — Asset registry, depreciation generation, drilldown ledger
- `09-dgii.md` — 606/607/608 reports, RNC validation, e-CF strategy
- `10-budget.md` — Budget grid, sub-lines, variance reporting
- `11-intercompany.md` — Auto Due To / Due From journals (1570/2470)

## Phase 3 — Operational chapters (later, lower priority per your direction)

HR/Payroll, Operations, Inventory, Fuel, Equipment, Industrial, Cronograma, Alerts, Admin/Settings.

## Deliverables of Phase 1 (what I will create now)

Eight Markdown files (4 chapters × 2 languages) in a new `docs/manual/` folder:

```text
docs/manual/05-treasury.es.md
docs/manual/05-treasury.en.md
docs/manual/06b-casa-matriz.es.md
docs/manual/06b-casa-matriz.en.md
docs/manual/06c-cip.es.md
docs/manual/06c-cip.en.md
docs/manual/04-purchasing.es.md
docs/manual/04-purchasing.en.md
docs/manual/06d-fx.es.md
docs/manual/06d-fx.en.md
```

Plus one `docs/manual/README.md` index explaining:
- Chapter ↔ helpChapter code mapping
- How to convert each `.md` to PDF and where to drop it (`public/help/{lang}/<code>.pdf`)
- A suggested Claude Desktop prompt for polishing & PDF generation (so you can paste it directly)

## What I need from you to start

Nothing further — you've already prioritized. After plan approval I will:

1. Re-read each relevant view (`TreasuryView`, `CasaMatrizView`, `CipProjectsView`, `Purchasing` page, `FxRevaluationButton`) and the underlying RPCs (`post_home_office_*`, `revalue_open_*`, `capitalize_*`, NCF/B11 logic).
2. Cross-check against the corresponding memory entries so business rules in the manual match what's actually enforced in the database.
3. Write the 10 Markdown files plus the index.

## Out of scope for this plan

- Generating PDFs myself (Claude Desktop / your formatting pass does this — keeps me focused on accuracy over typography)
- Screenshots (you add these during polish; I'll mark `> [SCREENSHOT: …]` placeholders)
- Editing any application code

