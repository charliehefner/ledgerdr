

## Fix: Treasury Page Missing Sidebar

The file `src/pages/Treasury.tsx` still renders a bare `<div>` instead of wrapping in `MainLayout`. This is why the sidebar disappears.

### Change

**`src/pages/Treasury.tsx`** — replace entire file:
- Import `MainLayout` instead of `TabbedPageLayout`
- Remove unused `useState` import
- Wrap content in `<MainLayout>` with title/subtitle props

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

One file, minimal change.

