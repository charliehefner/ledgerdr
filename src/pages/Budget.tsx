import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDescription } from "@/lib/getDescription";
import { TabbedPageLayout } from "@/components/layout/TabbedPageLayout";
import { BudgetGrid } from "@/components/budget/BudgetGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Budget() {
  const { language, t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("pl");
  const [showInactive, setShowInactive] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newEnDesc, setNewEnDesc] = useState("");
  const [newEsDesc, setNewEsDesc] = useState("");
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-for-budget"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("code");
      return data || [];
    },
  });

  const visibleProjects = showInactive
    ? allProjects
    : allProjects.filter(p => p.is_active !== false);

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("projects").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects-for-budget"] });
      toast.success(t("budget.projectUpdated"));
    },
  });

  const addProjectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        code: newCode.trim(),
        english_description: newEnDesc.trim(),
        spanish_description: newEsDesc.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects-for-budget"] });
      toast.success(t("budget.projectAdded"));
      setAddDialogOpen(false);
      setNewCode("");
      setNewEnDesc("");
      setNewEsDesc("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const tabs = [
    {
      value: "pl",
      label: t("budget.pl"),
      content: <BudgetGrid budgetType="pl" fiscalYear={fiscalYear} />,
    },
    ...visibleProjects.map(p => ({
      value: p.code,
      label: `${p.code} — ${getDescription(p, language)}`,
      content: (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant={p.is_active !== false ? "outline" : "default"}
              size="sm"
              onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: p.is_active === false })}
            >
              {p.is_active !== false ? t("budget.deactivate") : t("budget.activate")}
            </Button>
          </div>
          <BudgetGrid budgetType="project" projectCode={p.code} fiscalYear={fiscalYear} />
        </div>
      ),
    })),
  ];

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setShowInactive(!showInactive)}>
        {showInactive ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
        {showInactive ? t("budget.hideInactive") : t("budget.showInactive")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {t("budget.addProject")}
      </Button>
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
    </div>
  );

  return (
    <>
      <TabbedPageLayout
        title={t("page.budget.title")}
        subtitle={t("page.budget.subtitle")}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabGroups={[{ tabs }]}
        actions={actions}
      />
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("budget.addProject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("budget.projectCode")}</Label>
              <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. PRJ-001" />
            </div>
            <div>
              <Label>{t("budget.englishDesc")}</Label>
              <Input value={newEnDesc} onChange={e => setNewEnDesc(e.target.value)} />
            </div>
            <div>
              <Label>{t("budget.spanishDesc")}</Label>
              <Input value={newEsDesc} onChange={e => setNewEsDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addProjectMutation.mutate()} disabled={!newCode.trim() || addProjectMutation.isPending}>
              {t("budget.addProject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
