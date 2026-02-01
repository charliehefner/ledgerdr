import { useQuery } from "@tanstack/react-query";
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
import { Edit, History, Archive, ArchiveRestore, SlidersHorizontal, Download, FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown, BarChart3 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

type SortDirection = "asc" | "desc" | null;
type SortConfig = { key: string; direction: SortDirection };

export function InventoryList({ onEditItem }: InventoryListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<{
    id: string;
    commercial_name: string;
    current_quantity: number;
    use_unit: string;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "commercial_name", direction: "asc" });
  
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

  // Fetch usage from operation_inputs within date range
  const { data: operationInputs } = useQuery({
    queryKey: ["operationInputs", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
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

  // Fetch fuel dispensing transactions within date range (for fuel inventory items)
  const { data: fuelTransactions } = useQuery({
    queryKey: ["fuelTransactionsForInventory", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select("gallons, transaction_date, fuel_tanks!inner(fuel_type)")
        .eq("transaction_type", "dispense")
        .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
        .lte("transaction_date", format(endDate, "yyyy-MM-dd") + "T23:59:59");
      
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

  // Aggregate usage data by item (from operations + fuel transactions)
  const usageByItem = useMemo(() => {
    const usage: Record<string, number> = {};
    
    // Add usage from operation_inputs
    if (operationInputs) {
      operationInputs.forEach((input) => {
        const itemId = input.inventory_item_id;
        usage[itemId] = (usage[itemId] || 0) + Number(input.quantity_used);
      });
    }
    
    // Add fuel dispensing usage - match by fuel type to inventory items
    if (fuelTransactions && items) {
      // Find fuel inventory items
      const fuelItems = items.filter(item => item.function === 'fuel');
      
      fuelTransactions.forEach((tx) => {
        const fuelType = tx.fuel_tanks?.fuel_type?.toLowerCase() || '';
        // Match fuel type to inventory item by commercial_name
        const matchingItem = fuelItems.find(item => 
          item.commercial_name.toLowerCase().includes(fuelType) ||
          fuelType.includes(item.commercial_name.toLowerCase())
        );
        
        if (matchingItem) {
          usage[matchingItem.id] = (usage[matchingItem.id] || 0) + Number(tx.gallons);
        }
      });
    }
    
    return usage;
  }, [operationInputs, fuelTransactions, items]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!items || !sortConfig.key || !sortConfig.direction) return items || [];

    return [...items].sort((a, b) => {
      const key = sortConfig.key;
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (key) {
        case "commercial_name":
        case "molecule_name":
        case "function":
          aVal = (a[key as keyof typeof a] as string) || "";
          bVal = (b[key as keyof typeof b] as string) || "";
          break;
        case "stock":
          aVal = Number(a.current_quantity);
          bVal = Number(b.current_quantity);
          break;
        case "amount_purchased":
          aVal = purchasesByItem[a.id]?.totalPurchased || 0;
          bVal = purchasesByItem[b.id]?.totalPurchased || 0;
          break;
        case "amount_used":
          aVal = usageByItem[a.id] || 0;
          bVal = usageByItem[b.id] || 0;
          break;
        case "co2_equivalent":
          aVal = a.co2_equivalent || 0;
          bVal = b.co2_equivalent || 0;
          break;
        case "suppliers":
          aVal = purchasesByItem[a.id]?.suppliers?.size || 0;
          bVal = purchasesByItem[b.id]?.suppliers?.size || 0;
          break;
        case "documents":
          aVal = purchasesByItem[a.id]?.documents?.size || 0;
          bVal = purchasesByItem[b.id]?.documents?.size || 0;
          break;
        default:
          return 0;
      }

      // Handle nulls
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Handle numbers
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Handle strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortConfig.direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [items, sortConfig, purchasesByItem, usageByItem]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { key: "commercial_name", direction: "asc" }; // Reset to default
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

  // Build export data based on visible columns
  const buildExportRow = (item: NonNullable<typeof items>[0]) => {
    const itemPurchases = purchasesByItem[item.id];
    const row: Record<string, string | number> = {};

    if (isVisible("commercial_name")) row["Commercial Name"] = item.commercial_name;
    if (isVisible("molecule_name")) row["Molecule Name"] = item.molecule_name || "-";
    if (isVisible("function")) row["Function"] = functionLabels[item.function] || item.function;
    if (isVisible("stock")) row["Stock"] = `${Number(item.current_quantity).toFixed(2)} ${item.use_unit}`;
    if (isVisible("amount_purchased")) row["Amount Purchased"] = itemPurchases 
      ? `${itemPurchases.totalPurchased.toFixed(2)} ${item.use_unit}` 
      : "-";
    if (isVisible("amount_used")) row["Amount Used"] = usageByItem[item.id] 
      ? `${usageByItem[item.id].toFixed(2)} ${item.use_unit}` 
      : "-";
    if (isVisible("suppliers")) row["Suppliers"] = itemPurchases && itemPurchases.suppliers.size > 0
      ? Array.from(itemPurchases.suppliers).join(", ")
      : "-";
    if (isVisible("documents")) row["Documents"] = itemPurchases && itemPurchases.documents.size > 0
      ? Array.from(itemPurchases.documents).join(", ")
      : "-";
    if (isVisible("co2_equivalent")) row["CO₂ Equivalent"] = item.co2_equivalent ? `${item.co2_equivalent} kg` : "-";

    return row;
  };

  const exportToExcel = async () => {
    if (!sortedItems || sortedItems.length === 0) {
      toast.error("No items to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Inventory");

      // Get visible columns for headers
      const visibleCols = inventoryColumns.filter(col => isVisible(col.key));
      const headerLabels = visibleCols.map(col => col.label);
      
      // Define columns
      worksheet.columns = headerLabels.map(label => ({
        header: label,
        key: label,
        width: 20,
      }));

      // Add data rows
      sortedItems.forEach(item => {
        const row = buildExportRow(item);
        worksheet.addRow(row);
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };

      // Generate file and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventory_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success("Excel export successful");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel");
    }
  };

  const exportToPDF = () => {
    if (!sortedItems || sortedItems.length === 0) {
      toast.error("No items to export");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(18);
    doc.text("Inventory Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Date Range: ${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`, 14, 30);
    doc.text(`Total Items: ${sortedItems.length}`, 14, 36);

    // Get visible columns
    const visibleCols = inventoryColumns.filter(col => isVisible(col.key));
    const headers = visibleCols.map(col => col.label);

    // Build table data
    const tableData = sortedItems.map(item => {
      const row = buildExportRow(item);
      return headers.map(header => String(row[header] || "-"));
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 42,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(`inventory_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.pdf`);
    toast.success("PDF export successful");
  };

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
                          onClick={() => navigate(`/operations?tab=input-usage&inputId=${item.id}`)}
                          title="Ver uso en operaciones"
                        >
                          <BarChart3 className="h-4 w-4" />
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
