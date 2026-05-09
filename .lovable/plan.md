## Problem

After registering credit card payment **#639**, the "Nuevo Pago de Tarjeta de Crédito" form did not fully clear:

- **Banco/Caja Origen** and **Tarjeta de Crédito** selects kept showing the previous selections (visually).
- Internally the state was reset, but the Radix `<Select>` trigger label stayed displayed.
- When the user filled in the new date and amount and clicked **Registrar Pago**, the button stayed disabled (gray) because internal state for those two selects is actually empty (`""`), so `isValid()` returns false.

This is the classic Radix Select desync that happens when a controlled value transitions from a real id back to `undefined` while the component instance stays mounted.

## Fix

In `src/components/accounting/CreditCardPaymentsView.tsx`:

1. Add a `formKey` counter to component state.
2. Wrap the `<form>` with `key={formKey}` so every successful submit (or **Limpiar** click) fully unmounts and remounts the inputs/selects/calendar — guaranteeing they reflect the cleared state.
3. After a successful RPC call: `setForm({ ...initialState })` (fresh object, not the shared reference) and `setFormKey(k => k + 1)`.
4. Apply the same on the **Limpiar** button.

No backend, RPC, or accounting logic changes — purely a UI state-reset fix.

## Verification

- Register a CC payment → confirm date, both selects, amount, and description all visibly clear.
- Immediately register a second CC payment without refreshing → **Registrar Pago** activates as soon as the required fields are filled.
- Edit / posted-flag / recent list behavior unchanged.
