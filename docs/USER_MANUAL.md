# LedgerDR — User's Manual

> **Version:** 1.0 · **Last updated:** March 2026  
> **Application URL:** https://ledgerdr.lovable.app

---

## Table of Contents

1. [Introduction & Getting Started](#1-introduction--getting-started)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Dashboard](#3-dashboard)
4. [Transactions](#4-transactions)
5. [Financial Ledger (Reports)](#5-financial-ledger-reports)
6. [Accounting](#6-accounting)
7. [Accounts Receivable / Payable](#7-accounts-receivable--payable)
8. [Budget / Forecast](#8-budget--forecast)
9. [Treasury](#9-treasury)
10. [Human Resources](#10-human-resources)
11. [Inventory](#11-inventory)
12. [Fuel Management](#12-fuel-management)
13. [Equipment](#13-equipment)
14. [Operations](#14-operations)
15. [Herbicide Calculator](#15-herbicide-calculator)
16. [Rainfall](#16-rainfall)
17. [Schedule (Cronograma)](#17-schedule-cronograma)
18. [Alerts](#18-alerts)
19. [Settings (Admin Only)](#19-settings-admin-only)
20. [Driver Portal](#20-driver-portal)
21. [Appendix](#appendix)

---

## 1. Introduction & Getting Started

### 1.1 What is LedgerDR?

LedgerDR is an integrated farm and business management system designed for agricultural operations in the Dominican Republic. It combines financial accounting, field operations tracking, HR/payroll, inventory management, fuel management, and regulatory compliance (DGII) into a single web application.

### 1.2 Logging In

1. Navigate to the application URL.
2. Enter your **email or username** in the "Correo o Usuario" field.
   - If using a username (no `@` symbol), the system converts it to an internal email format automatically.
3. Enter your **password**.
4. Click **Iniciar Sesión**.

After successful login, you are redirected to the default page for your role:
- **Admin / Management / Accountant / Viewer** → Dashboard (`/`)
- **Supervisor** → Operations (`/operations`)
- **Driver** → Driver Portal (`/driver-portal`)

### 1.3 Password Reset

1. On the login screen, click **¿Olvidó su contraseña?**
2. Enter your email address.
3. Click **Enviar Enlace de Recuperación**.
4. Check your email for a reset link. The link redirects to `/reset-password` where you can set a new password.

> **Note:** Password reset via email only works for accounts with real email addresses, not username-only accounts.

### 1.4 Installing as a PWA (Progressive Web App)

LedgerDR can be installed on your device for offline-capable access:

1. Navigate to `/install` for instructions.
2. On **Chrome/Edge (desktop):** Click the install icon in the address bar.
3. On **Android:** Tap "Add to Home Screen" from the browser menu.
4. On **iOS Safari:** Tap the share icon → "Add to Home Screen."

Once installed, the app launches in a standalone window and supports offline operation for the Driver Portal.

### 1.5 Language Toggle

The app supports **Spanish (ES)** and **English (EN)**:

- In the sidebar, find the language toggle near the bottom.
- Flip the switch between **ES** and **EN**.
- The interface language updates immediately. Some labels (DGII report fields, government form names) remain in Spanish regardless of language setting.

### 1.6 Sidebar Navigation

The left sidebar shows navigation items filtered by your role. Key sections include:

| Icon | Section | Description |
|------|---------|-------------|
| 🔔 | Alerts | Internal alert dashboard |
| 📊 | Dashboard | Pending documents overview |
| ↔️ | Transactions | Record new transactions |
| 📈 | Reports | Financial ledger & exports |
| 📖 | Accounting | Journals, periods, DGII, fixed assets |
| 🧾 | AP/AR | Accounts payable & receivable |
| 💰 | Budget | P&L and project budgets |
| 🏛️ | Treasury | Bank reconciliation & petty cash |
| 👥 | HR | Payroll, day labor, employees |
| 📦 | Inventory | Agricultural inputs & supplies |
| ⛽ | Fuel | Tank management & tractor fueling |
| 🚜 | Equipment | Tractors, implements, hour meters |
| 📋 | Operations | Field operations log & contracts |
| 🧪 | Herbicide | Herbicide mix calculator |
| 🌧️ | Rainfall | Daily precipitation records |
| 📅 | Cronograma | Weekly schedule planning |
| ⚙️ | Settings | System configuration (Admin only) |

The sidebar can be collapsed/expanded using the toggle button in the header. On mobile devices, it appears as a hamburger menu.

---

## 2. User Roles & Permissions

### 2.1 Role Descriptions

| Role | Spanish Name | Description |
|------|-------------|-------------|
| **Admin** | Administrador | Full access to all sections including Settings. Can create/delete users, manage system configuration. |
| **Management** | Gerencia | Full access to all sections except Settings. Can modify data across all operational and financial modules. |
| **Accountant** | Contador | Access to financial sections (Transactions, Reports, Accounting, AP/AR, Treasury) and HR (Payroll, Employees). No access to Inventory, Fuel, Equipment, or Operations modules. |
| **Supervisor** | Supervisor | Access to operational sections (Inventory, Fuel, Equipment, Operations, Herbicide, Rainfall, Cronograma). Limited HR access (Day Labor, Services only — no Payroll or Employee salary data). No access to Dashboard, Transactions, Reports, or Accounting. |
| **Viewer** | Visor | Read-only access to Dashboard, Transactions, Reports, Accounting, Inventory, Fuel, Equipment, Operations, Herbicide, Rainfall, and Cronograma. Cannot modify any data. |
| **Driver** | Conductor | Access exclusively to the Driver Portal (`/driver-portal`) for recording fuel transactions via QR codes. No access to any other section. |

### 2.2 Section Access Matrix

| Section | Admin | Management | Accountant | Supervisor | Viewer | Driver |
|---------|:-----:|:----------:|:----------:|:----------:|:------:|:------:|
| Dashboard | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Transactions | ✅ | ✅ | ✅ | ❌ | ✅ (read) | ❌ |
| Reports | ✅ | ✅ | ✅ | ❌ | ✅ (read) | ❌ |
| Accounting | ✅ | ✅ | ✅ | ❌ | ✅ (read) | ❌ |
| AP/AR | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Budget | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Treasury | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| HR | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ |
| Inventory | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Fuel | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Equipment | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Operations | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Herbicide | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Rainfall | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Cronograma | ✅ | ✅ | ❌ | ✅ | ✅ (read) | ❌ |
| Alerts | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Driver Portal | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*\* Supervisor HR access is limited to Day Labor, Services, Jornaleros, and Prestadores tabs only — no Payroll or Employee salary data.*

### 2.3 HR Sub-Tab Permissions

| HR Tab | Admin | Management | Accountant | Supervisor |
|--------|:-----:|:----------:|:----------:|:----------:|
| Payroll | ✅ | ✅ | ✅ | ❌ |
| Day Labor | ✅ | ✅ | ✅ | ✅ |
| Services | ✅ | ✅ | ✅ | ✅ |
| Gov. Reports (TSS/IR-17) | ✅ | ✅ | ✅ | ❌ |
| Jornaleros | ✅ | ✅ | ✅ | ✅ |
| Prestadores | ✅ | ✅ | ✅ | ✅ |
| Employees | ✅ | ✅ | ✅ | ❌ |
| Add Employee | ✅ | ✅ | ❌ | ❌ |

---

## 3. Dashboard

**Route:** `/` · **Access:** Admin, Management, Accountant, Viewer

The Dashboard is a compliance-focused overview showing transactions that need attention.

### 3.1 Fiscal Documents Report

At the top, a summary card shows fiscal document statistics (NCF usage, recent issuance counts).

### 3.2 Transactions Without Document (Pending NCF)

This table lists all non-voided, non-internal transactions that have no NCF document number assigned. Each row shows:

| Column | Description |
|--------|-------------|
| ID | Legacy transaction ID |
| Date | Transaction date |
| Account | Master account code + description |
| Description | Transaction description |
| Document | NCF number (should be empty for items in this list) |
| Name | Vendor/payee name |
| Currency | DOP, USD, or EUR |
| Amount | Transaction amount |
| Attachment | Multi-attachment upload buttons (NCF, Receipt, Quote) |

**Actions:**
- Click any row to open the **Edit Transaction Dialog** for inline editing.
- Use the **Column Selector** (gear icon) to show/hide columns.
- Click **View All** to navigate to the Transactions page.

### 3.3 Transactions Without NCF Attachment

This table lists transactions that have an NCF document number but no NCF attachment file uploaded. Internal transactions and Nómina (payroll) transactions are excluded.

The same columns and interactions apply as above.

### 3.4 Uploading Attachments

Each transaction supports three attachment categories:
- **NCF** — The official fiscal document (comprobante fiscal)
- **Payment Receipt** — Proof of payment
- **Quote** — Original quotation

Click the attachment icons in the table to upload files. Attachments are stored locally in the browser's IndexedDB for offline capability.

---

## 4. Transactions

**Route:** `/transactions` · **Access:** Admin, Management, Accountant (write); Viewer (read)

### 4.1 Transaction Form

The form for recording new transactions includes the following fields:

#### Date Fields
| Field | Required | Description |
|-------|----------|-------------|
| Transaction Date | ✅ | The accounting date for the transaction |
| Purchase Date | ❌ | The date the purchase actually occurred (may differ from transaction date) |

#### Account & Classification
| Field | Required | Description |
|-------|----------|-------------|
| Direction | ✅ | **Purchase** (expense), **Sale** (income), or **Transfer** (internal movement) |
| Master Account | ✅ | Account code from the Chart of Accounts. Dropdown with code + description. |
| Project Code | Conditional | Required when account code is `1180`. Links to a project for cost tracking. |
| CBS Code | Conditional | Required when account code is `1180`. Cost Breakdown Structure code. |
| Cost Center | ✅ | **General**, **Agricultural**, or **Industrial** (defaults to General) |

#### Financial Details
| Field | Required | Description |
|-------|----------|-------------|
| Description | ✅ | Free-text description of the transaction |
| Currency | ✅ | **DOP** (default), **USD**, or **EUR** |
| Amount | ✅ | Transaction amount in the selected currency |
| ITBIS | ❌ | Tax amount (cannot exceed 18% of the base amount) |
| ITBIS Retenido | ❌ | Retained ITBIS — only shown when document starts with "B11" |
| ISR Retenido | ❌ | Retained ISR — only shown when document starts with "B11" |
| Exchange Rate | ❌ | Manual exchange rate override (if currency is USD/EUR) |

#### Vendor & Document
| Field | Required | Description |
|-------|----------|-------------|
| Name | ❌ | Vendor/payee name. Autocomplete from previous transactions. |
| RNC | ❌ | Tax ID number. Auto-fills when a known vendor name is selected. |
| Document | ❌ | NCF/fiscal document number (e.g., B0100000001) |
| Pay Method | ❌ | Payment method identifier |
| Due Date | ❌ | Payment due date |
| Comments | ❌ | Additional notes |

#### Transfer-Specific Fields
When direction is **Transfer**:
| Field | Required | Description |
|-------|----------|-------------|
| From Account | ✅ | Source bank account |
| To Account | ✅ | Destination bank account (or COA account) |
| Destination Amount | Conditional | Required for cross-currency transfers |

#### Sale-Specific Fields
When direction is **Sale**:
| Field | Description |
|-------|-------------|
| DGII Tipo Ingreso | Revenue type code for DGII 607 reporting |

#### Attachments
Three attachment slots:
- **NCF** — Fiscal document scan
- **Payment Receipt** — Payment proof
- **Quote** — Original quotation

### 4.2 Smart Auto-Fill Features

1. **Vendor Name Autocomplete:** Start typing a vendor name and the system suggests matches from previous transactions.
2. **RNC Auto-Fill:** When you select a known vendor, the RNC field auto-populates from previous records.
3. **Vendor Account Rules:** If a vendor name matches a configured rule (Settings → Vendor Rules), the account code, project, CBS, and description auto-populate.
4. **B11 Auto-Fill:** When the document number starts with "B11", the ITBIS Retenido field auto-populates with the ITBIS value.
5. **Diesel Rule:** If the description contains "diesel" and amount < 10,000 and no account is set, account code `5611` is auto-assigned.

### 4.3 Duplicate Detection

The system checks for duplicate transactions based on:
- Same date
- Same account code
- Same amount
- Same vendor name

If a duplicate is detected, the submission is blocked with an error message. Nómina (payroll) transactions are excluded from duplicate checking.

### 4.4 OCR Receipt Scanning

Click the **Scan Receipt** button (camera icon) in the form header to scan a receipt using AI-powered OCR. The system extracts:
- Vendor name
- RNC
- Date
- Amount
- ITBIS
- Document number
- Payment method
- Account code

Extracted values only fill empty fields — they never overwrite data you've already entered.

### 4.5 Recent Transactions

Below the form, the **Recent Transactions** table shows the latest transactions with inline editing capability.

---

## 5. Financial Ledger (Reports)

**Route:** `/reports` · **Access:** Admin, Management, Accountant (write); Viewer (read)

### 5.1 Overview

The Reports page provides a searchable, sortable, filterable ledger of all non-voided transactions.

### 5.2 Filters

| Filter | Description |
|--------|-------------|
| Search | Free-text search across ID, description, name, account code, and document number |
| Start Date | Filter transactions on or after this date |
| End Date | Filter transactions on or before this date |
| Account | Filter by specific account code |
| Currency | Filter by DOP, USD, or EUR |
| Pay Method | Filter by payment method |
| Rows Limit | Number of recent transactions to load (default: 150) |

### 5.3 Sortable Columns

Click any column header to sort ascending → descending → unsorted. Sortable columns include: ID, Date, Account, Project, CBS Code, Description, Currency, Amount, ITBIS, Pay Method, Document, Name, Exchange Rate.

### 5.4 Column Selector

Click the column selector button to show/hide columns. The system remembers your preferences in local storage.

### 5.5 Inline Editing

Click any transaction row to open the **Edit Transaction Dialog**. You can modify all fields. Posted or voided transactions are locked.

### 5.6 Attachment Management

Each row has attachment icons showing the status of NCF, Receipt, and Quote attachments. Click to upload or view attachments.

### 5.7 Purchase Totals by Account

A summary card at the bottom shows totals for key purchase categories:

| Category | Account Codes | CBS Code |
|----------|--------------|----------|
| Agrochemicals | 4030 | 13 |
| Diesel | 4040 | 14 |
| Fertilizer | 4080, 4082 | 12 |
| Oil and Grease | 4050, 4060 | 15 |

You can switch the period: Current Month, Past Month, Year-to-Date, or Prior Year.

### 5.8 Export

**Excel Export:**
- Exports visible columns in current sort/filter order
- Headers are styled with blue background
- File named `transactions_report_YYYY-MM-DD.xlsx`

**PDF Export:**
- Landscape orientation
- Includes title, date, active filters, currency totals
- Table styled with dark blue headers
- File named `transactions_report_YYYY-MM-DD.pdf`

---

## 6. Accounting

**Route:** `/accounting` · **Access:** Admin, Management, Accountant (write); Viewer (read)

The Accounting module is organized into seven tabs:

### 6.1 Accounting Reports

Generate financial statements with configurable filters:

- **Trial Balance** — Debit/credit balances for all accounts
- **Profit & Loss (P&L)** — Revenue minus expenses for a period
- **Balance Sheet** — Assets, liabilities, and equity snapshot
- **Cash Flow** — Cash inflows and outflows

Each report supports date range filtering and export to Excel/PDF.

### 6.2 Fixed Assets

Manage depreciable fixed assets:

| Field | Description |
|-------|-------------|
| Asset Code | Unique identifier |
| Name | Asset description |
| Category | Equipment type (Tractor, Implement, Vehicle, etc.) |
| Acquisition Date | Purchase date |
| Acquisition Value | Original purchase cost |
| Salvage Value | Estimated residual value |
| Useful Life (Years) | Depreciation period |
| Depreciation Method | Straight-line (default) |
| In Service Date | Date asset was put into use |

**Depreciation:**
- Click **Generate Depreciation** to create monthly depreciation journal entries
- Depreciation accounts are configured per category in `asset_depreciation_rules`
- Journal entries use type `DEP` (Depreciation)

**Linking:**
- Fixed assets can be linked to tractors (`equipment_id`) or implements (`implement_id`)
- Assets can be associated with a project (`source_project_id`)

### 6.3 Journal Entries

The journal view shows all accounting journal entries. Each journal has:

| Field | Description |
|-------|-------------|
| Journal Number | Auto-generated sequential number |
| Date | Journal date |
| Type | GJ, PJ, SJ, PRJ, CDJ, CRJ, DEP, RJ, CLJ, ADJ |
| Description | Journal description |
| Posted | Whether the journal has been posted (finalized) |
| Currency | DOP, USD |
| Exchange Rate | Rate at time of recording |

#### Journal Types

| Code | Name | Description |
|------|------|-------------|
| GJ | General Journal | Manual general entries |
| PJ | Purchase Journal | Auto-generated from purchase transactions |
| SJ | Sales Journal | Auto-generated from sale transactions |
| PRJ | Payroll Journal | Payroll-related entries |
| CDJ | Cash Disbursement | Cash payment entries |
| CRJ | Cash Receipt | Cash receipt entries |
| DEP | Depreciation | Asset depreciation entries |
| RJ | Reversal Journal | Reversals of posted journals |
| CLJ | Closing Journal | Period closing entries |
| ADJ | Adjustment Journal | Exchange rate revaluation adjustments |

#### Journal Lines

Each journal contains debit/credit lines with:
- Account (from Chart of Accounts)
- Debit amount
- Credit amount
- CBS Code (optional)
- Project Code (optional)
- Tax Code (optional)

**Total debits must equal total credits** for a journal to be valid.

#### Generate Journals from Transactions

Click the **Generate Journals** button to batch-create journal entries from unprocessed transactions. The system maps each transaction to the appropriate journal type based on the transaction direction and account codes.

#### Manual Journal Entry

Click **New Entry** to create a manual journal entry with custom debit/credit lines.

### 6.4 Recurring Entries

Set up journal entries that repeat on a schedule (monthly, quarterly, annually). Useful for:
- Rent payments
- Insurance premiums
- Depreciation (if not auto-generated)
- Amortization entries

### 6.5 Periods

Manage accounting periods (typically monthly):

| Action | Description |
|--------|-------------|
| Open Period | Create a new accounting period with start/end dates |
| Close Period | Lock a period to prevent further modifications |
| Revaluation | Run exchange rate revaluation for USD-denominated accounts |

**Period Closing** generates CLJ (Closing) journal entries that zero out temporary accounts.

**Exchange Rate Revaluation** fetches the latest BCRD (Banco Central de la República Dominicana) rate and creates ADJ journals to adjust USD-denominated account balances to the current rate.

### 6.6 DGII Reports

Generate tax compliance reports for the Dominican Republic's Dirección General de Impuestos Internos:

#### 606 — Compras y Gastos (Purchases & Expenses)

Lists all purchase transactions for the reporting period with:
- RNC/Cédula of vendor
- NCF document number
- Transaction date and amount
- ITBIS paid, ITBIS retenido, ISR retenido
- Payment method code

#### 607 — Ventas (Sales)

Lists all sale transactions for the reporting period with:
- RNC/Cédula of client
- NCF document number
- Revenue type (Tipo Ingreso)
- Transaction date and amount
- ITBIS collected

#### 608 — Anulaciones (Cancellations)

Lists voided NCF documents during the period.

#### IT-1 — Declaración de ITBIS

Summary of ITBIS (VAT) collected and paid for the period. Calculates net ITBIS payable or receivable.

#### IR-3 — Retenciones de ISR

ISR withholding report from B11 documents.

All DGII reports can be exported to the required TXT format for upload to the DGII virtual office.

### 6.7 Audit Log

Read-only view of all accounting-related changes:
- Who made the change
- What table was affected
- Old and new values
- Timestamp

---

## 7. Accounts Receivable / Payable

**Route:** `/accounts` · **Access:** Admin, Management, Accountant

### 7.1 Receivables Tab

Manage money owed **to** you:

| Field | Description |
|-------|-------------|
| Contact Name | Client name |
| Contact RNC | Client tax ID |
| Document Type | Invoice, Credit Memo, Debit Note |
| Document Number | Reference number |
| Document Date | Issue date |
| Due Date | Payment due date |
| Total Amount | Full document amount |
| Amount Paid | Payments received to date |
| Balance Remaining | Auto-calculated: Total − Paid |
| Status | Open, Partial, Paid, Overdue |
| Currency | DOP or USD |

**Actions:**
- Create new receivable documents
- Record payments against existing documents
- Link transactions to AP/AR documents
- View aging breakdown

### 7.2 Payables Tab

Manage money you owe **to others**. Same fields and actions as Receivables but in the payable direction.

### 7.3 Aging Report

Available through the Accounting Reports tab, the aging report categorizes outstanding balances into:
- Current (not yet due)
- 1–30 days overdue
- 31–60 days overdue
- 61–90 days overdue
- 90+ days overdue

---

## 8. Budget / Forecast

**Route:** `/budget` · **Access:** Admin only

### 8.1 Overview

The Budget module provides a 12-month grid for entering budgeted amounts and comparing them against actual transaction totals.

### 8.2 Tabs

- **P&L Budget** — Overall profit & loss budget organized by account code
- **Project Budgets** — One tab per active project, allowing project-level budgeting

### 8.3 Budget Grid

Each row represents an account code. Columns include:

| Column | Description |
|--------|-------------|
| Account Code | Chart of Accounts code |
| Description | Account name |
| Month 1–12 | Budgeted amount for each month |
| Annual Budget | Sum of all monthly amounts |
| Current Forecast | Adjusted forecast (editable) |
| Actual | Actual transaction totals for the period |
| Variance | Budget minus Actual |

**Features:**
- Click any cell to edit the budget amount
- Amounts display as whole numbers (no decimals) in DOP
- USD transactions are automatically converted to DOP using the daily exchange rate
- The fiscal year selector allows viewing budgets for different years (current year ± 2)

### 8.4 Project Management

- **Add Project:** Click the ➕ button to create a new project with code, English description, and Spanish description
- **Activate/Deactivate:** Toggle project visibility without deleting data
- **Show Inactive:** Toggle to display deactivated projects

---

## 9. Treasury

**Route:** `/treasury` · **Access:** Admin, Management, Accountant

The Treasury module manages cash and banking operations through four sub-sections:

### 9.1 Bank Reconciliation

Match bank statement lines with recorded transactions and journal entries:

1. Select a bank account
2. Import or manually enter statement lines (date, amount, description, reference)
3. Match each line to an existing transaction or journal
4. Mark as reconciled

Unmatched items indicate discrepancies that need investigation.

### 9.2 Bank Accounts

Manage bank account records:

| Field | Description |
|-------|-------------|
| Bank Name | Financial institution name |
| Account Name | Account alias |
| Account Number | Bank account number |
| Account Type | Checking, Savings, etc. |
| Currency | DOP or USD |
| Chart Account ID | Linked Chart of Accounts entry |
| Fixed Amount | Standing balance (if applicable) |
| Is Active | Whether the account is currently in use |

### 9.3 Credit Cards

Track credit card accounts with similar fields as bank accounts.

### 9.4 Petty Cash

Manage petty cash funds:
- Track current balance
- Record disbursements
- Trigger replenishment when balance drops below threshold

---

## 10. Human Resources

**Route:** `/hr` · **Access:** Varies by tab (see Section 2.3)

### 10.1 Payroll

**Access:** Admin, Management, Accountant

The payroll system supports bi-monthly pay periods:

#### Period Selection
Choose the payroll period (e.g., "January 1–15, 2026"). Each period can be open or closed.

#### Timesheet Grid
A spreadsheet-like grid showing:
- One row per active employee
- Columns for each working day in the period
- Start time and end time inputs
- Auto-calculated hours worked
- Absent/Holiday toggles per day

#### Payroll Summary
After entering time data, the summary calculates:

| Item | Description |
|------|-------------|
| Gross Salary | Proportional salary for the period |
| Overtime | Calculated from hours exceeding standard workday |
| SFS (Employee) | 3.04% health insurance deduction |
| AFP (Employee) | 2.87% pension deduction |
| ISR | Income tax withholding (progressive rates) |
| Loan Deductions | Active employee loan installments |
| Benefits | Recurring benefits (transportation, food, etc.) |
| Net Pay | Take-home amount |

#### Payroll Close
Closing a period finalizes calculations and locks the timesheet for that period.

#### Payroll Receipt
Generate individual payroll receipts (recibos de pago) as PDF for each employee.

### 10.2 Day Labor (Ajuste Diario)

**Access:** Admin, Management, Accountant, Supervisor

Record daily labor entries for temporary/seasonal workers:

| Field | Description |
|-------|-------------|
| Work Date | Date of work performed |
| Worker Name | Name of the day laborer |
| Workers Count | Number of workers (for group entries) |
| Operation Description | What work was performed |
| Field Name | Which field the work was done in |
| Amount | Payment amount |
| Week Ending Date | Grouping date for weekly summaries |

**Features:**
- Entries are grouped by week ending date
- Week can be closed to prevent further modifications
- Attachments can be uploaded per week (receipts, sign-off sheets)
- Export to Excel/PDF

### 10.3 Jornaleros (Day Laborers)

**Access:** Admin, Management, Accountant, Supervisor

Maintain a registry of day laborers:

| Field | Description |
|-------|-------------|
| Name | Full name |
| Cédula | National ID number |
| Is Active | Currently available for work |

### 10.4 Services (Servicios)

**Access:** Admin, Management, Accountant, Supervisor

Record service transactions from external service providers:

| Field | Description |
|-------|-------------|
| Service Date | Date of service |
| Provider | Service provider name |
| Description | Service description |
| Amount | Payment amount |

### 10.5 Service Providers (Prestadores)

**Access:** Admin, Management, Accountant, Supervisor

Registry of external service providers with contact information.

### 10.6 Government Reports

**Access:** Admin, Management, Accountant

#### TSS Autodeterminación
Generate the monthly file for the Tesorería de la Seguridad Social:
- Employee list with salaries
- SFS and AFP contributions (employer and employee portions)
- Exportable to the TSS-required format

#### IR-17
Retenciones complementarias y de terceros:
- Monthly summary of complementary withholdings
- ISR withholding details
- Exportable format for DGII submission

### 10.7 Employee Management

**Access:** Admin, Management, Accountant (view); Admin, Management (add/edit)

#### Employee Directory
Lists all employees with key information:
- Name, Cédula, Position
- Date of hire, Salary
- Active/Inactive status

#### Employee Detail Dialog
Click an employee to view/edit full details:

| Section | Fields |
|---------|--------|
| Personal | Name, Cédula, Date of Birth |
| Employment | Position, Date of Hire, Salary, Bank, Account Number |
| Sizing | Shirt Size, Pant Size, Boot Size |
| History | Salary history, Vacation records, Incidents |
| Documents | Uploaded employee documents (contracts, IDs, etc.) |
| Loans | Active loan details with remaining payments |

#### Vacation Countdown
Shows days until next vacation entitlement and available vacation days.

#### Employee Loans
Track employee loans with automatic payroll deductions:
- Loan amount, number of payments, payment amount
- Remaining payments tracked automatically
- Deducted from payroll each period

---

## 11. Inventory

**Route:** `/inventory` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 11.1 Inventory Items

Manage agricultural inputs and supplies:

| Field | Description |
|-------|-------------|
| Commercial Name | Product brand name |
| Molecule Name | Active ingredient |
| Function | Herbicide, Insecticide, Fungicide, Fertilizer, Adjuvant, Other |
| Current Quantity | Stock on hand (in use units) |
| Use Unit | Unit of measurement for field use (L, kg, etc.) |
| Purchase Unit Type | How the product is bought (drum, sack, bottle) |
| Purchase Unit Quantity | Size of each purchase unit |
| Price Per Purchase Unit | Cost per unit |
| Minimum Stock | Reorder threshold |
| Supplier | Default supplier |
| Normal Dose Per Ha | Standard application rate |
| Sack Weight (kg) | For bulk products |
| CAS Number | Chemical identification number |
| CO₂ Equivalent | Carbon footprint factor |

### 11.2 Recording Purchases

Click **Record Purchase** to log inventory acquisitions:

| Field | Description |
|-------|-------------|
| Item | Select from existing inventory items |
| Purchase Date | Date of purchase |
| Quantity | Number of use units purchased |
| Packaging | Quantity and unit type (e.g., "4 drums") |
| Unit Price | Price per use unit |
| Total Price | Auto-calculated |
| Document Number | Invoice/receipt number |
| Supplier | Vendor name |
| Notes | Additional notes |

Purchasing automatically increases the item's current quantity.

### 11.3 Stock Adjustments

Record non-purchase inventory changes:
- Manual corrections
- Spoilage/waste
- Transfers between locations

### 11.4 Purchase Totals by Account

A summary card showing purchase totals grouped by account code for the selected period.

### 11.5 CO₂ Movement Report

Click **CO₂ Report** to view inventory movements with associated carbon footprint calculations based on the CO₂ equivalent factor of each product.

### 11.6 Export

Export the inventory list to Excel with all columns and current quantities.

---

## 12. Fuel Management

**Route:** `/fuel` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 12.1 Agriculture Fuel Tab

Record fuel dispensing to agricultural equipment:

| Field | Description |
|-------|-------------|
| Date | Fueling date |
| Tank | Source fuel tank |
| Equipment | Tractor being fueled |
| Pump Start | Pump meter reading at start |
| Pump End | Pump meter reading at end |
| Gallons | Auto-calculated from pump readings |
| Hour Meter | Current tractor hour meter reading |
| Previous Hour Meter | Auto-populated from last fueling |
| Gallons/Hour | Auto-calculated fuel efficiency |
| Notes | Additional notes |

**Tractor History:** Click a tractor name to view its complete fueling history with efficiency trends.

**Tank History:** Click a tank name to view fill/dispense history and level changes.

### 12.2 Industry Fuel Tab

Record fuel dispensing for industrial/non-agricultural equipment. Same fields but for industry-type tanks.

### 12.3 Tanks Tab

Manage fuel storage tanks:

| Field | Description |
|-------|-------------|
| Name | Tank identifier |
| Fuel Type | Diesel, Gasoline, etc. |
| Capacity (Gallons) | Maximum tank capacity |
| Current Level (Gallons) | Current fuel level |
| Use Type | Agriculture or Industry |
| Last Pump End Reading | Last recorded pump meter value |
| Is Active | Whether the tank is in service |

**Actions:**
- Add/edit tanks
- Record tank refills (increases current level)
- View tank history

### 12.4 Tractor Maintenance

Each tractor has a configurable **maintenance interval** (in hours). When the hour meter approaches the interval, the system generates alerts. Click a tractor to view/record maintenance events.

---

## 13. Equipment

**Route:** `/equipment` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 13.1 Tractors Tab

Manage the tractor fleet:

| Field | Description |
|-------|-------------|
| Name | Tractor identifier/name |
| Equipment Type | Category (tractor, truck, etc.) |
| Brand | Manufacturer |
| Model | Model name/number |
| HP | Horsepower |
| Serial Number | Manufacturing serial |
| Purchase Date | Acquisition date |
| Purchase Price | Original cost |
| Current Hour Meter | Current hours of operation |
| Maintenance Interval (Hours) | Hours between scheduled maintenance |
| Front/Rear Tire Size | Tire specifications |
| GPSGate User ID | Linked GPS tracking ID |
| Is Active | Whether the unit is in service |

### 13.2 Implements Tab

Manage implements (attachments for tractors):

| Field | Description |
|-------|-------------|
| Name | Implement identifier |
| Implement Type | Category (plow, sprayer, etc.) |
| Brand | Manufacturer |
| Model | Model name |
| Serial Number | Manufacturing serial |
| Working Width (m) | Operating width in meters |
| Purchase Date | Acquisition date |
| Purchase Price | Original cost |
| Is Active | Currently in use |

### 13.3 Hour Meter Sequence (Horómetro)

A chronological view of all hour meter readings across the tractor fleet:
- Ordered by date and equipment
- Shows fuel consumption between readings
- Highlights anomalies (readings that decrease, excessive gaps)

---

## 14. Operations

**Route:** `/operations` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 14.1 Operations Log

Record field operations performed on agricultural fields:

| Field | Description |
|-------|-------------|
| Operation Date | Date the operation was performed |
| Field | Which field (from the Farms/Fields registry) |
| Operation Type | Type of operation (from Operation Types registry) |
| Tractor | Equipment used (for mechanical operations) |
| Implement | Attachment used |
| Driver | Operator name |
| Start Hours | Tractor hour meter at start |
| End Hours | Tractor hour meter at end |
| Hectares Done | Area covered |
| Workers Count | Number of workers (for manual operations) |
| Notes | Additional details |

**Input Usage:** When recording an operation, you can log inventory items consumed (herbicides, fertilizer, etc.) with quantities. This deducts from inventory automatically.

### 14.2 Contracted Services

Manage contracts with external service providers for field operations:

#### Contracts
| Field | Description |
|-------|-------------|
| Contractor Name | Service provider |
| Service Type | Type of contracted work |
| Rate Per Unit | Price per hectare, hour, or other unit |
| Contract Date | Start date |
| Status | Active, Completed, Cancelled |

#### Daily Entries
Record daily work performed under a contract:
- Date, hectares completed, amount
- Running total against contract value

#### Payments
Record payments made against contracts.

#### Contract Report
Summary report showing contract progress, remaining balance, and payment history.

### 14.3 Field Progress Report

Visual summary of operations completed per field:
- Total hectares worked
- Operations by type
- Percentage of field area covered
- Seasonal comparison

### 14.4 Input Usage Report

Track agricultural input consumption across operations:
- Usage by product
- Usage by field
- Cost calculations
- Click a product to deep-link from Inventory

### 14.5 Map View

Interactive Mapbox-powered map showing:
- **Field boundaries** — Polygons imported from KML files
- **Color-coded aging** — Fields colored by days since last operation
- **Live GPS positions** — Real-time tractor positions (requires GPSGate integration)
- **Track history** — Historical GPS tracks for selected equipment

#### KML Import
Import field boundaries from KML/KMZ files:
1. Click **Import KML**
2. Select a KML file
3. Map each polygon to a field name
4. Boundaries are stored in the database

---

## 15. Herbicide Calculator

**Route:** `/herbicide` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 15.1 Overview

A calculator for planning herbicide tank mixtures based on field areas and product dosages.

### 15.2 Field Selection

Select one or more fields from the registry. The total hectares are summed for calculation.

### 15.3 Product Selection

Add products to the mix:

| Product Type | Description |
|-------------|-------------|
| Herbicide | Primary herbicide products |
| Adherent | Surfactants and stickers |
| Conditioner | Water conditioners |

For each product, you can:
- Select from inventory items
- Set the dose per hectare (defaults to the item's `normal_dose_per_ha`)
- Adjust quantities manually

### 15.4 Tank Size

Enter the sprayer tank capacity (in liters). The calculator determines how many tank loads are needed for the total area.

### 15.5 Calculation Output

The calculator shows:
- Total product quantities needed
- Quantity per tank load
- Number of tank loads required
- Water volume per load
- Product cost breakdown

### 15.6 PDF Export

Export the calculation as a PDF document for field crew reference, including all products, doses, and tank load instructions.

---

## 16. Rainfall

**Route:** `/rainfall` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 16.1 Daily Records Tab

Record daily precipitation at four monitoring locations:

| Location | Description |
|----------|-------------|
| Solar | Solar station |
| Caoba | Caoba station |
| Palmarito | Palmarito station |
| Virgencita | Virgencita station |

**Workflow:**
1. Select date range (default: current month)
2. Enter precipitation values (in mm) for each location and date
3. Empty days show as 0; non-zero days are highlighted
4. Click **Save** to persist changes
5. Totals row shows cumulative precipitation per location

### 16.2 Monthly Summary Tab

A bar chart and summary table showing monthly precipitation totals across all locations. Useful for year-over-year comparison.

### 16.3 Export

- **Excel:** Full data table with styled headers
- **PDF:** Formatted report with totals

---

## 17. Schedule (Cronograma)

**Route:** `/cronograma` · **Access:** Admin, Management, Supervisor (write); Viewer (read)

### 17.1 Overview

A weekly operations planning grid for assigning workers to tasks across the work week.

### 17.2 Grid Layout

| Column | Description |
|--------|-------------|
| Worker Name | Employee or jornalero |
| Worker Type | Employee, Jornalero, etc. |
| Monday–Saturday | Task assigned for each day |
| Time Slot | Morning, Afternoon, Full Day |

### 17.3 Features

- **Week Navigation:** Browse forward/backward by week
- **Auto-Population:** Entries can be auto-generated from operations log
- **Holiday/Vacation Marking:** Flag days as holidays or vacations
- **Week Close:** Lock a completed week to prevent edits
- **Linked Operations:** Entries can link back to the source operation record

---

## 18. Alerts

**Route:** `/alerts` · **Access:** Admin, Management, Supervisor

### 18.1 Overview

The alerts page displays system-generated notifications across five sectors:

### 18.2 Alert Sectors

| Sector | Example Alerts |
|--------|---------------|
| **Human Resources** | Vacation entitlement approaching, document expiration, contract renewals |
| **Equipment** | Maintenance due (hour meter approaching interval), overdue maintenance |
| **Fuel** | Low tank levels, unusual consumption patterns |
| **Inventory** | Stock below minimum threshold, expired products |
| **Operations** | Overdue field operations, GPS disconnection |

### 18.3 Severity Levels

Alerts are color-coded by severity:
- 🔴 **Critical** — Requires immediate attention
- 🟡 **Warning** — Should be addressed soon
- 🔵 **Info** — Informational notification

### 18.4 Alert Configuration (Admin Only)

Click **Configurar** to manage alert rules:
- Enable/disable specific alert types
- Set threshold values (e.g., minimum tank level, maintenance window)
- Toggle active/inactive status

---

## 19. Settings (Admin Only)

**Route:** `/settings` · **Access:** Admin only

### 19.1 General Tab

#### Scheduled Deletions
View and manage records scheduled for deletion. Deletions are soft (marked with `deleted_at` timestamp) and can be reversed before the scheduled purge date.

#### Database Backup
Generate SQL backup scripts containing:
- Table schemas
- RLS (Row Level Security) policies
- Triggers
- Storage bucket configurations

The backup is downloaded as a `.sql` file.

#### Database Connection
Configure database connection parameters (host, port, database name, credentials). Includes a **Test Connection** button.

#### Notifications
Toggle notification preferences:
- Due date alerts
- Payment reminders
- Weekly summary emails

### 19.2 Users Tab

Manage system users:

| Action | Description |
|--------|-------------|
| Create User | Add a new user with email/username, password, and role |
| Change Role | Update a user's role (Admin, Management, Accountant, Supervisor, Viewer, Driver) |
| Reset Password | Set a new password for a user |
| Schedule Deletion | Mark a user for deletion |

> **Important:** User creation generates an internal email for username-based accounts using the `@internal.jord.local` domain.

### 19.3 Farms & Fields Tab

Manage the organizational hierarchy:

**Farms:**
- Name
- Active/Inactive status

**Fields (per Farm):**
- Name
- Hectares (area)
- Boundary (GeoJSON polygon)
- Active/Inactive status

### 19.4 Operation Types Tab

Configure available operation types:

| Field | Description |
|-------|-------------|
| Name | Operation name (e.g., "Rastreo", "Fumigación") |
| Is Mechanical | Whether the operation uses a tractor/implement |
| Is Active | Whether it appears in operation dropdowns |

### 19.5 QR Codes Tab

Generate and manage QR codes for equipment and tanks:
- Each QR encodes the equipment/tank ID
- Print QR codes individually or in batches
- QR codes are used by the Driver Portal for equipment identification

### 19.6 Follow-Up Rules (Seguimientos)

Configure automatic follow-up operations:

| Field | Description |
|-------|-------------|
| Trigger Operation Type | When this operation is logged... |
| Follow-Up Text | ...automatically suggest this follow-up |
| Days Offset | Number of days after the trigger |
| Default Driver | Pre-assigned operator |
| Is Active | Rule enabled/disabled |

### 19.7 Vendor Account Rules (Reglas Proveedor)

Auto-fill rules for recurring vendors:

| Field | Description |
|-------|-------------|
| Vendor Name | Keyword match (case-insensitive) |
| Master Account Code | Auto-assigned account |
| Project Code | Auto-assigned project |
| CBS Code | Auto-assigned CBS |
| Description Template | Auto-filled description |

When a transaction's vendor name matches a rule, the corresponding fields are auto-populated.

### 19.8 GPS Linking

Link tractor records to GPSGate user IDs for live tracking:

| Field | Description |
|-------|-------------|
| Equipment | Select a tractor |
| GPSGate User ID | Numeric ID from GPSGate system |

Once linked, the equipment appears on the Operations Map with real-time position data.

### 19.9 Chart of Accounts

Full CRUD management of the Chart of Accounts:

| Field | Description |
|-------|-------------|
| Account Code | Numeric code (e.g., 1100, 4030) |
| Account Name | Display name |
| Account Type | Asset, Liability, Equity, Revenue, Expense |
| Parent ID | Hierarchical parent account |
| Currency | Default currency |
| Allow Posting | Whether journal entries can be posted directly |
| English/Spanish Descriptions | Bilingual descriptions |

---

## 20. Driver Portal

**Route:** `/driver-portal` · **Access:** Driver role only

### 20.1 Overview

A mobile-optimized interface for drivers to record fuel transactions using QR codes. Designed for offline use with automatic sync when connectivity is restored.

### 20.2 Interface

The portal features:
- **Header:** Company logo, user name, online/offline indicator, logout button
- **Quick Stats:** Today's submission count and pending sync count
- **Instructions Card:** Step-by-step fueling guide
- **Fixed Action Button:** "Registrar Combustible" at the bottom of the screen

### 20.3 Fueling Wizard

The 6-step wizard guides drivers through the fueling process:

#### Step 1: Tractor Selection
Scan the QR code on the tractor, or select manually from a dropdown.

#### Step 2: Hour Meter Photo
Take a photo of the tractor's hour meter display. The system uses AI (image analysis) to read the meter value automatically.

#### Step 3: Tank Selection
Scan the QR code on the fuel tank, or select manually.

#### Step 4: Pump Start Reading
Enter or photograph the pump meter reading before fueling begins.

#### Step 5: Pump End Reading
Enter or photograph the pump meter reading after fueling completes. Gallons dispensed are calculated automatically.

#### Step 6: Review & Submit
Review all entered data:
- Tractor name and hour meter reading
- Tank name
- Pump start/end readings
- Gallons dispensed
- Gallons per hour (calculated from hour meter delta)
- Any notes

Click **Submit** to record the fuel transaction.

### 20.4 Offline Support

- Submissions are queued in IndexedDB when offline
- The sync indicator shows pending submissions count
- When connectivity is restored, queued submissions are automatically synced
- Last sync time is displayed

---

## Appendix

### A. Keyboard Shortcuts & Tips

- **Sidebar collapse/expand:** Click the panel toggle button in the sidebar header
- **Quick search:** Use the search/filter bars on each page for fast navigation
- **Tab navigation:** Most tabbed pages support clicking tabs or using the tab bar
- **Date pickers:** Click the calendar icon, then click a date to select

### B. Offline / PWA Behavior

LedgerDR uses a service worker for Progressive Web App functionality:

- **Cache Strategy:** `offlineFirst` for network requests — uses cached data when offline
- **Query Retry:** Failed queries retry up to 3 times with exponential backoff
- **Mutation Queue:** Failed mutations retry up to 2 times
- **Data Freshness:** Cache is considered stale after 5 minutes; garbage collected after 30 minutes
- **Window Focus:** Refetching on window focus is disabled to avoid connection storms

The **Driver Portal** has the most robust offline support with IndexedDB-backed submission queuing.

### C. DGII Report Field Reference

#### 606 Fields
| Field | Description | Format |
|-------|-------------|--------|
| RNC/Cédula | Vendor tax ID | 9 or 11 digits |
| Tipo Bienes | Type code | 2-digit code |
| NCF | Fiscal document number | B + 10 digits |
| Fecha | Transaction date | YYYYMMDD |
| Monto | Base amount | Decimal |
| ITBIS | Tax amount | Decimal |
| Retención ITBIS | Withheld ITBIS | Decimal |
| Retención ISR | Withheld ISR | Decimal |
| Forma de Pago | Payment method | 2-digit code |

#### 607 Fields
| Field | Description | Format |
|-------|-------------|--------|
| RNC/Cédula | Client tax ID | 9 or 11 digits |
| Tipo Ingreso | Revenue type | 2-digit code |
| NCF | Fiscal document number | B + 10 digits |
| Fecha | Transaction date | YYYYMMDD |
| Monto | Sale amount | Decimal |
| ITBIS | Tax collected | Decimal |

#### Payment Method Codes (Forma de Pago)
| Code | Description |
|------|-------------|
| 01 | Efectivo (Cash) |
| 02 | Cheque / Transferencia (Check/Transfer) |
| 03 | Tarjeta Crédito/Débito (Card) |
| 04 | Venta a Crédito (Credit Sale) |
| 05 | Permuta (Barter) |
| 06 | Nota de Crédito (Credit Note) |
| 07 | Mixto (Mixed) |

### D. Currency & Exchange Rates

- **Default currency:** DOP (Dominican Peso)
- **Supported currencies:** DOP, USD, EUR
- **Exchange rate source:** Banco Central de la República Dominicana (BCRD)
- **Rate fetching:** Automatic daily fetch via backend function
- **Revaluation:** Period-end revaluation adjusts USD-denominated account balances

### E. Data Export Formats

| Module | Excel | PDF |
|--------|:-----:|:---:|
| Reports (Transactions) | ✅ | ✅ |
| Rainfall | ✅ | ✅ |
| Day Labor | ✅ | ✅ |
| Inventory | ✅ | ❌ |
| Operations | ✅ | ❌ |
| Payroll Receipts | ❌ | ✅ |
| DGII Reports | TXT | ❌ |
| Accounting Reports | ✅ | ✅ |
| Herbicide Calculator | ❌ | ✅ |
| Budget | ✅ | ❌ |

### F. Account Code Reference (Common)

| Code | Description |
|------|-------------|
| 1100 | Cash and Cash Equivalents |
| 1180 | Projects (requires Project + CBS codes) |
| 2160 | JORD AB Head Office Account |
| 4030 | Agrochemicals |
| 4040 | Diesel |
| 4050 | Oil |
| 4060 | Grease |
| 4080 | Fertilizer |
| 4082 | Fertilizer (Secondary) |
| 5611 | Diesel (Auto-assigned for small purchases) |
| 7010 | Nómina (Payroll) |

---

*This manual reflects the current state of the LedgerDR application as of March 2026. Features and interfaces may evolve over time. For questions or support, contact your system administrator.*
