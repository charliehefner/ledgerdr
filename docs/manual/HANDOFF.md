# LedgerDr Manual — Handoff Notes

Pick up here when you switch to the MX Linux machine.

## Repo

- GitHub: https://github.com/charliehefner/ledgerdr
- Manual source: `docs/manual/` (Markdown, English + Spanish per chapter)
- Final delivery target: `public/help/{lang}/<chapter-code>.pdf` (the in-app `HelpPanelButton` reads from there)

## What's been done in this session

Polished all 5 Phase 1 chapters in both languages using the polish prompt from `docs/manual/README.md`. The polished `.md` files are in this working folder — download them all and drop them into `docs/manual/`, replacing the originals:

- 04-purchasing.en.md / 04-purchasing.es.md
- 05-treasury.en.md / 05-treasury.es.md
- 06b-casa-matriz.en.md / 06b-casa-matriz.es.md
- 06c-cip.en.md / 06c-cip.es.md
- 06d-fx.en.md / 06d-fx.es.md

Polish treatment applied to every chapter:
- Added a one-paragraph intro to each section
- Expanded short bullets into clearer sentences
- Added screenshot placeholders where helpful (`> [SCREENSHOT: ...]`)
- Added a glossary at the end of each chapter
- Preserved exactly: account numbers, NCF rules, RPC names, role names, percentages, day-count conventions, step ordering

## Next steps (in priority order)

1. **Get the polished files into the repo.** Download the 10 `.md` files from this working folder and replace the originals in `docs/manual/` on the Linux machine, then commit + push.
2. **Add real screenshots** where the `> [SCREENSHOT: ...]` placeholders are.
3. **Convert each chapter to PDF.** Suggested: `pandoc 04-purchasing.es.md -o 04-purchasing.pdf` (install with `sudo apt install pandoc texlive-xetex`). The three `06-*` sub-chapters should be concatenated into a single `06-accounting.pdf` so the existing help binding still resolves; suggested order: Casa Matriz → CIP → FX.
4. **Drop the PDFs** into `public/help/{lang}/<chapter-code>.pdf`.
5. **Phase 2 chapters** (next batch when ready): Accounting core, AP/AR, Fixed Assets, DGII reporting, Budget, Intercompany.

## MX Linux one-time setup

```bash
sudo apt update
sudo apt install git gh
git config --global user.name "Charlie Hefner"
git config --global user.email "charliehefner@gmail.com"
gh auth login   # GitHub.com → HTTPS → web browser
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/charliehefner/ledgerdr.git
cd ledgerdr
```

Useful extras for this project:

```bash
sudo apt install pandoc texlive-xetex   # Markdown → PDF
sudo apt install code                   # VS Code, optional
```

## Daily workflow

```bash
cd ~/projects/ledgerdr
git pull
# ... edit / replace files ...
git status
git diff
git add docs/manual
git commit -m "Polish manual chapters"
git push
```

If you have auto-deploy connected (Vercel/Netlify/etc.), `git push` triggers a deploy. If not, pushing only updates GitHub — you'd need to build and upload the app separately. Check your hosting dashboard's deployments tab to confirm which setup you have.

## Working with Claude on the Linux machine

Once the repo is cloned at `~/projects/ledgerdr`, connect that folder when starting a Claude session. Then I can read and edit files in place — no copy-paste, no manual upload. You review the diff with `git diff` and push when satisfied.

## The polish prompt (verbatim, from README.md)

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

## Quick context (so the next session doesn't have to ask)

- Parent company: **JORD AB** (USD), funds the local DR entity (Casa Matriz / Home Office model).
- Default Casa Matriz interest rate: **4 %** for cash advances; **0 %** for equipment.
- Key accounts referenced across chapters: **0000** (internal-transfers bridge), **1080/1180/1280** (CIP), **1690** (supplier advances), **2110** (AP), **2120** (GR/IR), **2160** (Casa Matriz payable), **2310** (ITBIS withholding), **2330** (ISR retained), **7150** (depreciation expense), **7510** (interest expense), **8510** (FX gain/loss).
- DGII NCF types accepted: B01, B02, B11, B14, B15. B11 → automatic 100 % ITBIS withholding + ISR.
- BCRD = Banco Central de la República Dominicana; daily USD/DOP rate auto-scraped each morning.
