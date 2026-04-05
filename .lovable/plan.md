

## Add Edit Capability to Telegram Recipients

### Problem
Once a recipient is added, there's no way to change their label or alert categories without deleting and re-adding them.

### Solution
Add an inline edit mode to each recipient card in `TelegramSettings.tsx`:

**File: `src/components/settings/TelegramSettings.tsx`**

1. Add an **Edit** button (pencil icon) next to each recipient's action buttons
2. When clicked, the recipient card expands to show:
   - Editable label input
   - Category checkboxes (same grid as the "add" form)
   - Save / Cancel buttons
3. On save, update the `telegram_recipients` row via Supabase
4. Track editing state with `editingId` in component state

### Technical Details
- Add `editingId: string | null` state
- Add `editCategories: string[]` and `editLabel: string` state
- Reuse the existing `toggleCategory` logic for the edit form
- Update via `supabase.from("telegram_recipients").update({ label, categories }).eq("id", id)`
- On success, update local state and clear editing mode

Single file change, no database migration needed.

