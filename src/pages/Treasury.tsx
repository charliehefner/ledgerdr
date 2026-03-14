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
