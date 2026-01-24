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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, History, Archive, ArchiveRestore, SlidersHorizontal } from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { PurchaseHistoryDialog } from "./PurchaseHistoryDialog";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { ColumnSelector } from "@/components/ui/column-selector";
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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

const inventoryColumns: ColumnConfig[] = [
  { key: "commercial_name", label: "Commercial Name", defaultVisible: true },
  { key: "molecule_name", label: "Molecule Name", defaultVisible: true },
  { key: "function", label: "Function", defaultVisible: true },
  { key: "stock", label: "Stock", defaultVisible: true },
  { key: "amount_purchased", label: "Amount Purchased", defaultVisible: true },
  { key: "amount_used", label: "Amount Used", defaultVisible: false },
  { key: "suppliers", label: "Suppliers", defaultVisible: true },
  { key: "documents", label: "Documents", defaultVisible: false },
  { key: "co2_equivalent", label: "CO₂ Equivalent", defaultVisible: false },
];

export function InventoryList({ onEditItem }: InventoryListProps) {
  const queryClient = useQueryClient();
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<{
    id: string;
    commercial_name: string;
    current_quantity: number;
    use_unit: string;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // Date range for filtering purchases/usage
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const {
    visibility,
    toggleColumn,
    resetToDefaults,
    isVisible,
    allColumns,
  } = useColumnVisibility("inventory-items", inventoryColumns);

  // Fetch inventory items
  const { data: items, isLoading } = useQuery({
    queryKey: ["inventoryItems", showArchived],
    queryFn: async () => {
      let query = supabase
        .from("inventory_items")
        .select("*")
        .order("commercial_name");
      
      if (!showArchived) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchases within date range
  const { data: purchases } = useQuery({
    queryKey: ["inventoryPurchases", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_purchases")
        .select("item_id, quantity, packaging_quantity, supplier, document_number")
        .gte("purchase_date", format(startDate, "yyyy-MM-dd"))
        .lte("purchase_date", format(endDate, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data;
    },
  });

  // Aggregate purchase data by item
  const purchasesByItem = useMemo(() => {
    if (!purchases) return {};
    
    return purchases.reduce((acc, purchase) => {
      const itemId = purchase.item_id;
      if (!acc[itemId]) {
        acc[itemId] = {
          totalPurchased: 0,
          suppliers: new Set<string>(),
          documents: new Set<string>(),
        };
      }
      
      // Calculate total in use units (quantity × packaging_quantity)
      const packagingQty = Number(purchase.packaging_quantity) || 1;
      acc[itemId].totalPurchased += Number(purchase.quantity) * packagingQty;
      
      if (purchase.supplier) {
        acc[itemId].suppliers.add(purchase.supplier);
      }
      if (purchase.document_number) {
        acc[itemId].documents.add(purchase.document_number);
      }
      
      return acc;
    }, {} as Record<string, { totalPurchased: number; suppliers: Set<string>; documents: Set<string> }>);
  }, [purchases]);

  // Archive/Unarchive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: !archive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      toast.success(archive ? "Item archived" : "Item restored");
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
        {showArchived 
          ? "No inventory items found." 
          : "No active inventory items. Add your first item to get started."}
      </div>
    );
  }

  const formatStock = (item: typeof items[0]) => {
    const qty = Number(item.current_quantity);
    return `${qty.toFixed(2)} ${item.use_unit}`;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Date Range:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Show Archived Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm cursor-pointer">
                Show Archived
              </Label>
            </div>

            {/* Column Selector */}
            <ColumnSelector
              columns={allColumns}
              visibility={visibility}
              onToggle={toggleColumn}
              onReset={resetToDefaults}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table className="table-auto">
            <TableHeader>
              <TableRow>
                {isVisible("commercial_name") && <TableHead>Commercial Name</TableHead>}
                {isVisible("molecule_name") && <TableHead>Molecule</TableHead>}
                {isVisible("function") && <TableHead>Function</TableHead>}
                {isVisible("stock") && <TableHead>Stock</TableHead>}
                {isVisible("amount_purchased") && <TableHead>Purchased</TableHead>}
                {isVisible("amount_used") && <TableHead>Used</TableHead>}
                {isVisible("suppliers") && <TableHead>Suppliers</TableHead>}
                {isVisible("documents") && <TableHead>Documents</TableHead>}
                {isVisible("co2_equivalent") && <TableHead>CO₂ eq.</TableHead>}
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const itemPurchases = purchasesByItem[item.id];
                const isArchived = !item.is_active;

                return (
                  <TableRow 
                    key={item.id} 
                    className={isArchived ? "opacity-60" : ""}
                  >
                    {isVisible("commercial_name") && (
                      <TableCell className="font-medium">
                        {item.commercial_name}
                        {isArchived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isVisible("molecule_name") && (
                      <TableCell className="text-muted-foreground">
                        {item.molecule_name || "-"}
                      </TableCell>
                    )}
                    {isVisible("function") && (
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={functionColors[item.function] || ""}
                        >
                          {functionLabels[item.function] || item.function}
                        </Badge>
                      </TableCell>
                    )}
                    {isVisible("stock") && (
                      <TableCell>
                        <button
                          onClick={() => setAdjustmentItem({
                            id: item.id,
                            commercial_name: item.commercial_name,
                            current_quantity: Number(item.current_quantity),
                            use_unit: item.use_unit,
                          })}
                          className={cn(
                            "hover:underline cursor-pointer",
                            Number(item.current_quantity) <= 0
                              ? "text-destructive font-medium"
                              : ""
                          )}
                          title="Click to adjust stock"
                        >
                          {formatStock(item)}
                        </button>
                      </TableCell>
                    )}
                    {isVisible("amount_purchased") && (
                      <TableCell>
                        {itemPurchases 
                          ? `${itemPurchases.totalPurchased.toFixed(2)} ${item.use_unit}`
                          : "-"}
                      </TableCell>
                    )}
                    {isVisible("amount_used") && (
                      <TableCell className="text-muted-foreground">
                        —
                      </TableCell>
                    )}
                    {isVisible("suppliers") && (
                      <TableCell>
                        {itemPurchases && itemPurchases.suppliers.size > 0
                          ? Array.from(itemPurchases.suppliers).join(", ")
                          : "-"}
                      </TableCell>
                    )}
                    {isVisible("documents") && (
                      <TableCell className="text-xs font-mono">
                        {itemPurchases && itemPurchases.documents.size > 0
                          ? Array.from(itemPurchases.documents).join(", ")
                          : "-"}
                      </TableCell>
                    )}
                    {isVisible("co2_equivalent") && (
                      <TableCell>
                        {item.co2_equivalent ? `${item.co2_equivalent} kg` : "-"}
                      </TableCell>
                    )}
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
                          onClick={() => setAdjustmentItem({
                            id: item.id,
                            commercial_name: item.commercial_name,
                            current_quantity: Number(item.current_quantity),
                            use_unit: item.use_unit,
                          })}
                          title="Adjust stock"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setHistoryItemId(item.id)}
                          title="Purchase history"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => archiveMutation.mutate({ id: item.id, archive: !isArchived })}
                          title={isArchived ? "Restore item" : "Archive item"}
                        >
                          {isArchived ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <PurchaseHistoryDialog
        itemId={historyItemId}
        onOpenChange={() => setHistoryItemId(null)}
      />

      <StockAdjustmentDialog
        open={!!adjustmentItem}
        onOpenChange={(open) => !open && setAdjustmentItem(null)}
        item={adjustmentItem}
      />
    </>
  );
}
