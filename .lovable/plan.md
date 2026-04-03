

## Plan: DGII .TXT Download Buttons + RNC Field in Entities

### What We're Building
1. A "Descargar .TXT" button on each DGII tab (606, 607, 608) that calls the new database RPCs and triggers a file download
2. An RNC field in the Entities settings modal
3. A warning banner on the DGII Reports page when the selected entity has no RNC

### Changes

**1. EntitiesManager.tsx — Add RNC field**
- Add `rnc` to `EntityRow` interface and `FormState`
- Include `rnc` in the `select()` query and in both insert/update operations
- Add an "RNC" column to the table display
- Add an "RNC" text input in the dialog (both create and edit modes), with placeholder "9 dígitos" and `maxLength={11}` (to allow formatted input)
- Show helper text: "Requerido para reportes DGII"

**2. DGIIReportsView.tsx — Add RNC warning + pass entity context**
- Import `useEntity` from EntityContext
- Query the selected entity's `rnc` from the `entities` table
- If `selectedEntityId` is set but `rnc` is empty/null, show an `Alert` warning banner: "RNC no configurado para esta entidad. Configúrelo en Configuración → Entidades para generar archivos .TXT de DGII."
- Pass `selectedEntityId` to each DGII table component as a new prop

**3. DGII606Table.tsx — Add .TXT download button**
- Add prop `entityId: string | null`
- Add a `FileText` icon button "Descargar .TXT" in the button row, styled with `variant="outline"` and distinct coloring
- On click: set loading state, call `supabase.rpc('generate_dgii_606', { p_year: year, p_month: month, p_entity_id: entityId })` (cast via `as any` for untyped RPC)
- On success: create `Blob` with `text/plain;charset=utf-8`, trigger download as `606_YYYYMM.txt`
- On error: if message contains "RNC", show toast "RNC no configurado. Configure el RNC de la entidad en Configuración → Entidades." Otherwise show generic error toast
- Disable button when `entityId` is null (consolidated mode — can't generate a single-entity submission file)

**4. DGII607Table.tsx — Same pattern as 606**
- Add `entityId` prop, "Descargar .TXT" button, call `generate_dgii_607` RPC, download as `607_YYYYMM.txt`

**5. DGII608Table.tsx — Same pattern as 606**
- Add `entityId` prop, "Descargar .TXT" button, call `generate_dgii_608` RPC, download as `608_YYYYMM.txt`

### Files Modified
| File | Change |
|------|--------|
| `src/components/settings/EntitiesManager.tsx` | Add RNC field to interface, query, table, and dialog |
| `src/components/accounting/DGIIReportsView.tsx` | Add entity context, RNC warning, pass entityId to tabs |
| `src/components/accounting/DGII606Table.tsx` | Add .TXT download button with RPC call |
| `src/components/accounting/DGII607Table.tsx` | Add .TXT download button with RPC call |
| `src/components/accounting/DGII608Table.tsx` | Add .TXT download button with RPC call |

### Technical Notes
- The three RPCs are already created in the database; we only need to call them from the frontend
- RPC calls use `(supabase.rpc as any)(...)` since the generated types may not include these new functions yet
- The .TXT button is disabled in "All Entities" consolidated mode since DGII submissions are per-entity
- Download uses standard Blob + anchor click pattern already used by the Excel export

