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
        .select("id, commercial_name, purchase_unit_quantity, purchase_unit_type, price_per_purchase_unit")
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
      const totalPrice = quantity * unitPrice;

      // Insert purchase record
      const { error: purchaseError } = await supabase
        .from("inventory_purchases")
        .insert({
          item_id: data.item_id,
          purchase_date: format(data.purchase_date, "yyyy-MM-dd"),
          document_number: data.document_number || null,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          notes: data.notes || null,
        });

      if (purchaseError) throw purchaseError;

      // Update current_quantity in inventory_items
      // Calculate how many use_units we're adding
      const item = items?.find((i) => i.id === data.item_id);
      if (item) {
        const { data: currentItem, error: fetchError } = await supabase
          .from("inventory_items")
          .select("current_quantity, purchase_unit_quantity, use_unit, purchase_unit_type")
          .eq("id", data.item_id)
          .single();

        if (fetchError) throw fetchError;

        // Assuming purchase units convert directly to use_units based on purchase_unit_quantity
        // e.g., buying 5 purchase units of 20L each = 100L added
        const purchaseUnitQty = Number(currentItem.purchase_unit_quantity);
        const addedQuantity = quantity * purchaseUnitQty;
        const newQuantity = Number(currentItem.current_quantity) + addedQuantity;

        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({ current_quantity: newQuantity })
          .eq("id", data.item_id);

        if (updateError) throw updateError;
      }
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
    mutation.mutate(form);
  };

  const calculateTotal = () => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    return (qty * price).toFixed(2);
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
            <Select
              value={form.item_id}
              onValueChange={(val) => {
                setForm({ ...form, item_id: val });
                // Auto-fill unit price from item's default
                const item = items?.find((i) => i.id === val);
                if (item) {
                  setForm((prev) => ({
                    ...prev,
                    item_id: val,
                    unit_price: item.price_per_purchase_unit.toString(),
                  }));
                }
              }}
            >
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
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                Purchase unit: {selectedItem.purchase_unit_quantity}{" "}
                {selectedItem.purchase_unit_type}
              </p>
            )}
          </div>

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
              placeholder="Invoice or receipt number"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (purchase units) *</Label>
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
              <Label htmlFor="unit_price">Unit Price ($) *</Label>
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
            <div className="rounded-lg bg-muted p-3 text-center">
              <span className="text-sm text-muted-foreground">Total: </span>
              <span className="font-semibold">${calculateTotal()}</span>
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
