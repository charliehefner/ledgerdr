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
  { value: "other", label: "Other" },
];

const useUnits = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (mL)" },
  { value: "sack", label: "Sack" },
  { value: "unit", label: "Unit" },
];

const initialFormState = {
  commercial_name: "",
  molecule_name: "",
  function: "other" as string,
  use_unit: "kg",
  sack_weight_kg: "",
  supplier: "",
  purchase_unit_quantity: "1",
  purchase_unit_type: "unit",
  price_per_purchase_unit: "",
  co2_equivalent: "",
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
        .single();
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
        sack_weight_kg: existingItem.sack_weight_kg?.toString() || "",
        supplier: existingItem.supplier || "",
        purchase_unit_quantity: existingItem.purchase_unit_quantity.toString(),
        purchase_unit_type: existingItem.purchase_unit_type,
        price_per_purchase_unit:
          existingItem.price_per_purchase_unit.toString(),
        co2_equivalent: existingItem.co2_equivalent?.toString() || "",
      });
    } else if (!editingItemId) {
      setForm(initialFormState);
    }
  }, [existingItem, editingItemId]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        commercial_name: data.commercial_name,
        molecule_name: data.molecule_name || null,
        function: data.function as any,
        use_unit: data.use_unit,
        sack_weight_kg: data.sack_weight_kg
          ? parseFloat(data.sack_weight_kg)
          : null,
        supplier: data.supplier || null,
        purchase_unit_quantity: parseFloat(data.purchase_unit_quantity) || 1,
        purchase_unit_type: data.purchase_unit_type,
        price_per_purchase_unit:
          parseFloat(data.price_per_purchase_unit) || 0,
        co2_equivalent: data.co2_equivalent
          ? parseFloat(data.co2_equivalent)
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventoryFunctions.map((fn) => (
                    <SelectItem key={fn.value} value={fn.value}>
                      {fn.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="e.g., AgriSupply Co."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="use_unit">Unit for Use</Label>
              <Select
                value={form.use_unit}
                onValueChange={(val) => setForm({ ...form, use_unit: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {useUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.use_unit === "sack" && (
              <div className="space-y-2">
                <Label htmlFor="sack_weight_kg">Sack Weight (kg)</Label>
                <Input
                  id="sack_weight_kg"
                  type="number"
                  step="0.01"
                  value={form.sack_weight_kg}
                  onChange={(e) =>
                    setForm({ ...form, sack_weight_kg: e.target.value })
                  }
                  placeholder="e.g., 50"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="purchase_unit_quantity">
                Purchase Unit Quantity
              </Label>
              <Input
                id="purchase_unit_quantity"
                type="number"
                step="0.01"
                value={form.purchase_unit_quantity}
                onChange={(e) =>
                  setForm({ ...form, purchase_unit_quantity: e.target.value })
                }
                placeholder="e.g., 20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_unit_type">Purchase Unit Type</Label>
              <Input
                id="purchase_unit_type"
                value={form.purchase_unit_type}
                onChange={(e) =>
                  setForm({ ...form, purchase_unit_type: e.target.value })
                }
                placeholder="e.g., liter, kg, gallon"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_per_purchase_unit">
                Price per Purchase Unit ($)
              </Label>
              <Input
                id="price_per_purchase_unit"
                type="number"
                step="0.01"
                value={form.price_per_purchase_unit}
                onChange={(e) =>
                  setForm({ ...form, price_per_purchase_unit: e.target.value })
                }
                placeholder="e.g., 100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="co2_equivalent">CO₂ Equivalent (kg)</Label>
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
