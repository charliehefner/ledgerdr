
## Budget Sub-Lines Feature

### Database Change
Add to `budget_lines` table:
- `parent_line_id UUID` — self-referencing FK to `budget_lines.id` (null = top-level account row)
- `sub_label TEXT` — display name for the sub-line (e.g., "Office Rent", "Land Contract A")

### UI Changes (BudgetGrid.tsx)
1. **"+" button** on any editable account row to add a sub-line
2. **Expand/collapse** chevron appears when sub-lines exist
3. Sub-lines render indented below their parent with their `sub_label`
4. **Parent row becomes read-only** when sub-lines exist — its monthly values auto-sum from children
5. Sub-lines are individually editable (same inline edit as current rows)
6. **Delete** button on each sub-line; deleting the last one restores the parent to normal editable mode
7. **Add Sub-Line dialog**: simple input for the label, creates a new `budget_lines` row with `parent_line_id` set

### Logic
- When fetching budget data, include sub-lines (where `parent_line_id IS NOT NULL`)
- Group sub-lines under their parent by `parent_line_id`
- Parent monthly values = SUM of children's monthly values (computed client-side)
- Actual column logic unchanged — actuals only show on the parent account code level

### Files to modify
- **Migration**: Add `parent_line_id` and `sub_label` columns
- **BudgetGrid.tsx**: Expand/collapse UI, auto-sum logic, add/delete sub-line actions
