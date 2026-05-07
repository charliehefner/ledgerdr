## Change

**File:** `src/components/hr/EmployeeLetterDialog.tsx` (line 38)

Update the "Horario de trabajo" quick-add clause template:

- From: "lunes a viernes de 8:00 AM a 5:00 PM y sábados de 8:00 AM a 12:00 PM"
- To: **"lunes a viernes de 7:30 AM a 4:30 PM y sábados de 7:30 AM a 11:30 AM"**

## Notes
- This only affects the default text inserted when the user clicks the "Horario de trabajo" template button on new contracts. Already-generated PDFs are unchanged.
- No other files reference these hours; no DB or i18n changes needed.