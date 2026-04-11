import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Pencil, MapPin, Layers, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { KMLImportDialog } from "./KMLImportDialog";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { useLanguage } from "@/contexts/LanguageContext";

interface Farm {
  id: string;
  name: string;
  is_active: boolean;
}

interface Field {
  id: string;
  name: string;
  farm_id: string;
  hectares: number | null;
  is_active: boolean;
  boundary: unknown;
  farms: { name: string };
}

export function FarmsFieldsView() {
  const { t } = useLanguage();
  const [isFarmDialogOpen, setIsFarmDialogOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [isKMLDialogOpen, setIsKMLDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [farmForm, setFarmForm] = useState({ name: "" });
  const [fieldForm, setFieldForm] = useState({ name: "", farm_id: "", hectares: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();

  const { data: farms, isLoading: farmsLoading } = useQuery({
    queryKey: ["farms", selectedEntityId],
    queryFn: async () => {
      let q: any = supabase.from("farms").select("*").order("name");
      q = applyEntityFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data as Farm[];
    },
  });

  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ["fields", selectedEntityId],
    queryFn: async () => {
      let q = supabase.from("fields").select("*, farms(name)").order("name");
      q = applyEntityFilter(q as any);
      const { data, error } = await q;
      if (error) throw error;
      return data as Field[];
    },
  });

  const removeBoundaryMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase.from("fields").update({ boundary: null } as any).eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      queryClient.invalidateQueries({ queryKey: ["fields-with-boundaries"] });
      toast({ title: t("farms.boundaryRemoved"), description: t("farms.boundaryRemovedDesc") });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const farmMutation = useMutation({
    mutationFn: async (data: typeof farmForm) => {
      if (editingFarm) {
        const { error } = await supabase.from("farms").update({ name: data.name }).eq("id", editingFarm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("farms").insert({ name: data.name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      toast({
        title: editingFarm ? t("farms.farmUpdated") : t("farms.farmAdded"),
        description: t("farms.farmSavedDesc").replace("{name}", farmForm.name),
      });
      handleCloseFarmDialog();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fieldMutation = useMutation({
    mutationFn: async (data: typeof fieldForm) => {
      const record = {
        name: data.name,
        farm_id: data.farm_id,
        hectares: data.hectares ? parseFloat(data.hectares) : null,
      };
      if (editingField) {
        const { error } = await supabase.from("fields").update(record).eq("id", editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fields").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      toast({
        title: editingField ? t("farms.fieldUpdated") : t("farms.fieldAdded"),
        description: t("farms.farmSavedDesc").replace("{name}", fieldForm.name),
      });
      handleCloseFieldDialog();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditFarm = (farm: Farm) => {
    setEditingFarm(farm);
    setFarmForm({ name: farm.name });
    setIsFarmDialogOpen(true);
  };

  const handleEditField = (field: Field) => {
    setEditingField(field);
    setFieldForm({ name: field.name, farm_id: field.farm_id, hectares: field.hectares?.toString() || "" });
    setIsFieldDialogOpen(true);
  };

  const handleCloseFarmDialog = () => {
    setIsFarmDialogOpen(false);
    setEditingFarm(null);
    setFarmForm({ name: "" });
  };

  const handleCloseFieldDialog = () => {
    setIsFieldDialogOpen(false);
    setEditingField(null);
    setFieldForm({ name: "", farm_id: "", hectares: "" });
  };

  const handleFarmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmForm.name) {
      toast({ title: t("farms.validationError"), description: t("farms.enterFarmName"), variant: "destructive" });
      return;
    }
    farmMutation.mutate(farmForm);
  };

  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.name || !fieldForm.farm_id) {
      toast({ title: t("farms.validationError"), description: t("farms.fillRequired"), variant: "destructive" });
      return;
    }
    fieldMutation.mutate(fieldForm);
  };

  const fieldsByFarm = farms?.reduce((acc, farm) => {
    acc[farm.id] = fields?.filter((f) => f.farm_id === farm.id) || [];
    return acc;
  }, {} as Record<string, Field[]>);

  if (farmsLoading || fieldsLoading) {
    return <div className="text-center py-8">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setIsKMLDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          {t("farms.importBoundaries")}
        </Button>
        <Dialog open={isFarmDialogOpen} onOpenChange={setIsFarmDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("farms.addFarm")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFarm ? t("farms.editFarm") : t("farms.newFarm")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFarmSubmit} className="space-y-4">
              <div>
                <Label>{t("farms.farmName")}</Label>
                <Input
                  value={farmForm.name}
                  onChange={(e) => setFarmForm({ name: e.target.value })}
                  placeholder={t("farms.farmNamePlaceholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseFarmDialog}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={farmMutation.isPending}>
                  {farmMutation.isPending ? t("farms.saving") : editingFarm ? t("farms.update") : t("farms.addFarm")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("farms.addField")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingField ? t("farms.editField") : t("farms.newField")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFieldSubmit} className="space-y-4">
              <div>
                <Label>{t("progress.farm")} *</Label>
                <Select value={fieldForm.farm_id} onValueChange={(value) => setFieldForm({ ...fieldForm, farm_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("farms.selectFarm")} />
                  </SelectTrigger>
                  <SelectContent>
                    {farms?.map((farm) => (
                      <SelectItem key={farm.id} value={farm.id}>{farm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("farms.fieldName")}</Label>
                <Input
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder={t("farms.fieldNamePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("farms.hectares")}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={fieldForm.hectares}
                  onChange={(e) => setFieldForm({ ...fieldForm, hectares: e.target.value })}
                  placeholder={t("farms.optional")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseFieldDialog}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={fieldMutation.isPending}>
                  {fieldMutation.isPending ? t("farms.saving") : editingField ? t("farms.update") : t("farms.addField")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!farms || farms.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t("farms.noFarms")}
          description={t("farms.noFarmsDesc")}
        />
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {farms.map((farm) => (
            <AccordionItem key={farm.id} value={farm.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">{farm.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {fieldsByFarm?.[farm.id]?.length || 0} {t("farms.fields")}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-2"
                    onClick={(e) => { e.stopPropagation(); handleEditFarm(farm); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {fieldsByFarm?.[farm.id]?.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2 pl-7">
                    {t("farms.noFieldsYet")}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("farms.th.fieldName")}</TableHead>
                        <TableHead>{t("farms.th.hectares")}</TableHead>
                        <TableHead className="w-[60px]">{t("farms.th.edit")}</TableHead>
                        <TableHead className="w-[120px]">{t("farms.th.boundary")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fieldsByFarm?.[farm.id]?.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Layers className="h-3 w-3 text-muted-foreground" />
                              {field.name}
                            </div>
                          </TableCell>
                          <TableCell>{field.hectares ? `${field.hectares} ha` : "-"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditField(field)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            {field.boundary ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-destructive hover:text-destructive"
                                onClick={() => removeBoundaryMutation.mutate(field.id)}
                                disabled={removeBoundaryMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {t("farms.removeBoundary")}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <div className="text-sm text-muted-foreground">
        {t("farms.totalSummary").replace("{farms}", String(farms?.length || 0)).replace("{fields}", String(fields?.length || 0))}
      </div>

      <KMLImportDialog open={isKMLDialogOpen} onOpenChange={setIsKMLDialogOpen} />
    </div>
  );
}
