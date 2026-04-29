## Prefill company info in Create Letters dialog

Set the company fields in `src/components/hr/EmployeeLetterDialog.tsx` to default to the standard Jord Dominicana values, while remaining editable by the user.

### Change

In the `useState` initializers (lines 69–72), replace empty strings with defaults:

- `companyName` → `"Jord Dominicana, srl"`
- `companyRnc` → `"1-32-21404-8"`
- `companyAddress` → `"Calle Principal #1, Paraje La Yeguada, San José de Los Llanos, SPM"`
- `companyRnl` → unchanged (still empty)

The existing inputs remain regular `<Input>` fields, so values are fully editable per letter.

### Files

- `src/components/hr/EmployeeLetterDialog.tsx`
