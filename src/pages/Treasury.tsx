import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { TreasuryView } from "@/components/accounting/TreasuryView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";

export default function Treasury() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("page.treasury.title")}</h1>
        <p className="text-muted-foreground">{t("page.treasury.subtitle")}</p>
      </div>
      <TreasuryView />
    </div>
  );
}
