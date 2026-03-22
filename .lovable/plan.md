

## Fix: Benefit Save Error "invalid input syntax for type uuid: undefined"

### Problem
When saving a benefit in the Hoja de Tiempo, the `employee_id` arrives as the literal string `"undefined"` to the database. The most likely cause is a stale closure in the `DebouncedNumberInput` component — the 600ms debounce timer fires after the component has re-rendered with an undefined reference, or before data has fully loaded.

### Root Cause Analysis
The `DebouncedNumberInput` captures `onChange` (which contains `employee.id`) in a `setTimeout`. If the parent re-renders and the closure becomes stale, `employee.id` could resolve to `undefined`. There's no guard in `handleBenefitChange` to prevent saving with an invalid `employee_id`.

### Fix

**`src/components/hr/PayrollTimeGrid.tsx`** — Two changes:

1. **Guard in `handleBenefitChange`** — Early return if `employeeId` is falsy:
   ```typescript
   const handleBenefitChange = (employeeId: string, benefitType: string, value: string) => {
     if (!employeeId) return;  // ← add guard
     const amount = parseFloat(value) || 0;
     saveEmployeeBenefit.mutate({ employee_id: employeeId, benefit_type: benefitType, amount });
   };
   ```

2. **Fix stale closure in `DebouncedNumberInput`** — Use a ref for `onChange` so the timer always calls the latest callback:
   ```typescript
   function DebouncedNumberInput({ value: externalValue, onChange, className }) {
     const [localValue, setLocalValue] = useState(String(externalValue || ""));
     const timerRef = useRef(null);
     const onChangeRef = useRef(onChange);
     onChangeRef.current = onChange;  // always up-to-date

     const handleChange = useCallback((e) => {
       const val = e.target.value;
       setLocalValue(val);
       if (timerRef.current) clearTimeout(timerRef.current);
       timerRef.current = setTimeout(() => onChangeRef.current(val), 600);
     }, []); // stable callback, uses ref
     ...
   }
   ```

### Files Changed

| File | Change |
|------|--------|
| `src/components/hr/PayrollTimeGrid.tsx` | Add guard in `handleBenefitChange`, fix stale closure in `DebouncedNumberInput` |

