import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, History } from "lucide-react";
import { useState } from "react";
import { PurchaseHistoryDialog } from "./PurchaseHistoryDialog";

interface InventoryListProps {
  onEditItem: (itemId: string) => void;
}

const functionLabels: Record<string, string> = {
  fertilizer: "Fertilizer",
  fuel: "Fuel",
  pre_emergent_herbicide: "Pre-emergent Herbicide",
  post_emergent_herbicide: "Post-emergent Herbicide",
  pesticide: "Pesticide",
  fungicide: "Fungicide",
  insecticide: "Insecticide",
  seed: "Seed",
  other: "Other",
};

const functionColors: Record<string, string> = {
  fertilizer: "bg-green-100 text-green-800",
  fuel: "bg-amber-100 text-amber-800",
  pre_emergent_herbicide: "bg-blue-100 text-blue-800",
  post_emergent_herbicide: "bg-cyan-100 text-cyan-800",
  pesticide: "bg-red-100 text-red-800",
  fungicide: "bg-purple-100 text-purple-800",
  insecticide: "bg-orange-100 text-orange-800",
  seed: "bg-lime-100 text-lime-800",
  other: "bg-gray-100 text-gray-800",
};

export function InventoryList({ onEditItem }: InventoryListProps) {
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("commercial_name");

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No inventory items yet. Add your first item to get started.
      </div>
    );
  }

  const formatPrice = (item: typeof items[0]) => {
    const price = Number(item.price_per_purchase_unit);
    const qty = Number(item.purchase_unit_quantity);
    const unit = item.purchase_unit_type;
    return `$${price.toFixed(2)} / ${qty} ${unit}`;
  };

  const formatStock = (item: typeof items[0]) => {
    const qty = Number(item.current_quantity);
    if (item.use_unit === "sack" && item.sack_weight_kg) {
      return `${qty} sacks (${Number(item.sack_weight_kg)}kg ea)`;
    }
    return `${qty} ${item.use_unit}`;
  };

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commercial Name</TableHead>
              <TableHead>Molecule</TableHead>
              <TableHead>Function</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>CO₂ eq.</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.commercial_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.molecule_name || "-"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={functionColors[item.function] || ""}
                  >
                    {functionLabels[item.function] || item.function}
                  </Badge>
                </TableCell>
                <TableCell>{item.supplier || "-"}</TableCell>
                <TableCell>{formatPrice(item)}</TableCell>
                <TableCell>
                  <span
                    className={
                      Number(item.current_quantity) <= 0
                        ? "text-destructive font-medium"
                        : ""
                    }
                  >
                    {formatStock(item)}
                  </span>
                </TableCell>
                <TableCell>
                  {item.co2_equivalent ? `${item.co2_equivalent} kg` : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditItem(item.id)}
                      title="Edit item"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHistoryItemId(item.id)}
                      title="Purchase history"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PurchaseHistoryDialog
        itemId={historyItemId}
        onOpenChange={() => setHistoryItemId(null)}
      />
    </>
  );
}
