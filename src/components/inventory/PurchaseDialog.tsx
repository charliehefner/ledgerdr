import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedItemId?: string;
}

const initialFormState = {
  item_id: "",
  purchase_date: new Date(),
  document_number: "",
  supplier: "",
  packaging_quantity: "",
  packaging_unit: "",
  quantity: "",
  unit_price: "",
  notes: "",
};

export function PurchaseDialog({
  open,
  onOpenChange,
  preselectedItemId,
}: PurchaseDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    ...initialFormState,
    item_id: preselectedItemId || "",
  });

  const { data: items } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, use_unit")
        .eq("is_active", true)
        .order("commercial_name");
      if (error) throw error;
      return data;
    },
  });

  const selectedItem = items?.find((i) => i.id === form.item_id);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const quantity = parseFloat(data.quantity);
      const unitPrice = parseFloat(data.unit_price);
      const packagingQuantity = parseFloat(data.packaging_quantity) || 1;
      const totalPrice = quantity * unitPrice;

      // Insert purchase record
      const { error: purchaseError } = await supabase
        .from("inventory_purchases")
        .insert({
          item_id: data.item_id,
          purchase_date: format(data.purchase_date, "yyyy-MM-dd"),
          document_number: data.document_number || null,
          supplier: data.supplier || null,
          packaging_quantity: packagingQuantity,
          packaging_unit: data.packaging_unit || "unit",
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          notes: data.notes || null,
        });

      if (purchaseError) throw purchaseError;

      // Update current_quantity in inventory_items
      // Calculate how many use_units we're adding based on packaging
      const { data: currentItem, error: fetchError } = await supabase
        .from("inventory_items")
        .select("current_quantity, use_unit")
        .eq("id", data.item_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentItem) throw new Error("Inventory item not found");

      // e.g., buying 5 packages of 20L each = 100L added
      const addedQuantity = quantity * packagingQuantity;
      const newQuantity = Number(currentItem.current_quantity) + addedQuantity;

      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ current_quantity: newQuantity })
        .eq("id", data.item_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryPurchases"] });
      toast.success("Purchase recorded successfully");
      onOpenChange(false);
      setForm(initialFormState);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_id) {
      toast.error("Please select an item");
      return;
    }
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (!form.unit_price || parseFloat(form.unit_price) < 0) {
      toast.error("Please enter a valid unit price");
      return;
    }
    if (!form.packaging_quantity || parseFloat(form.packaging_quantity) <= 0) {
      toast.error("Please enter a valid packaging size");
      return;
    }
    mutation.mutate(form);
  };

  const calculateTotal = () => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    return (qty * price).toFixed(2);
  };

  const calculateStockAdded = () => {
    const qty = parseFloat(form.quantity) || 0;
    const packagingQty = parseFloat(form.packaging_quantity) || 0;
    return (qty * packagingQty).toFixed(2);
  };

  // Auto-fill packaging unit from item's use_unit when item is selected
  const handleItemChange = (itemId: string) => {
    const item = items?.find((i) => i.id === itemId);
    setForm((prev) => ({
      ...prev,
      item_id: itemId,
      packaging_unit: item?.use_unit || "",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Purchase</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item_id">Item *</Label>
            <Select value={form.item_id} onValueChange={handleItemChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.purchase_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.purchase_date
                      ? format(form.purchase_date, "PPP")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.purchase_date}
                    onSelect={(date) =>
                      date && setForm({ ...form, purchase_date: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_number">Document Number</Label>
              <Input
                id="document_number"
                value={form.document_number}
                onChange={(e) =>
                  setForm({ ...form, document_number: e.target.value })
                }
                placeholder="Invoice or receipt #"
              />
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="packaging_quantity">Packaging Size *</Label>
              <Input
                id="packaging_quantity"
                type="number"
                step="0.01"
                value={form.packaging_quantity}
                onChange={(e) =>
                  setForm({ ...form, packaging_quantity: e.target.value })
                }
                placeholder="e.g., 20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="packaging_unit">Packaging Unit</Label>
              <Input
                id="packaging_unit"
                value={form.packaging_unit}
                onChange={(e) =>
                  setForm({ ...form, packaging_unit: e.target.value })
                }
                placeholder="e.g., liter, kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (packages) *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="e.g., 5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price">Price per Package ($) *</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                value={form.unit_price}
                onChange={(e) =>
                  setForm({ ...form, unit_price: e.target.value })
                }
                placeholder="e.g., 100"
              />
            </div>
          </div>

          {form.quantity && form.unit_price && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Cost:</span>
                <span className="font-semibold">${calculateTotal()}</span>
              </div>
              {form.packaging_quantity && selectedItem && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stock Added:</span>
                  <span className="font-semibold">
                    {calculateStockAdded()} {selectedItem.use_unit}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes about this purchase"
              rows={2}
            />
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
              {mutation.isPending ? "Recording..." : "Record Purchase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
