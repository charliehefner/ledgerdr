

# Accounting Documentation for Auditor Review

## What to Create

A single comprehensive document at `docs/ACCOUNTING_SYSTEM_GUIDE.md` covering only the accounting-related sections of the application, written for an external auditor/accountant audience.

## Document Structure

1. **System Overview** — What LedgerDR is, the double-entry model, and the Source Document → Journal → Ledger flow.

2. **Chart of Accounts** — ~419 accounts, hierarchical structure, bilingual descriptions, account types (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE), account code ranges and their meaning.

3. **Transaction Entry** — Three directions (Purchase/Sale/Transfer), required fields, ITBIS handling, B11 withholdings (ITBIS Retenido, ISR Retenido), duplicate detection, cost centers (General/Agrícola/Industrial).

4. **Journal Entry System** — All 10 journal types (GJ, PJ, SJ, PRJ, CDJ, CRJ, DEP, RJ, CLJ, ADJ), auto-generation from transactions via edge function, draft → posted workflow, balanced debit/credit validation, line-level descriptions.

5. **AP/AR Sub-Ledger** — Document types (Factura Proveedor, Invoice, Credit Memo, Debit Note), automatic creation from transactions with due dates, payment recording and CDJ/CRJ journal generation, aging report, credit note alerts.

6. **Financial Statements** — Trial Balance, P&L, Balance Sheet, Cash Flow (indirect method). All pull from `journal_lines` via `account_balances_from_journals` RPC. Unlinked transaction warnings.

7. **Period Management** — Four-state lifecycle (open → closed → reported → locked), database-enforced immutability triggers, period closing journals (CLJ), exchange rate revaluation (ADJ).

8. **Treasury** — Bank accounts mapped to COA, book balance from posted journals, bank reconciliation (CSV/OFX/TXT import), petty cash, credit cards.

9. **Multi-Currency** — DOP/USD/EUR support, BCRD exchange rates, cross-currency transfer handling, unrealized FX revaluation at period-end against account 8510.

10. **DGII Tax Compliance** — 606 (Purchases), 607 (Sales), 608 (Cancellations), IT-1 (ITBIS declaration), IR-3 (ISR withholdings). Auto-classification trigger, export formats.

11. **Fixed Assets & Depreciation** — Asset categories, straight-line depreciation, DEP journal generation, linking to equipment/implements.

12. **Audit Trail** — Database triggers on 8 critical tables, JSON diffs, immutability of posted journals, reversal-only correction model, void cascading to AP/AR.

13. **Data Integrity Controls** — 18% ITBIS cap with override, period locking triggers, RLS policies, schema-poisoning hardening (explicit search_path), duplicate detection.

14. **Budget vs. Actual** — P&L budget grid, project-level budgets, automatic USD→DOP conversion, variance analysis.

## Source Material

- Existing `docs/USER_MANUAL.md` sections 4-9 for functional descriptions
- `docs/accounting_schema_corrected.sql` for schema details
- `docs/DATABASE_TECHNICAL_SPEC.md` for table structures and RLS
- Memory context for architectural decisions and business rules
- Edge function code (`generate-journals`) for journal mapping logic

## Approach

- Written in professional accounting terminology suitable for a Dominican Republic auditor
- Includes the account code range mapping (e.g., 10xx = Current Assets, 21xx = AP, 30xx = Revenue)
- Documents the complete audit trail and internal controls
- References DGII compliance specifics (NCF types, withholding rules)
- Approximately 2,000-3,000 words, structured with clear headings

