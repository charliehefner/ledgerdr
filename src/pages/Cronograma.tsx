import { MainLayout } from "@/components/layout/MainLayout";
import { CronogramaGrid } from "@/components/cronograma/CronogramaGrid";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Cronograma() {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.cronograma.title")}</h1>
          <p className="text-muted-foreground">{t("page.cronograma.subtitle")}</p>
        </div>
        
        <CronogramaGrid />
      </div>
    </MainLayout>
  );
}
