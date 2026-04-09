

## HR Letter Generator — Hiring & Termination Letters

### Overview
Add a "Cartas" (Letters) section to the HR module that lets users generate formatted PDF letters for hiring and termination, automatically stored in the employee's document directory.

### How It Works

1. **New tab or action in Employee Detail Dialog** — a "Generar Carta" button opens a letter wizard
2. **Two letter types:**
   - **Contratación (Hiring):** Fields pre-filled from employee record (name, cédula, position, salary, start date) with editable benefits/conditions
   - **Terminación (Termination):** Date and motive (Renuncia / Despido / Mutuo Acuerdo), with reason details
3. **PDF Generation:** Uses your uploaded template format, with company branding from the project
4. **Auto-storage:** Generated PDF is saved to the `employee-documents` bucket under the employee's directory and linked in `employee_documents` table
5. **Re-upload signed copy:** The existing document upload functionality already supports replacing — we'll add a "Subir copia firmada" action next to the generated letter

### Technical Approach

| Component | Detail |
|-----------|--------|
| Letter form UI | New `EmployeeLetterDialog.tsx` component with hiring/termination modes |
| PDF generation | Edge function using your template format (server-side, consistent output) |
| Storage | Existing `employee-documents` bucket + `employee_documents` table |
| Access | Available from Employee Detail Dialog, restricted by role permissions |
| Template | Will replicate your uploaded format exactly |

### Files to Create/Modify
- `src/components/hr/EmployeeLetterDialog.tsx` — letter form UI
- `supabase/functions/generate-hr-letter/index.ts` — PDF generation edge function
- `src/components/hr/EmployeeDetailDialog.tsx` — add "Generar Carta" button
- Database migration — add `letter_type` and `letter_metadata` columns to `employee_documents` (to distinguish generated letters from regular uploads)

### Next Step
**Upload your template(s)** (PDF or Word) and I'll match the format precisely in the generator.

