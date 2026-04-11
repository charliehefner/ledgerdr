import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Wand2 } from "lucide-react";
import { EntitySetupWizard } from "./EntitySetupWizard";
import { EntityGroupsManager } from "./EntityGroupsManager";

interface EntityGroup {
  id: string;
  name: string;
  code: string;
}

interface EntityRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  country_code: string;
  currency: string;
  is_active: boolean;
  rnc: string | null;
  tss_nomina_code: string | null;
  entity_group_id: string | null;
}

interface FormState {
  name: string;
  code: string;
  description: string;
  country_code: string;
  currency: string;
  is_active: boolean;
  rnc: string;
  tss_nomina_code: string;
  entity_group_id: string;
}

const emptyForm: FormState = {
  name: "",
  code: "",
  description: "",
  country_code: "DO",
  currency: "DOP",
  is_active: true,
  rnc: "",
  tss_nomina_code: "001",
  entity_group_id: "__none__",
};

export function EntitiesManager() {
  const { t } = useLanguage();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [wizardEntity, setWizardEntity] = useState<EntityRow | null>(null);
  const [entityDataCounts, setEntityDataCounts] = useState<Record<string, number>>({});
  const [groups, setGroups] = useState<EntityGroup[]>([]);

  const fetchEntities = async () => {
    setLoading(true);
    const [{ data, error }, { data: groupsData }] = await Promise.all([
      supabase
        .from("entities")
        .select("id, name, code, description, country_code, currency, is_active, rnc, tss_nomina_code, entity_group_id")
        .order("code"),
      supabase.from("entity_groups").select("id, name, code").order("code"),
    ]);
    if (groupsData) setGroups(groupsData);
    if (error) {
      toast.error("Error loading entities");
      console.error(error);
    } else {
      setEntities(data || []);
      // Check data counts for each entity to determine if wizard button should show
      const counts: Record<string, number> = {};
      for (const ent of data || []) {
        const { count: txCount } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", ent.id);
        const { count: empCount } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", ent.id);
        counts[ent.id] = (txCount || 0) + (empCount || 0);
      }
      setEntityDataCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (e: EntityRow) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      code: e.code,
      description: e.description || "",
      country_code: e.country_code,
      currency: e.currency,
      is_active: e.is_active,
      rnc: e.rnc || "",
      tss_nomina_code: e.tss_nomina_code || "001",
      entity_group_id: e.entity_group_id || "__none__",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t("entities.nameCodeRequired"));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const groupId = form.entity_group_id === "__none__" ? null : form.entity_group_id;
        const { error } = await supabase
          .from("entities")
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null,
            is_active: form.is_active,
            rnc: form.rnc.trim() || null,
            tss_nomina_code: form.tss_nomina_code.trim() || "001",
            entity_group_id: groupId,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success(t("entities.updated"));
        setDialogOpen(false);
        fetchEntities();
      } else {
        const groupId = form.entity_group_id === "__none__" ? null : form.entity_group_id;
        const { data: inserted, error } = await supabase.from("entities").insert({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || null,
          country_code: form.country_code.trim() || "DO",
          currency: form.currency.trim() || "DOP",
          rnc: form.rnc.trim() || null,
          entity_group_id: groupId,
        }).select().single();
        if (error) {
          if (error.code === "23505") {
            toast.error(t("entities.codeExists"));
          } else {
            throw error;
          }
          return;
        }
        toast.success(t("entities.created"));
        setDialogOpen(false);
        await fetchEntities();
        if (inserted) {
          setWizardEntity(inserted as EntityRow);
        }
      }
    } catch (err: any) {
      toast.error(err.message || t("entities.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <EntityGroupsManager />

      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("settings.entities")}</h3>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("entities.new")}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("entities.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("entities.group")}</TableHead>
              <TableHead>RNC</TableHead>
              <TableHead>{t("entities.country")}</TableHead>
              <TableHead>{t("entities.currency")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : entities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {t("entities.noEntities")}
                </TableCell>
              </TableRow>
            ) : (
              entities.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono font-medium">{e.code}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>
                    {e.entity_group_id ? (
                      <Badge variant="outline" className="text-xs">
                        {groups.find(g => g.id === e.entity_group_id)?.code || "—"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("entities.independent")}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.rnc || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{e.country_code}</TableCell>
                  <TableCell>{e.currency}</TableCell>
                  <TableCell>
                    <Badge variant={e.is_active ? "default" : "secondary"}>
                      {e.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(entityDataCounts[e.id] || 0) === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setWizardEntity(e)}
                          title={t("entities.setupWizard")}
                        >
                          <Wand2 className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("entities.edit") : t("entities.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("common.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mi Empresa S.R.L."
              />
            </div>
            <div className="space-y-2">
              <Label>{t("entities.code")} *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="E2"
                disabled={!!editingId}
                className="font-mono"
              />
              {!editingId && (
                <p className="text-xs text-muted-foreground">{t("entities.codeHint")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>RNC</Label>
              <Input
                value={form.rnc}
                onChange={(e) => setForm((f) => ({ ...f, rnc: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="9 dígitos"
                maxLength={11}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{t("entities.rncHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("entities.tssCode")}</Label>
              <Input
                value={form.tss_nomina_code}
                onChange={(e) => setForm((f) => ({ ...f, tss_nomina_code: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="001"
                maxLength={3}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{t("entities.tssCodeHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("entities.optional")}
              />
            </div>
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label>{t("entities.intercompanyGroup")}</Label>
                <Select
                  value={form.entity_group_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, entity_group_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("entities.noGroup")}</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.code} — {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("entities.groupHint")}
                </p>
              </div>
            )}
            {!editingId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("entities.country")}</Label>
                  <Input
                    value={form.country_code}
                    onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
                    placeholder="DO"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("entities.currency")}</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    placeholder="DOP"
                    maxLength={3}
                  />
                </div>
              </div>
            )}
            {editingId && (
              <div className="flex items-center justify-between">
                <Label>{t("common.active")}</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {wizardEntity && (
        <EntitySetupWizard
          open={!!wizardEntity}
          onOpenChange={(open) => { if (!open) setWizardEntity(null); }}
          entityId={wizardEntity.id}
          entityName={wizardEntity.name}
          entityCode={wizardEntity.code}
          onComplete={() => { setWizardEntity(null); fetchEntities(); }}
        />
       )}
      </div>
    </div>
  );
}