import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDescription } from "@/lib/getDescription";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { BudgetGrid } from "@/components/budget/BudgetGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Budget() {
  const { language, t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("pl");

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-budget"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("code");
      return data || [];
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const tabs = [
    {
      value: "pl",
      label: t("budget.pl"),
      content: <BudgetGrid budgetType="pl" fiscalYear={fiscalYear} />,
    },
    ...projects.map(p => ({
      value: p.code,
      label: `${p.code} — ${getDescription(p, language)}`,
      content: <BudgetGrid budgetType="project" projectCode={p.code} fiscalYear={fiscalYear} />,
    })),
  ];

  const yearSelector = (
    <Select value={String(fiscalYear)} onValueChange={v => setFiscalYear(Number(v))}>
      <SelectTrigger className="w-28 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map(y => (
          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <TabbedPageLayout
      title={t("page.budget.title")}
      subtitle={t("page.budget.subtitle")}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabGroups={[{ tabs }]}
      actions={yearSelector}
    />
  );
}
