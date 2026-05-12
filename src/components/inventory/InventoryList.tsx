import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import {
  Edit,
  History,
  Archive,
  ArchiveRestore,
  SlidersHorizontal,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  CalendarIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { PurchaseHistoryDialog } from "./PurchaseHistoryDialog";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { ColumnSelector } from "@/components/ui/column-selector";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

// Import extracted modules
import { InventoryItem, StockAdjustmentItem, SortConfig } from "./types";
import { inventoryColumns, functionLabels, functionColors } from "./constants";
import { formatStock, aggregatePurchases, aggregateUsage, sortInventoryItems } from "./utils";
import { useInventoryExport } from "./useInventoryExport";

interface InventoryListProps {
  onEditItem: (itemId: string) => void;
}

export function InventoryList({ onEditItem }: InventoryListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<StockAdjustmentItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "commercial_name",
    direction: "asc",
  });

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
      return data as InventoryItem[];
    },
  });

  // Fetch purchases within date range
  const { data: purchases } = useQuery({
    queryKey: [
      "inventoryPurchases",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
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

  // Fetch usage from operation_inputs within date range
  const { data: operationInputs } = useQuery({
    queryKey: [
      "operationInputs",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_inputs")
        .select("inventory_item_id, quantity_used, operations!inner(operation_date)")
        .gte("operations.operation_date", format(startDate, "yyyy-MM-dd"))
        .lte("operations.operation_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;
      return data;
    },
  });

  // Fetch fuel dispensing transactions within date range
  const { data: fuelTransactions } = useQuery({
    queryKey: [
      "fuelTransactionsForInventory",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select("gallons, transaction_date, fuel_tanks!tank_id!inner(fuel_type)")
        .eq("transaction_type", "dispense")
        .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
        .lte("transaction_date", format(endDate, "yyyy-MM-dd") + "T23:59:59");

      if (error) throw error;
      return data;
    },
  });

  // Aggregate data using utility functions
  const purchasesByItem = useMemo(
    () => aggregatePurchases(purchases),
    [purchases]
  );

  const usageByItem = useMemo(
    () => aggregateUsage(operationInputs, fuelTransactions, items),
    [operationInputs, fuelTransactions, items]
  );

  // Sort items using utility function
  const sortedItems = useMemo(
    () => sortInventoryItems(items, sortConfig, purchasesByItem, usageByItem),
    [items, sortConfig, purchasesByItem, usageByItem]
  );

  // Use export hook
  const { exportToExcel, exportToPDF } = useInventoryExport({
    items: sortedItems,
    purchasesByItem,
    usageByItem,
    isVisible,
    startDate,
    endDate,
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { key: "commercial_name", direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

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

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                Date Range:
              </Label>
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
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Start"}
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
                    {endDate ? format(endDate, "dd/MM/yyyy") : "End"}
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

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover">
                <DropdownMenuItem onClick={exportToExcel} className="text-excel">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
                {isVisible("commercial_name") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("commercial_name")}
                  >
                    <div className="flex items-center">
                      Commercial Name
                      {getSortIcon("commercial_name")}
                    </div>
                  </TableHead>
                )}
                {isVisible("molecule_name") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("molecule_name")}
                  >
                    <div className="flex items-center">
                      Molecule
                      {getSortIcon("molecule_name")}
                    </div>
                  </TableHead>
                )}
                {isVisible("function") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("function")}
                  >
                    <div className="flex items-center">
                      Function
                      {getSortIcon("function")}
                    </div>
                  </TableHead>
                )}
                {isVisible("stock") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("stock")}
                  >
                    <div className="flex items-center">
                      Stock
                      {getSortIcon("stock")}
                    </div>
                  </TableHead>
                )}
                {isVisible("amount_purchased") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("amount_purchased")}
                  >
                    <div className="flex items-center">
                      Purchased
                      {getSortIcon("amount_purchased")}
                    </div>
                  </TableHead>
                )}
                {isVisible("amount_used") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("amount_used")}
                  >
                    <div className="flex items-center">
                      Used
                      {getSortIcon("amount_used")}
                    </div>
                  </TableHead>
                )}
                {isVisible("suppliers") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("suppliers")}
                  >
                    <div className="flex items-center">
                      Suppliers
                      {getSortIcon("suppliers")}
                    </div>
                  </TableHead>
                )}
                {isVisible("documents") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("documents")}
                  >
                    <div className="flex items-center">
                      Documents
                      {getSortIcon("documents")}
                    </div>
                  </TableHead>
                )}
                {isVisible("co2_equivalent") && (
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("co2_equivalent")}
                  >
                    <div className="flex items-center">
                      CO₂ eq.
                      {getSortIcon("co2_equivalent")}
                    </div>
                  </TableHead>
                )}
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => {
                const itemPurchases = purchasesByItem[item.id];
                const isArchived = !item.is_active;

                return (
                  <TableRow key={item.id} className={isArchived ? "opacity-60" : ""}>
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
                        {item.function === "fuel" ? (
                          <span
                            className={cn(
                              Number(item.current_quantity) <= 0
                                ? "text-destructive font-medium"
                                : ""
                            )}
                            title="Fuel stock is synced from tanks"
                          >
                            {formatStock(item)}
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              setAdjustmentItem({
                                id: item.id,
                                commercial_name: item.commercial_name,
                                current_quantity: Number(item.current_quantity),
                                use_unit: item.use_unit,
                              })
                            }
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
                        )}
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
                      <TableCell>
                        {usageByItem[item.id]
                          ? `${usageByItem[item.id].toFixed(2)} ${item.use_unit}`
                          : "-"}
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
                          onClick={() =>
                            setAdjustmentItem({
                              id: item.id,
                              commercial_name: item.commercial_name,
                              current_quantity: Number(item.current_quantity),
                              use_unit: item.use_unit,
                            })
                          }
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
                          onClick={() =>
                            navigate(`/operations?tab=input-usage&inputId=${item.id}`)
                          }
                          title="Ver uso en operaciones"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            archiveMutation.mutate({ id: item.id, archive: !isArchived })
                          }
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
