

# Add Foreign Key: cronograma_entries → cronograma_weeks

## Plan

### 1. Database migration
Add the FK constraint linking `cronograma_entries.week_ending_date` to `cronograma_weeks.week_ending_date` with `ON DELETE RESTRICT`.

### 2. Update schemaSql.ts
Add the constraint reference to the `cronograma_entries` table definition (line 521).

### Files Modified
- New migration SQL
- `src/components/settings/backup/schemaSql.ts` (line 521)

