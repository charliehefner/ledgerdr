

## CRM Contacts Module with Multi-Bank Support

### Database

**Table 1: `contacts`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | Company/entity name |
| rnc | varchar(20) UNIQUE | Tax ID, nullable |
| contact_type | text NOT NULL | 'customer', 'supplier', 'both' |
| contact_person | text | Optional individual name |
| phone | text | |
| email | text | |
| address | text | |
| notes | text | |
| is_active | boolean DEFAULT true | |
| created_at / updated_at | timestamptz | |

**Table 2: `contact_bank_accounts`** (one-to-many)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contact_id | uuid FK → contacts | ON DELETE CASCADE |
| bank_name | text NOT NULL | e.g. "Banco BHD", "Banco Popular" |
| account_number | text NOT NULL | |
| account_type | text | 'checking', 'savings' |
| currency | varchar(3) DEFAULT 'DOP' | DOP, USD, EUR |
| is_default | boolean DEFAULT false | One default per contact |
| created_at | timestamptz | |

RLS: authenticated SELECT; role-based INSERT/UPDATE/DELETE via `has_role()`.

### UI

**New page: `/contacts`** — "Contactos" / "Contacts" in sidebar

- Table listing contacts with search, type filter, active filter
- Contact dialog with two sections:
  - **General**: name, RNC, type, contact person, phone, email, address
  - **Bank Accounts**: inline editable list — add/remove rows with bank name, account number, type, currency, default toggle

**OCR → CRM prompt** in `TransactionForm.tsx`:
- After OCR extracts name + RNC → lookup `contacts` by RNC
- No match → show banner: "¿Desea agregar este contacto al CRM?" / "Add this contact to CRM?"
- Confirm → insert contact (type='supplier'), bank info added later

**NameAutocomplete** updated to query `contacts` table; selecting a contact auto-fills RNC.

### Files

| File | Change |
|------|--------|
| Migration | Create both tables + RLS + updated_at trigger |
| `src/pages/Contacts.tsx` | New CRUD page with bank accounts sub-table |
| `src/components/layout/Sidebar.tsx` | Add nav item |
| `src/App.tsx` | Add `/contacts` route |
| `src/i18n/es.ts` + `en.ts` | ~30 CRM + bank keys |
| `src/components/transactions/TransactionForm.tsx` | CRM lookup after OCR, confirmation prompt |
| `src/components/transactions/NameAutocomplete.tsx` | Query contacts for suggestions |

