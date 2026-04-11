

## Fix: Industrial and Approvals sidebar items not visible immediately

### Problem
The sidebar items for "Industrial" and "Approvals" appear only after a delay. The permission matrix already grants admin access to both sections. The issue is a race condition in `AuthContext.tsx`: when `onAuthStateChange` fires, it sets the session immediately but fetches the user role asynchronously via `setTimeout`. During this gap, the sidebar renders without a role, hiding role-gated items.

### Root Cause
In `AuthContext.tsx` line 124-145, the `onAuthStateChange` handler:
1. Sets `session` immediately (line 128)
2. Defers role fetch to a `setTimeout` (line 132)

This creates a window where the component tree re-renders with a session but no `user.role`, causing `canAccessSection()` to return `false` for all items.

### Plan

**File: `src/contexts/AuthContext.tsx`**

Preserve the existing `user` state during auth state changes instead of allowing it to go stale. When `onAuthStateChange` fires for a token refresh (same user), keep the current user object while the role re-fetches in the background. Only clear `user` on explicit sign-out events.

Specifically:
- In the `onAuthStateChange` callback, check if `currentSession?.user.id` matches the existing `user?.id`. If so, skip resetting user state — the role is already known.
- Only trigger a new role fetch when the user ID actually changes (new login) or on `SIGNED_IN` events.
- On `SIGNED_OUT`, clear user state as before.

This is a ~10-line change in `AuthContext.tsx` with no other file modifications needed.

