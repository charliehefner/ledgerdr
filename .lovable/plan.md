

## Add Confirm Delete Dialog to Contact List

Replace the direct `deleteMutation.mutate(c.id)` call on the trash button with an `AlertDialog` confirmation prompt.

### Changes

**`src/pages/Contacts.tsx`**
- Import `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger` from `@/components/ui/alert-dialog`
- Wrap the existing `Trash2` button in an `AlertDialogTrigger` inside an `AlertDialog`
- Show contact name in the confirmation message: "Are you sure you want to delete {name}?"
- Only call `deleteMutation.mutate()` on confirm

