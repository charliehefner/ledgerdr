

## Auto-Insert Follow-Up Operations into the Schedule

### What it does
When an operation is logged (e.g., "Retapado" on field CY03), the system automatically creates a follow-up entry in the Cronograma (e.g., "Herbicida - CY03") on the correct future date, placed on a designated tractor driver's row. If that slot is already occupied, it shifts to the next available morning/afternoon slot on the same or following days.

### Configuration

A new database table `operation_followups` stores the rules:

| trigger_operation_type_id | followup_text | days_offset | default_driver_id |
|---|---|---|---|
| Retapado | Herbicida - {field} | 3 | (selected driver) |
| Cosecha | Fertilización - {field} | 45 | (selected driver) |

A simple management UI in **Settings** allows adding/editing/removing follow-up rules with:
- Trigger operation type (dropdown)
- Follow-up task text (with `{field}` placeholder)
- Days offset (number input)
- Default driver (dropdown of Tractorista employees)

### Slot placement logic

1. Calculate target date = operation_date + days_offset
2. Determine the week (Saturday) the target date falls in
3. Determine the day_of_week (1=Mon ... 6=Sat)
4. Try to place in the **morning** slot for the designated driver on that day
5. If occupied, try **afternoon**
6. If both occupied, move to the next day's morning, then afternoon, etc.
7. Stop searching after 3 days of overflow (flag the user with a toast warning if no slot found)

### Trigger point

When saving a new operation in `OperationsLogView`, after the successful insert:
- Check if the operation_type_id matches any rule in `operation_followups`
- If yes, run the slot-finding algorithm and insert a `cronograma_entries` row
- Show a toast: "Follow-up scheduled: Herbicida - CY03 on Wed 19/2 (AM) for Edy Rodriguez"

### Stability considerations

- **No data loss risk**: follow-ups only INSERT new cronograma entries; they never overwrite existing ones
- **Idempotent**: if the same operation is edited (not re-created), no duplicate follow-ups are generated. A `source_operation_id` column on `cronograma_entries` tracks which operation triggered it, preventing duplicates.
- **Closed weeks**: if the target week is already closed, the follow-up is skipped with a warning toast
- **Defensive**: all slot-finding is bounded (max 3 days overflow), so it cannot loop infinitely

### Technical Details

**New table: `operation_followups`**
```sql
CREATE TABLE operation_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_operation_type_id UUID NOT NULL REFERENCES operation_types(id),
  followup_text TEXT NOT NULL,
  days_offset INTEGER NOT NULL DEFAULT 3,
  default_driver_id UUID REFERENCES employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Alter `cronograma_entries`** -- add tracking column:
```sql
ALTER TABLE cronograma_entries 
  ADD COLUMN source_operation_id UUID REFERENCES operations(id);
```

**New files:**
- `src/components/settings/FollowUpRulesManager.tsx` -- CRUD UI for rules (added as a section in Settings page)
- `src/lib/scheduleFollowUp.ts` -- pure logic: given a target date and driver name, query existing cronograma entries for that week, find first available slot, insert

**Modified files:**
- `src/components/operations/OperationsLogView.tsx` -- after successful operation insert, call `scheduleFollowUp()` if a matching rule exists
- `src/pages/Settings.tsx` -- add the Follow-Up Rules section
