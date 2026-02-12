
# Servicios Module for Human Resources

## Overview
Add a new "Servicios" category to the HR module for managing service providers (welders, mechanics, etc.) who are paid directly for their services. This includes a provider registry ("Prestadores"), individual service tracking with partial-fill warnings, and receipt generation on close with ledger integration.

## Open Design Decisions (from analysis)

- **Currency placement**: Plan places currency on each service entry (not on the provider profile) so the same provider can invoice in DOP or USD. The provider profile keeps bank details only.
- **Completeness rule**: A service is "incomplete" (amber + triangle icon) if it is missing any of: master_acct_code, description, or amount.
- **Date**: Each service entry will have a `service_date` field (defaults to today).
- **Provider history**: The Prestadores dialog will show a history table of past services for the selected provider.

## Database Changes

### New Tables

**`service_providers`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| name | text NOT NULL | |
| cedula | text UNIQUE NOT NULL | |
| bank | text | nullable |
| bank_account_type | text | 'savings' or 'current' |
| currency | text | 'DOP' or 'USD' (bank currency) |
| bank_account_number | text | |
| is_active | boolean | default true |
| created_at / updated_at | timestamptz | auto |

**`service_entries`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| provider_id | uuid FK -> service_providers | NOT NULL |
| service_date | date | default CURRENT_DATE |
| master_acct_code | text | nullable (incomplete if missing) |
| description | text | nullable (incomplete if missing) |
| amount | numeric | nullable (incomplete if missing) |
| currency | text | 'DOP' or 'USD', default 'DOP' |
| comments | text | nullable |
| is_closed | boolean | default false |
| created_at / updated_at | timestamptz | auto |

RLS policies mirror existing HR tables (authenticated users with role-based checks).

## UI Layout (Tab Structure)

Current HR tabs layout:
```text
Left group:  [Nomina] [Jornales] [Servicios]
Right group: [Jornaleros] [Prestadores] [Empleados]
```

- **Servicios** tab goes beside Jornales (left group)
- **Prestadores** tab goes beside Jornaleros (right group)

## Components to Create

### 1. `src/components/hr/ServiceProvidersView.tsx` (Prestadores tab)
- Mirrors `JornalerosView.tsx` structure
- Registry table: Name, Cedula, Bank, Account Type, Currency, Account #, Status
- Add/Edit dialog with fields:
  - Name (required), Cedula (required, unique)
  - Bank (dropdown: Popular, BHD, Reservas, Santa Cruz, Scotiabank, etc.)
  - Account Type (toggle: Ahorros / Corriente)
  - Currency (toggle: DOP / USD)
  - Account Number
- Active/inactive toggle for soft delete
- Clicking a provider shows historical services in the dialog

### 2. `src/components/hr/ServicesView.tsx` (Servicios tab)
- Shows open (unclosed) services by default
- "Agregar Servicio" button opens add dialog
- Service list table columns: Provider Name, Date, Account, Description, Amount, Status
- Incomplete rows highlighted amber with AlertTriangle icon (same pattern as Operations)
- Each row has Edit and Close actions
- **Add/Edit Service Dialog**:
  - Provider (dropdown from active service_providers, required)
  - Service Date (default today)
  - Master Account (dropdown from accounts table)
  - Description
  - Amount
  - Currency (DOP/USD)
  - Comments
- **Close Service**:
  - Confirmation dialog
  - Validates service is complete (all fields filled)
  - Generates PDF receipt
  - Creates transaction in ledger (master_acct_code from service, no pay_method, no document)
  - Marks is_closed = true

### 3. Receipt PDF Generation
- Greyscale design (matching payroll receipt style)
- Content:
  - Provider name and cedula
  - Description of service
  - Amount in numbers and written out in Spanish words
  - Signature box with name and cedula line
- Requires a `numberToSpanishWords()` utility function

## Permissions

Add new HR tabs to permissions system:

| Tab | Read Access | Write Access |
|-----|------------|--------------|
| servicios | admin, management, accountant, supervisor | admin, management, accountant |
| prestadores | admin, management, accountant, supervisor | admin, management, accountant, supervisor |

## Files Modified

- `src/lib/permissions.ts` -- add "servicios" and "prestadores" to HrTab type and permission maps
- `src/pages/HumanResources.tsx` -- add Servicios and Prestadores tabs
- `src/types/index.ts` -- add ServiceProvider and ServiceEntry types

## Files Created

- `src/components/hr/ServiceProvidersView.tsx` -- Prestadores registry
- `src/components/hr/ServicesView.tsx` -- Services management
- `src/lib/numberToWords.ts` -- Spanish number-to-words utility for receipts

## Transaction Integration

When closing a service:
- Calls `createTransaction()` with:
  - `master_acct_code`: from the service entry
  - `description`: "Servicio: {description} - {provider name}"
  - `currency`: from the service entry
  - `amount`: from the service entry
  - `pay_method`: null (to be filled later)
  - `document`: null (open for NCF later)
  - `comments`: null (open for addition later)
  - `is_internal`: false
