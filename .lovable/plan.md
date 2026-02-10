

## Fix: Password Validation Sync (Forward-Only)

Existing users with letter-only passwords are unaffected. Password validation only executes during user creation and password reset -- never retroactively against stored credentials.

### Changes

**1. `src/components/settings/UserManagement.tsx`**
- Update client-side validation from `length >= 6` to match edge function rules:
  - Minimum 8 characters
  - At least one letter and one number
- Show clear error toast in Spanish before the request is sent, e.g.:
  - "La contrasena debe tener al menos 8 caracteres"
  - "La contrasena debe contener al menos una letra y un numero"

**2. `supabase/functions/create-user/index.ts`**
- Update `sanitizeError` to pass through password-related error messages instead of masking them as "Operation failed"
- Add condition: if error message contains "password" (case-insensitive), return the original message

### What stays the same
- Existing users log in with their current passwords without issue
- Password reset flow (handled by the auth system) has its own separate validation
- No database changes needed

