## Diagnosis

You suspected the dropdown was being populated from the Cronograma. **It is not** — `FollowUpRulesManager.tsx` already queries `operation_types`, the same table that powers the Operations Log. So the source of truth is already correct.

What's likely happening: a follow-up rule was created using one operation type, but the resulting Cronograma cell text (`followup_text`, e.g. "Herbicida - {field}") looks different than expected. The rule itself is keyed off the Operations registry, not the Cronograma cell text. As long as the operation in the Operations Log uses the right `operation_type`, the rule fires correctly.

## Changes

### 1. Subtitle (cosmetic)
In `src/components/settings/FollowUpRulesManager.tsx` line 204:
- Before: *"Reglas para programar operaciones de seguimiento en el Cronograma"*
- After: *"Reglas para programar operaciones de seguimiento en Operaciones"*

### 2. New column: "Días de Alerta Previa"
Add a new field `alert_days_prior` (INTEGER, default 1) to `operation_followups` representing how many days **before** the scheduled follow-up date the alert should start showing.

**Schema migration:**
```sql
ALTER TABLE public.operation_followups 
  ADD COLUMN alert_days_prior INTEGER NOT NULL DEFAULT 1;
```

**UI updates in `FollowUpRulesManager.tsx`:**
- Add `alert_days_prior` to the `FollowUpRule` interface and form state
- Add a new input in the dialog ("Días de alerta previa") next to "Días después de la operación"
- Add a new column "Alerta (días antes)" in the rules table, between "Días" and "Tractorista"

### 3. No changes to scheduling logic
`src/lib/scheduleFollowUp.ts` stays as-is — `alert_days_prior` is metadata that becomes visible/editable per rule now and can be wired to alerts later. I won't touch the scheduler in this pass since you only asked for the column.

## Files
- `supabase/migrations/<new>.sql` — add `alert_days_prior` column
- `src/components/settings/FollowUpRulesManager.tsx` — subtitle fix, new form field, new table column

## Risk
Very low. Additive column with a safe default; cosmetic UI additions only.