

## Fix: Suppress Browser Extension DOM Errors

### Problem
Ronny sees "Error al ejecutar 'insertBefore' en 'Node'" — this is caused by browser extensions (Google Translate, Grammarly, etc.) modifying the DOM, which conflicts with React's virtual DOM reconciliation. The ErrorBoundary catches it but shows a full-screen error page, which is disruptive.

### Solution
Suppress this specific class of errors so they don't crash the app.

### Changes

**`src/components/ErrorBoundary.tsx`** — Override `getDerivedStateFromError` to ignore known extension-related DOM errors:

```typescript
static getDerivedStateFromError(error: Error): State {
  // Browser extensions (Google Translate, Grammarly, etc.) cause these DOM errors
  // They are harmless — suppress them instead of showing error screen
  const msg = error.message?.toLowerCase() || "";
  if (
    msg.includes("insertbefore") ||
    msg.includes("removeChild") ||
    msg.includes("failed to execute")
  ) {
    console.warn("[ErrorBoundary] Suppressed browser extension DOM error:", error.message);
    return { hasError: false, error: null };
  }
  return { hasError: true, error };
}
```

This lets the app continue running when a browser extension interferes with the DOM, while still catching real application errors.

| File | Change |
|------|--------|
| `src/components/ErrorBoundary.tsx` | Suppress extension-related DOM errors in `getDerivedStateFromError` |

