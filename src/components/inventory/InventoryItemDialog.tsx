import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface InventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItemId: string | null;
}

const inventoryFunctions = [
  { value: "fertilizer", label: "Fertilizer" },
  { value: "fuel", label: "Fuel" },
  { value: "pre_emergent_herbicide", label: "Pre-emergent Herbicide" },
  { value: "post_emergent_herbicide", label: "Post-emergent Herbicide" },
  { value: "pesticide", label: "Pesticide" },
  { value: "fungicide", label: "Fungicide" },
  { value: "insecticide", label: "Insecticide" },
  { value: "seed", label: "Seed" },
  { value: "condicionador", label: "Condicionador" },
  { value: "adherente", label: "Adherente" },
  { value: "other", label: "Other" },
];

const useUnits = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (mL)" },
  { value: "gallon", label: "Gallon (gal)" },
  { value: "sack", label: "Sack" },
  { value: "unit", label: "Unit" },
];

const initialFormState = {
  commercial_name: "",
  molecule_name: "",
  function: "other" as string,
  use_unit: "kg",
  co2_equivalent: "",
  cas_number: "",
  normal_dose_per_ha: "",
};

export function InventoryItemDialog({
  open,
  onOpenChange,
  editingItemId,
}: InventoryItemDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialFormState);

  const { data: existingItem } = useQuery({
    queryKey: ["inventoryItem", editingItemId],
    queryFn: async () => {
      if (!editingItemId) return null;
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("id", editingItemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!editingItemId,
  });

  useEffect(() => {
    if (existingItem) {
      setForm({
        commercial_name: existingItem.commercial_name,
        molecule_name: existingItem.molecule_name || "",
        function: existingItem.function,
        use_unit: existingItem.use_unit,
        co2_equivalent: existingItem.co2_equivalent?.toString() || "",
        cas_number: existingItem.cas_number || "",
        normal_dose_per_ha: existingItem.normal_dose_per_ha?.toString() || "",
      });
    } else if (!editingItemId) {
      setForm(initialFormState);
    }
  }, [existingItem, editingItemId]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      type InventoryFunction = "adherente" | "condicionador" | "fertilizer" | "fuel" | "fungicide" | "insecticide" | "other" | "pesticide" | "post_emergent_herbicide" | "pre_emergent_herbicide" | "seed";
      
      const payload = {
        commercial_name: data.commercial_name,
        molecule_name: data.molecule_name || null,
        function: data.function as InventoryFunction,
        use_unit: data.use_unit,
        co2_equivalent: data.co2_equivalent
          ? parseFloat(data.co2_equivalent)
          : null,
        cas_number: data.cas_number || null,
        normal_dose_per_ha: data.normal_dose_per_ha
          ? parseFloat(data.normal_dose_per_ha)
          : null,
      };

      if (editingItemId) {
        const { error } = await supabase
          .from("inventory_items")
          .update(payload)
          .eq("id", editingItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItem"] });
      toast.success(
        editingItemId ? "Item updated successfully" : "Item added successfully"
      );
      onOpenChange(false);
      setForm(initialFormState);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.commercial_name.trim()) {
      toast.error("Commercial name is required");
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingItemId ? "Edit Inventory Item" : "Add Inventory Item"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commercial_name">Commercial Name *</Label>
              <Input
                id="commercial_name"
                value={form.commercial_name}
                onChange={(e) =>
                  setForm({ ...form, commercial_name: e.target.value })
                }
                placeholder="e.g., Roundup"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="molecule_name">Molecule Name</Label>
              <Input
                id="molecule_name"
                value={form.molecule_name}
                onChange={(e) =>
                  setForm({ ...form, molecule_name: e.target.value })
                }
                placeholder="e.g., Glyphosate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="function">Function *</Label>
              <Select
                value={form.function}
                onValueChange={(val) => setForm({ ...form, function: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {inventoryFunctions.map((fn) => (
                    <SelectItem key={fn.value} value={fn.value}>
                      {fn.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="use_unit">Unit for Use *</Label>
              <Select
                value={form.use_unit}
                onValueChange={(val) => setForm({ ...form, use_unit: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {useUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cas_number">CAS Number</Label>
              <Input
                id="cas_number"
                value={form.cas_number}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9-]/g, '').slice(0, 12);
                  setForm({ ...form, cas_number: value });
                }}
                placeholder="e.g., 1071-83-6"
                maxLength={12}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="normal_dose_per_ha">
                Normal Dose ({useUnits.find(u => u.value === form.use_unit)?.label.split(' ')[0] || form.use_unit}/ha)
              </Label>
              <Input
                id="normal_dose_per_ha"
                type="number"
                step="0.01"
                min="0.01"
                max="9.99"
                value={form.normal_dose_per_ha}
                onChange={(e) =>
                  setForm({ ...form, normal_dose_per_ha: e.target.value })
                }
                placeholder="0.01 - 9.99"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="co2_equivalent">CO₂ Equivalent (kg per use unit)</Label>
              <Input
                id="co2_equivalent"
                type="number"
                step="0.01"
                value={form.co2_equivalent}
                onChange={(e) =>
                  setForm({ ...form, co2_equivalent: e.target.value })
                }
                placeholder="e.g., 2.5"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving..."
                : editingItemId
                ? "Update Item"
                : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
