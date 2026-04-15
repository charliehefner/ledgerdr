import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntity } from "@/contexts/EntityContext";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { CalendarIcon, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatters";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedItemId?: string;
}

const initialFormState = {
  item_id: "",
  tank_id: "",
  reset_tank_gauge: false,
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
  const { requireEntity } = useEntity();
  const [form, setForm] = useState({
    ...initialFormState,
    item_id: preselectedItemId || "",
  });

  const { data: items } = useQuery({
    queryKey: ["inventoryItemsWithFunction"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, use_unit, function")
        .eq("is_active", true)
        .order("commercial_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks } = useQuery({
    queryKey: ["fuelTanks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, use_type, fuel_type, capacity_gallons, current_level_gallons, last_pump_end_reading")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedItem = items?.find((i) => i.id === form.item_id);
  const isFuelItem = selectedItem?.function === "fuel";

  // Reset tank_id when switching away from fuel item
  useEffect(() => {
    if (!isFuelItem && form.tank_id) {
      setForm((prev) => ({ ...prev, tank_id: "" }));
    }
  }, [isFuelItem, form.tank_id]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form & { entity_id: string }) => {
      const quantity = parseFloat(data.quantity);
      const unitPrice = parseFloat(data.unit_price);
      const packagingQuantity = parseFloat(data.packaging_quantity) || 1;
      const totalPrice = quantity * unitPrice;
      const addedQuantity = quantity * packagingQuantity;

      // Insert purchase record
      const { error: purchaseError } = await supabase
        .from("inventory_purchases")
        .insert({
          entity_id: data.entity_id,
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

      // For fuel items, update pump gauge if reset requested, then record refill transaction
      if (isFuelItem && data.tank_id) {
        if (data.reset_tank_gauge) {
          // User explicitly confirms the physical pump gauge was reset to 0
          const { error: tankUpdateError } = await supabase
            .from("fuel_tanks")
            .update({ last_pump_end_reading: 0 })
            .eq("id", data.tank_id);
          if (tankUpdateError) throw tankUpdateError;
        }

        // Also record a refill transaction for tank history
        const { error: transactionError } = await supabase
          .from("fuel_transactions")
          .insert({
            entity_id: data.entity_id,
            tank_id: data.tank_id,
            transaction_type: "refill",
            gallons: addedQuantity,
            transaction_date: format(data.purchase_date, "yyyy-MM-dd"),
            notes: data.document_number 
              ? `Purchase: ${data.document_number}${data.supplier ? ` from ${data.supplier}` : ""}`
              : data.supplier 
                ? `Purchase from ${data.supplier}` 
                : "Purchase refill",
          });

        if (transactionError) throw transactionError;
      } else {
        // For non-fuel items, update inventory directly
        const { data: currentItem, error: fetchError } = await supabase
          .from("inventory_items")
          .select("current_quantity, use_unit")
          .eq("id", data.item_id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!currentItem) throw new Error("Inventory item not found");

        const newQuantity = Math.round((Number(currentItem.current_quantity) + addedQuantity) * 10000) / 10000;

        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({ current_quantity: newQuantity })
          .eq("id", data.item_id);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItemsWithFunction"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryPurchases"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
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
    if (isFuelItem && !form.tank_id) {
      toast.error("Please select a tank for fuel purchase");
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
    const entityId = requireEntity();
    if (!entityId) {
      toast.error("Please select an entity before registering a purchase");
      return;
    }
    mutation.mutate({ ...form, entity_id: entityId });
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
      tank_id: "", // Reset tank when changing item
    }));
  };

  // Get selected tank info for display
  const selectedTank = tanks?.find((t) => t.id === form.tank_id);

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

          {/* Tank selector for fuel items */}
          {isFuelItem && (
            <div className="space-y-2">
              <Label htmlFor="tank_id" className="flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                Destination Tank *
              </Label>
              <Select 
                value={form.tank_id} 
                onValueChange={(value) => setForm({ ...form, tank_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tank" />
                </SelectTrigger>
                <SelectContent>
                  {tanks?.map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      {tank.name} ({tank.use_type}) - {tank.current_level_gallons.toLocaleString()}/{tank.capacity_gallons.toLocaleString()} gal
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTank && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tank will be updated and inventory will sync automatically
                  </p>
                  <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/50">
                    <Checkbox
                      id="reset_tank_gauge"
                      checked={form.reset_tank_gauge}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, reset_tank_gauge: checked === true })
                      }
                    />
                    <Label 
                      htmlFor="reset_tank_gauge" 
                      className="text-sm font-normal cursor-pointer"
                    >
                      Reset tank gauge (tank full, pump reading → 0)
                    </Label>
                  </div>
                  {form.reset_tank_gauge && (
                    <p className="text-xs text-destructive">
                      Tank level will be set to {(Number(selectedTank.current_level_gallons) + Number(calculateStockAdded())).toLocaleString()} gal ({selectedTank.current_level_gallons.toLocaleString()} remaining + {calculateStockAdded()} purchased) and pump reading will reset to 0
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
                <span className="font-semibold">${formatMoney(parseFloat(calculateTotal()))}</span>
              </div>
              {form.packaging_quantity && selectedItem && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isFuelItem ? "Gallons Added to Tank:" : "Stock Added:"}
                  </span>
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
