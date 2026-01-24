import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    commercial_name: string;
    current_quantity: number;
    use_unit: string;
  } | null;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  item,
}: StockAdjustmentDialogProps) {
  const queryClient = useQueryClient();
  const [adjustmentType, setAdjustmentType] = useState<"set" | "add" | "subtract">("set");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      
      const adjustmentAmount = parseFloat(amount);
      let newQuantity: number;

      switch (adjustmentType) {
        case "set":
          newQuantity = adjustmentAmount;
          break;
        case "add":
          newQuantity = Number(item.current_quantity) + adjustmentAmount;
          break;
        case "subtract":
          newQuantity = Number(item.current_quantity) - adjustmentAmount;
          break;
      }

      if (newQuantity < 0) {
        throw new Error("Stock cannot be negative");
      }

      const { error } = await supabase
        .from("inventory_items")
        .update({ current_quantity: newQuantity })
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      toast.success("Stock adjusted successfully");
      onOpenChange(false);
      setAmount("");
      setReason("");
      setAdjustmentType("set");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    mutation.mutate();
  };

  const calculateNewAmount = () => {
    if (!item || !amount) return null;
    const adjustmentAmount = parseFloat(amount);
    if (isNaN(adjustmentAmount)) return null;

    switch (adjustmentType) {
      case "set":
        return adjustmentAmount;
      case "add":
        return Number(item.current_quantity) + adjustmentAmount;
      case "subtract":
        return Number(item.current_quantity) - adjustmentAmount;
    }
  };

  const newAmount = calculateNewAmount();

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {item.commercial_name} — Current: {Number(item.current_quantity).toFixed(2)} {item.use_unit}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Adjustment Type</Label>
            <RadioGroup
              value={adjustmentType}
              onValueChange={(val) => setAdjustmentType(val as typeof adjustmentType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="set" id="set" />
                <Label htmlFor="set" className="font-normal cursor-pointer">
                  Set to
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="add" />
                <Label htmlFor="add" className="font-normal cursor-pointer">
                  Add
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subtract" id="subtract" />
                <Label htmlFor="subtract" className="font-normal cursor-pointer">
                  Subtract
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({item.use_unit})</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter amount in ${item.use_unit}`}
            />
          </div>

          {newAmount !== null && (
            <div className="rounded-lg bg-muted p-3 text-center">
              <span className="text-sm text-muted-foreground">New stock: </span>
              <span className={`font-semibold ${newAmount < 0 ? "text-destructive" : ""}`}>
                {newAmount.toFixed(2)} {item.use_unit}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Inventory count correction, spillage, etc."
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
            <Button 
              type="submit" 
              disabled={mutation.isPending || (newAmount !== null && newAmount < 0)}
            >
              {mutation.isPending ? "Saving..." : "Save Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
