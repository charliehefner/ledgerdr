import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { AccountDimensionRulesPanel } from "@/components/settings/AccountDimensionRulesPanel";

interface Dimension {
  id: string;
  entity_id: string | null;
  code: string;
  name_es: string;
  name_en: string;
  is_required_default: boolean;
  display_order: number;
  active: boolean;
}

interface DimensionValue {
  id: string;
  dimension_id: string;
  code: string;
  name_es: string;
  name_en: string;
  active: boolean;
  display_order: number;
}

export function DimensionsManager() {
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [selectedDim, setSelectedDim] = useState<string | null>(null);
  const [dimDialogOpen, setDimDialogOpen] = useState(false);
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [newDim, setNewDim] = useState({ code: "", name_es: "", name_en: "", is_required_default: false });
  const [newValue, setNewValue] = useState({ code: "", name_es: "", name_en: "" });

  const { data: dimensions = [] } = useQuery<Dimension[]>({
    queryKey: ["accounting_dimensions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_dimensions" as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as Dimension[];
    },
  });

  const { data: values = [] } = useQuery<DimensionValue[]>({
    queryKey: ["accounting_dimension_values", selectedDim],
    enabled: !!selectedDim,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_dimension_values" as any)
        .select("*")
        .eq("dimension_id", selectedDim!)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as DimensionValue[];
    },
  });

  const createDim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounting_dimensions" as any).insert({
        ...newDim,
        active: true,
        display_order: (dimensions.length + 1) * 10,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: language === "en" ? "Dimension created" : "Dimensión creada" });
      qc.invalidateQueries({ queryKey: ["accounting_dimensions"] });
      setDimDialogOpen(false);
      setNewDim({ code: "", name_es: "", name_en: "", is_required_default: false });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleDimActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("accounting_dimensions" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounting_dimensions"] }),
  });

  const createValue = useMutation({
    mutationFn: async () => {
      if (!selectedDim) return;
      const { error } = await supabase.from("accounting_dimension_values" as any).insert({
        ...newValue,
        dimension_id: selectedDim,
        active: true,
        display_order: (values.length + 1) * 10,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: language === "en" ? "Value added" : "Valor agregado" });
      qc.invalidateQueries({ queryKey: ["accounting_dimension_values", selectedDim] });
      setValueDialogOpen(false);
      setNewValue({ code: "", name_es: "", name_en: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteValue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounting_dimension_values" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounting_dimension_values", selectedDim] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const dimName = (d: Dimension) => (language === "en" ? d.name_en : d.name_es);
  const valName = (v: DimensionValue) => (language === "en" ? v.name_en : v.name_es);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Dimensions list */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">
              {language === "en" ? "Dimensions" : "Dimensiones"}
            </h3>
          </div>
          <Button size="sm" onClick={() => setDimDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {language === "en" ? "New" : "Nueva"}
          </Button>
        </div>
        <div className="space-y-1.5">
          {dimensions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDim(d.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedDim === d.id ? "bg-primary/5 border-primary" : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{dimName(d)}</div>
                  <div className="text-xs text-muted-foreground font-mono">{d.code}</div>
                </div>
                <div className="flex items-center gap-2">
                  {d.is_required_default && (
                    <Badge variant="secondary" className="text-[10px]">
                      {language === "en" ? "required" : "requerida"}
                    </Badge>
                  )}
                  <Switch
                    checked={d.active}
                    onCheckedChange={(v) => toggleDimActive.mutate({ id: d.id, active: v })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </button>
          ))}
          {dimensions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {language === "en" ? "No dimensions yet." : "Aún no hay dimensiones."}
            </p>
          )}
        </div>
      </Card>

      {/* Values list */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {language === "en" ? "Values" : "Valores"}
            {selectedDim && (
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                — {dimName(dimensions.find((d) => d.id === selectedDim)!)}
              </span>
            )}
          </h3>
          <Button size="sm" onClick={() => setValueDialogOpen(true)} disabled={!selectedDim}>
            <Plus className="h-4 w-4 mr-1" />
            {language === "en" ? "New" : "Nuevo"}
          </Button>
        </div>
        {!selectedDim ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {language === "en" ? "Select a dimension to manage its values." : "Selecciona una dimensión para gestionar sus valores."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {values.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <div className="font-medium">{valName(v)}</div>
                  <div className="text-xs text-muted-foreground font-mono">{v.code}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(language === "en" ? "Delete this value?" : "¿Eliminar este valor?")) {
                      deleteValue.mutate(v.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {values.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {language === "en" ? "No values yet." : "Aún no hay valores."}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* New dimension dialog */}
      <Dialog open={dimDialogOpen} onOpenChange={setDimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "en" ? "New dimension" : "Nueva dimensión"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{language === "en" ? "Code" : "Código"}</Label>
              <Input
                value={newDim.code}
                onChange={(e) => setNewDim({ ...newDim, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="project"
              />
            </div>
            <div>
              <Label>{language === "en" ? "Name (Spanish)" : "Nombre (Español)"}</Label>
              <Input value={newDim.name_es} onChange={(e) => setNewDim({ ...newDim, name_es: e.target.value })} />
            </div>
            <div>
              <Label>{language === "en" ? "Name (English)" : "Nombre (Inglés)"}</Label>
              <Input value={newDim.name_en} onChange={(e) => setNewDim({ ...newDim, name_en: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newDim.is_required_default}
                onCheckedChange={(v) => setNewDim({ ...newDim, is_required_default: v })}
              />
              <Label>{language === "en" ? "Required by default" : "Requerida por defecto"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDimDialogOpen(false)}>
              {language === "en" ? "Cancel" : "Cancelar"}
            </Button>
            <Button
              onClick={() => createDim.mutate()}
              disabled={!newDim.code || !newDim.name_es || !newDim.name_en}
            >
              {language === "en" ? "Create" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New value dialog */}
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "en" ? "New value" : "Nuevo valor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{language === "en" ? "Code" : "Código"}</Label>
              <Input
                value={newValue.code}
                onChange={(e) => setNewValue({ ...newValue, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
              />
            </div>
            <div>
              <Label>{language === "en" ? "Name (Spanish)" : "Nombre (Español)"}</Label>
              <Input value={newValue.name_es} onChange={(e) => setNewValue({ ...newValue, name_es: e.target.value })} />
            </div>
            <div>
              <Label>{language === "en" ? "Name (English)" : "Nombre (Inglés)"}</Label>
              <Input value={newValue.name_en} onChange={(e) => setNewValue({ ...newValue, name_en: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValueDialogOpen(false)}>
              {language === "en" ? "Cancel" : "Cancelar"}
            </Button>
            <Button
              onClick={() => createValue.mutate()}
              disabled={!newValue.code || !newValue.name_es || !newValue.name_en}
            >
              {language === "en" ? "Add" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      <AccountDimensionRulesPanel />
    </div>
  );
}
