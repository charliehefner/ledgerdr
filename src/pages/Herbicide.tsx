import { MainLayout } from "@/components/layout/MainLayout";
import { HerbicideCalculation } from "@/components/herbicide/HerbicideCalculation";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Herbicide() {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("herbicide.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("herbicide.subtitle")}
          </p>
        </div>
        <HerbicideCalculation />
      </div>
    </MainLayout>
  );
}
