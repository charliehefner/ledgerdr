

# User's Manual for LedgerDR

I can produce a comprehensive manual covering all 17 modules, role-based access, and key workflows. Given the breadth of the application, here is the plan:

## Deliverable

A single file: **`docs/USER_MANUAL.md`** (~3,000–4,000 lines of markdown)

## Structure

```text
docs/USER_MANUAL.md
├── 1. Introduction & Getting Started
│   ├── What is LedgerDR
│   ├── Logging in / Password reset
│   ├── Installing as PWA
│   ├── Language toggle (ES/EN)
│   └── Sidebar navigation overview
├── 2. User Roles & Permissions
│   ├── Role descriptions (Admin, Management, Accountant, Supervisor, Viewer, Driver)
│   ├── Section access matrix
│   └── HR sub-tab permissions
├── 3. Pending Docs (Dashboard)
│   ├── Pending NCF numbers
│   └── Pending NCF attachments
├── 4. Transactions
│   ├── Creating a transaction (all fields explained)
│   ├── Purchases vs Sales vs Transfers
│   ├── Multi-attachment support (NCF, Receipt, Quote)
│   ├── Exchange rates & currency
│   ├── OCR receipt scanning
│   └── Recent transactions list
├── 5. Financial Ledger (Reports)
│   ├── Filtering, searching, sorting
│   ├── Column selector
│   ├── Excel & PDF export
│   └── Purchase totals by account
├── 6. Accounting
│   ├── Accounting Reports (configurable filters)
│   ├── Fixed Assets & depreciation
│   ├── Journal entries (types: GJ, PJ, SJ, PRJ, CDJ, CRJ, DEP, RJ, CLJ, ADJ)
│   ├── Generate journals from transactions
│   ├── Recurring entries
│   ├── Periods (open, close, revaluation)
│   ├── Exchange rate revaluation (ADJ journals)
│   ├── DGII Reports (606, 607, 608, IT-1, IR-3)
│   └── Audit log
├── 7. Accounts Receivable / Payable
│   ├── Receivables & Payables
│   ├── Documents (Invoice, Credit Memo, Debit Note)
│   ├── Applying payments
│   └── Aging report & statements
├── 8. Budget / Forecast
│   ├── P&L budget grid
│   ├── Project budgets
│   ├── Actual vs budget comparison
│   └── Currency conversion display
├── 9. Treasury
│   ├── Bank reconciliation
│   ├── Bank accounts
│   ├── Credit cards
│   └── Petty cash
├── 10. Human Resources
│   ├── Employee directory
│   ├── Payroll (timesheet, summary & close)
│   ├── Day labor entries
│   ├── Day laborers (Jornaleros)
│   ├── Services & service providers
│   ├── Government reports (TSS, IR-17)
│   └── Employee loans
├── 11. Inventory
│   ├── Item management
│   ├── Recording purchases
│   ├── Stock adjustments
│   ├── Movement report
│   └── Export
├── 12. Fuel Management
│   ├── Agriculture fuel (tractor fueling)
│   ├── Industry fuel
│   ├── Tank management (levels, refills)
│   ├── Tank & tractor history
│   └── Driver Portal (mobile QR-based fueling)
├── 13. Equipment
│   ├── Tractors
│   ├── Implements
│   └── Hour meter sequence tracking
├── 14. Operations
│   ├── Operations log (record field operations)
│   ├── Contract services
│   ├── Field progress report
│   ├── Input usage report
│   └── Map view (Mapbox integration)
├── 15. Herbicide Calculator
│   ├── Field selection
│   ├── Product selection (herbicides, adherents, conditioners)
│   ├── Tank mixture calculations
│   └── PDF export
├── 16. Rainfall
│   └── Monthly precipitation tracking by location
├── 17. Schedule (Cronograma)
│   └── Weekly operations planning grid
├── 18. Alerts
│   └── Configurable alert rules and notifications
├── 19. Settings (Admin only)
│   ├── User management (create, roles, password reset, scheduled deletions)
│   ├── Chart of Accounts
│   ├── Farms & Fields
│   ├── Operation Types
│   ├── QR Code management
│   ├── Follow-up rules
│   ├── Vendor account rules
│   ├── GPS linking
│   └── Database backup
└── Appendix
    ├── Keyboard shortcuts & tips
    ├── Offline/PWA behavior
    └── DGII report field reference
```

## What will be covered

- **Every module** with its tabs and sub-features
- **Step-by-step workflows** for common tasks (record a transaction, run payroll, close a period, generate DGII reports, fuel a tractor, etc.)
- **Role-based access** — which roles see what
- **Field-by-field explanations** for key forms (transaction form, operation form, payroll)
- **DGII compliance** guidance (606/607/608/IT-1)
- **Exchange rate** handling (daily BCRD rates, revaluation)
- **Export options** (Excel, PDF) per module
- **Driver Portal** mobile workflow (QR scan → fueling wizard)

## Limitations

- Screenshots cannot be embedded (text-only markdown)
- Some very granular UI behaviors may be described generally rather than exhaustively
- The manual reflects the current state of the codebase; future changes will require updates

## Implementation

Single file creation: `docs/USER_MANUAL.md`. No code changes needed.

