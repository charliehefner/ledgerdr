import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORIES = [
  { value: "vehicle", label: "Vehículo" },
  { value: "tractor", label: "Tractor" },
  { value: "implement", label: "Implemento" },
  { value: "building", label: "Edificio" },
  { value: "tools", label: "Herramientas" },
  { value: "container", label: "Tanque/Contenedor" },
  { value: "office", label: "Oficina" },
  { value: "computer", label: "Computadora" },
  { value: "solar_panel", label: "Panel Solar" },
  { value: "land_improvement", label: "Mejora de Terreno" },
  { value: "other", label: "Otro" },
];

interface FixedAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: any | null;
  onSaved: () => void;
}

export function FixedAssetDialog({ open, onOpenChange, asset, onSaved }: FixedAssetDialogProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "other",
    acquisition_date: "",
    acquisition_value: "0",
    salvage_value: "0",
    useful_life_years: "5",
    depreciation_method: "straight_line",
    accumulated_depreciation: "0",
    in_service_date: "",
    disposal_date: "",
    disposal_value: "",
    is_active: true,
    asset_account_code: "",
    depreciation_expense_account: "",
    accumulated_depreciation_account: "",
    serial_number: "",
    notes: "",
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["depreciation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_depreciation_rules").select("*");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (asset) {
      setForm({
        name: asset.name || "",
        category: asset.category || "other",
        acquisition_date: asset.acquisition_date || "",
        acquisition_value: String(asset.acquisition_value || 0),
        salvage_value: String(asset.salvage_value || 0),
        useful_life_years: String(asset.useful_life_years || 5),
        depreciation_method: asset.depreciation_method || "straight_line",
        accumulated_depreciation: String(asset.accumulated_depreciation || 0),
        in_service_date: asset.in_service_date || "",
        disposal_date: asset.disposal_date || "",
        disposal_value: asset.disposal_value != null ? String(asset.disposal_value) : "",
        is_active: asset.is_active ?? true,
        asset_account_code: asset.asset_account_code || "",
        depreciation_expense_account: asset.depreciation_expense_account || "",
        accumulated_depreciation_account: asset.accumulated_depreciation_account || "",
        serial_number: asset.serial_number || "",
        notes: asset.notes || "",
      });
    } else {
      setForm({
        name: "", category: "other", acquisition_date: "", acquisition_value: "0",
        salvage_value: "0", useful_life_years: "5", depreciation_method: "straight_line",
        accumulated_depreciation: "0", in_service_date: "", disposal_date: "",
        disposal_value: "", is_active: true, asset_account_code: "",
        depreciation_expense_account: "", accumulated_depreciation_account: "",
        serial_number: "", notes: "",
      });
    }
  }, [asset, open]);

  const handleCategoryChange = (cat: string) => {
    const rule = rules.find((r: any) => r.category === cat);
    setForm((f) => ({
      ...f,
      category: cat,
      asset_account_code: rule?.asset_account_code || f.asset_account_code,
      depreciation_expense_account: rule?.depreciation_expense_account || f.depreciation_expense_account,
      accumulated_depreciation_account: rule?.accumulated_depreciation_account || f.accumulated_depreciation_account,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        category: form.category,
        acquisition_date: form.acquisition_date || null,
        acquisition_value: parseFloat(form.acquisition_value) || 0,
        salvage_value: parseFloat(form.salvage_value) || 0,
        useful_life_years: parseInt(form.useful_life_years) || 5,
        depreciation_method: form.depreciation_method,
        accumulated_depreciation: parseFloat(form.accumulated_depreciation) || 0,
        in_service_date: form.in_service_date || null,
        disposal_date: form.disposal_date || null,
        disposal_value: form.disposal_value ? parseFloat(form.disposal_value) : null,
        is_active: form.is_active,
        asset_account_code: form.asset_account_code || null,
        depreciation_expense_account: form.depreciation_expense_account || null,
        accumulated_depreciation_account: form.accumulated_depreciation_account || null,
        serial_number: form.serial_number || null,
        notes: form.notes || null,
      };

      if (asset) {
        const { error } = await supabase.from("fixed_assets").update(payload).eq("id", asset.id);
        if (error) throw error;
        toast.success("Activo actualizado");
      } else {
        const { error } = await supabase.from("fixed_assets").insert(payload);
        if (error) throw error;
        toast.success("Activo creado");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Editar Activo Fijo" : "Agregar Activo Fijo"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <Label>Categoría</Label>
            <Select value={form.category} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>No. Serie</Label>
            <Input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
          </div>

          <div>
            <Label>Fecha Adquisición</Label>
            <Input type="date" value={form.acquisition_date} onChange={(e) => setForm((f) => ({ ...f, acquisition_date: e.target.value }))} />
          </div>

          <div>
            <Label>Fecha en Servicio</Label>
            <Input type="date" value={form.in_service_date} onChange={(e) => setForm((f) => ({ ...f, in_service_date: e.target.value }))} />
          </div>

          <div>
            <Label>Valor Adquisición</Label>
            <Input type="number" value={form.acquisition_value} onChange={(e) => setForm((f) => ({ ...f, acquisition_value: e.target.value }))} />
          </div>

          <div>
            <Label>Valor Residual</Label>
            <Input type="number" value={form.salvage_value} onChange={(e) => setForm((f) => ({ ...f, salvage_value: e.target.value }))} />
          </div>

          <div>
            <Label>Años Vida Útil</Label>
            <Input type="number" value={form.useful_life_years} onChange={(e) => setForm((f) => ({ ...f, useful_life_years: e.target.value }))} />
          </div>

          <div>
            <Label>Dep. Acumulada (importación)</Label>
            <Input type="number" value={form.accumulated_depreciation} onChange={(e) => setForm((f) => ({ ...f, accumulated_depreciation: e.target.value }))} />
          </div>

          <div>
            <Label>Cuenta Activo</Label>
            <Input value={form.asset_account_code} onChange={(e) => setForm((f) => ({ ...f, asset_account_code: e.target.value }))} />
          </div>

          <div>
            <Label>Cuenta Gasto Dep.</Label>
            <Input value={form.depreciation_expense_account} onChange={(e) => setForm((f) => ({ ...f, depreciation_expense_account: e.target.value }))} />
          </div>

          <div>
            <Label>Cuenta Dep. Acumulada</Label>
            <Input value={form.accumulated_depreciation_account} onChange={(e) => setForm((f) => ({ ...f, accumulated_depreciation_account: e.target.value }))} />
          </div>

          {asset && (
            <>
              <div>
                <Label>Fecha Baja</Label>
                <Input type="date" value={form.disposal_date} onChange={(e) => setForm((f) => ({ ...f, disposal_date: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Baja</Label>
                <Input type="number" value={form.disposal_value} onChange={(e) => setForm((f) => ({ ...f, disposal_value: e.target.value }))} />
              </div>
            </>
          )}

          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : asset ? t("common.update") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
