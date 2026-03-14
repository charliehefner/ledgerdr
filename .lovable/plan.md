

## Fix: Treasury Page Missing Sidebar

### Root Cause
`src/pages/Treasury.tsx` renders a bare `<div>` without wrapping in `MainLayout`. Every other page either uses `MainLayout` directly or `TabbedPageLayout` (which internally wraps `MainLayout`). The unused `TabbedPageLayout` import is a leftover.

### Fix
Replace the bare `<div>` wrapper with `MainLayout`, passing title and subtitle as props. Remove unused imports (`TabbedPageLayout`, `useState`).

**File: `src/pages/Treasury.tsx`** — rewrite to:
```tsx
import { MainLayout } from "@/components/layout/MainLayout";
import { TreasuryView } from "@/components/accounting/TreasuryView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Treasury() {
  const { t } = useLanguage();

  return (
    <MainLayout title={t("page.treasury.title")} subtitle={t("page.treasury.subtitle")}>
      <TreasuryView />
    </MainLayout>
  );
}
```

One file, ~12 lines. The sidebar will render correctly on the Treasury route.

