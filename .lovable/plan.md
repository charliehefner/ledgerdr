

## Plan: Debounce Payroll Inputs

### Problem
Two input types in PayrollTimeGrid fire a Supabase mutation on every keystroke:
- **TimeInput** (hours/minutes): typing "12" fires two saves ("1" then "12")
- **Benefit inputs** (Teléfono, Gasolina, Bono): typing "500" fires three saves ("5", "50", "500")

This causes unnecessary network requests and potential race conditions.

### Fix

**1. Debounce TimeInput (`TimeInput.tsx`)**
- Store hours/minutes/period as local state (already done)
- Instead of calling `onChange(time24)` synchronously inside `handleChange`, debounce the `onChange` callback with ~600ms delay
- Use a `useRef` + `setTimeout` pattern (no new dependencies)
- Clear pending timeout on unmount

**2. Debounce Benefit Inputs (`PayrollTimeGrid.tsx`)**
- Create a small `DebouncedNumberInput` inline component that:
  - Keeps a local `useState` for the input value
  - Calls the parent `onChange` after 600ms of inactivity
  - Syncs from props when the external value changes (via `useEffect`)
- Replace the raw `<Input>` in the benefit columns with this component

### Files changed

| File | Change |
|------|--------|
| `src/components/hr/TimeInput.tsx` | Debounce the `onChange` callback (~600ms) |
| `src/components/hr/PayrollTimeGrid.tsx` | Wrap benefit inputs in a debounced component |

No database changes. No new dependencies.

