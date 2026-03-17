import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import { formatMoney } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PurchaseHistoryDialogProps {
  itemId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseHistoryDialog({
  itemId,
  onOpenChange,
}: PurchaseHistoryDialogProps) {
  const { data: item } = useQuery({
    queryKey: ["inventoryItem", itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await supabase
        .from("inventory_items")
        .select("commercial_name")
        .eq("id", itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["inventoryPurchases", itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from("inventory_purchases")
        .select("*")
        .eq("item_id", itemId)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  return (
    <Dialog open={!!itemId} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Purchase History: {item?.commercial_name || ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !purchases || purchases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No purchase history for this item.
          </div>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Document #</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Pkg Size</TableHead>
                  <TableHead className="text-right">Total Units</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      {format(parseDateLocal(purchase.purchase_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{purchase.document_number || "-"}</TableCell>
                    <TableCell className="text-right">
                      {purchase.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(purchase.packaging_quantity || 1)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(Number(purchase.quantity) * Number(purchase.packaging_quantity || 1)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(purchase.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(purchase.total_price).toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {purchase.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
