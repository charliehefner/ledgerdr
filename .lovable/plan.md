

## Fix: Sidebar Missing on Treasury (and Other Pages) During Auth Loading

### Root Cause
The `ProtectedRoute` component renders a **full-screen spinner without the sidebar** during auth loading (`isLoading === true`). When navigating to Treasury (or any page), if auth state is briefly re-checked, the sidebar disappears and the user sees only a centered spinner. This affects all pages but is most noticeable on slower loads.

### Fix
Move the loading spinner **inside** `MainLayout` so the sidebar is always visible, even during auth loading.

**Option chosen**: Update `ProtectedRoute` to render the loading state wrapped in `MainLayout` instead of a bare full-screen div.

### Changes

**`src/components/auth/ProtectedRoute.tsx`**
- Import `MainLayout` and render the loading spinner inside it, so the sidebar remains visible during auth loading:

```tsx
if (isLoading) {
  return (
    <MainLayout>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </MainLayout>
  );
}
```

This ensures the sidebar is **always** rendered on protected routes, eliminating the flash of missing sidebar on any page load or navigation.

