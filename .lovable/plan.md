

## Customizable Hiring Letter Clauses

### Problem
The current hiring letter has a single "Beneficios" textarea field, but you need to specify multiple structured clauses: specific benefits (telephone, gas), responsibilities, and other considerations — each as separate numbered paragraphs in the contract.

### Solution
Replace the single benefits textarea with a **dynamic clause builder** in the Contrato tab. You can add, remove, reorder, and edit multiple clauses (SEGUNDO, TERCERO, CUARTO, etc.) before generating.

### UI Changes — `EmployeeLetterDialog.tsx`

- Remove the single `benefits` textarea
- Add a "Cláusulas Adicionales" section with:
  - Each clause has a **title dropdown** (Beneficios, Responsabilidades, Condiciones, Otro) and a **free-text body**
  - "Agregar Cláusula" button to add more
  - Delete button on each clause
  - Clauses auto-number as SEGUNDO, TERCERO, etc. in the PDF
- Pre-populated template snippets available (e.g., "Teléfono celular", "Gastos de combustible", "Vehículo de la empresa") as quick-add buttons

### Backend Changes — `generate-hr-letter/index.ts`

- Replace the single `benefits` string with a `clauses` array: `{ title: string, body: string }[]`
- Each clause renders as a numbered paragraph (SEGUNDO, TERCERO, CUARTO...) before the trial period and closing sections
- The trial period clause auto-adjusts its numbering based on how many custom clauses precede it

### Data Flow
```text
UI: clauses = [
  { title: "Beneficios", body: "EL TRABAJADOR recibe teléfono celular..." },
  { title: "Responsabilidades", body: "EL TRABAJADOR será responsable de..." },
  { title: "Condiciones", body: "El horario de trabajo será..." }
]
→ PDF: SEGUNDO: EL TRABAJADOR recibe teléfono celular...
        TERCERO: EL TRABAJADOR será responsable de...
        CUARTO: El horario de trabajo será...
        QUINTO: EL TRABAJADOR hará un periodo de prueba de 3 meses.
```

### Files to Modify
- `src/components/hr/EmployeeLetterDialog.tsx` — dynamic clause builder UI
- `supabase/functions/generate-hr-letter/index.ts` — accept `clauses[]` array, render numbered paragraphs

