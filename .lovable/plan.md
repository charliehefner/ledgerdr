

## Fix Login Hang After Successful Authentication

### Root Cause
In `src/pages/Login.tsx`, the `handleSubmit` function sets the component's local `isLoading` state to `true` at the start of login. On the **success** path, it never sets it back to `false`. The navigation `useEffect` depends on `!isLoading`, so it never fires -- the spinner stays forever.

### Fix

**File: `src/pages/Login.tsx`** (1 line change)

In `handleSubmit`, after `toast.success(...)`, add `setIsLoading(false)` so the `useEffect` can trigger navigation:

```typescript
if (result.success) {
  toast.success("Inicio de sesión exitoso");
  setIsLoading(false); // <-- ADD THIS LINE
  // Navigation happens via useEffect once user state updates
} else {
```

That's it -- a one-line fix.

