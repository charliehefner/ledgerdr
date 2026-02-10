

## Add Admin Password Reset for Users

### Overview
Allow admins to assign a new password to any user directly from the User Management table in Settings. This is especially important for username-based accounts (those without email) who cannot use the "Forgot Password" email flow.

### How It Works
- A small "key" icon button will appear next to each user in the table (alongside the existing delete button)
- Clicking it opens a dialog where the admin types a new password
- The same password rules apply (8+ characters, at least one letter and one number)
- The password is updated via a new backend function using admin privileges

### Changes

**1. New backend function: `supabase/functions/reset-user-password/index.ts`**
- Accepts `userId` and `newPassword`
- Validates the caller is an admin (same pattern as other admin functions)
- Validates password meets complexity rules
- Uses `adminClient.auth.admin.updateUserById(userId, { password })` to set the new password
- Returns success/error with password-specific messages passed through

**2. Update `src/components/settings/UserManagement.tsx`**
- Add a "Reset Password" icon button (Key icon) in the Actions column for each user
- Add a small dialog with:
  - A password input field (with the same placeholder: "Minimo 8 caracteres (letras y numeros)")
  - Cancel and "Actualizar Contrasena" buttons
- Reuse the same client-side validation logic already in the file
- On success, show toast: "Contrasena actualizada exitosamente"
- The user whose password was reset will need to use the new password on their next login; existing sessions remain active until they expire

### What stays the same
- Existing "Forgot Password" email flow remains available
- Password validation rules are identical for creation and reset
- No database changes needed

