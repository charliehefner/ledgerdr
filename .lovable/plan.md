

## Fix Service Close → Transaction: Add Missing Fields

### Problem
When closing a service, the auto-created transaction is missing:
1. **Document** — should be `"Recibo"`
2. **RNC** — should be the provider's cédula/passport

The `pay_method` is already being passed correctly in both `ServicesView.tsx` (line 175) and `api.ts` (line 169). The `name` is already set to the provider's name (line 176).

### Changes

**File: `src/components/hr/ServicesView.tsx`** — Add two fields to the `createTransaction` call inside `closeMutation` (~line 169-178):
- `document: "Recibo"`
- `rnc: entry.service_providers.cedula`

That's it — two lines added to a single file.

