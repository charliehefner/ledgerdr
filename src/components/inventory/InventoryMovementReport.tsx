import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarIcon, FileSpreadsheet, FileText, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InventoryItem } from "./types";
import { functionLabels } from "./constants";
import { useInventoryMovementExport } from "./useInventoryMovementExport";

interface InventoryMovementReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReportRow {
  id: string;
  commercial_name: string;
  molecule_name: string | null;
  function: string;
  use_unit: string;
  stock: number;
  purchaseUnits: number;
  purchaseValue: number;
  useUnits: number;
  useValue: number;
  co2ePerUnit: number | null;
  co2e: number;
}

export function InventoryMovementReport({ open, onOpenChange }: InventoryMovementReportProps) {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  // Fetch inventory items
  const { data: items } = useQuery({
    queryKey: ["inventoryItemsForCO2Report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("commercial_name");
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: open,
  });

  // Fetch purchases within date range with pricing info
  const { data: purchases } = useQuery({
    queryKey: [
      "inventoryPurchasesForCO2Report",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_purchases")
        .select("item_id, quantity, packaging_quantity, unit_price, total_price")
        .gte("purchase_date", format(startDate, "yyyy-MM-dd"))
        .lte("purchase_date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch usage from operation_inputs within date range
  const { data: operationInputs } = useQuery({
    queryKey: [
      "operationInputsForCO2Report",
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
    enabled: open,
  });

  // Fetch fuel dispensing transactions within date range
  const { data: fuelTransactions } = useQuery({
    queryKey: [
      "fuelTransactionsForCO2Report",
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
    enabled: open,
  });

  // Build report data
  const reportData = useMemo<ReportRow[]>(() => {
    if (!items) return [];

    // Aggregate purchases by item
    const purchasesByItem: Record<string, { units: number; value: number }> = {};
    purchases?.forEach((p) => {
      const packagingQty = Number(p.packaging_quantity) || 1;
      const units = Number(p.quantity) * packagingQty;
      const value = Number(p.total_price) || 0;
      
      if (!purchasesByItem[p.item_id]) {
        purchasesByItem[p.item_id] = { units: 0, value: 0 };
      }
      purchasesByItem[p.item_id].units += units;
      purchasesByItem[p.item_id].value += value;
    });

    // Aggregate usage by item
    const usageByItem: Record<string, number> = {};
    operationInputs?.forEach((input) => {
      const itemId = input.inventory_item_id;
      usageByItem[itemId] = (usageByItem[itemId] || 0) + Number(input.quantity_used);
    });

    // Add fuel dispensing usage
    const fuelItems = items.filter((item) => item.function === "fuel");
    fuelTransactions?.forEach((tx) => {
      const fuelType = tx.fuel_tanks?.fuel_type?.toLowerCase() || "";
      const matchingItem = fuelItems.find(
        (item) =>
          item.commercial_name.toLowerCase().includes(fuelType) ||
          fuelType.includes(item.commercial_name.toLowerCase())
      );
      if (matchingItem) {
        usageByItem[matchingItem.id] = (usageByItem[matchingItem.id] || 0) + Number(tx.gallons);
      }
    });

    // Build rows - only include items with movement
    return items
      .filter((item) => purchasesByItem[item.id] || usageByItem[item.id])
      .map((item) => {
        const purchaseData = purchasesByItem[item.id] || { units: 0, value: 0 };
        const useUnits = usageByItem[item.id] || 0;
        
        // Calculate use value based on average purchase price or item price
        const avgPricePerUnit = purchaseData.units > 0 
          ? purchaseData.value / purchaseData.units 
          : item.price_per_purchase_unit / (item.purchase_unit_quantity || 1);
        const useValue = useUnits * avgPricePerUnit;
        
        // CO2-e = usage units × co2_equivalent factor
        const co2e = useUnits * (item.co2_equivalent || 0);

        return {
          id: item.id,
          commercial_name: item.commercial_name,
          molecule_name: item.molecule_name,
          function: item.function,
          use_unit: item.use_unit,
          stock: Number(item.current_quantity),
          purchaseUnits: purchaseData.units,
          purchaseValue: purchaseData.value,
          useUnits,
          useValue,
          co2ePerUnit: item.co2_equivalent,
          co2e,
        };
      });
  }, [items, purchases, operationInputs, fuelTransactions]);

  // Calculate totals
  const totals = useMemo(() => {
    return reportData.reduce(
      (acc, row) => ({
        purchaseValue: acc.purchaseValue + row.purchaseValue,
        useValue: acc.useValue + row.useValue,
        co2e: acc.co2e + row.co2e,
      }),
      { purchaseValue: 0, useValue: 0, co2e: 0 }
    );
  }, [reportData]);

  const { exportToExcel, exportToPDF } = useInventoryMovementExport({
    reportData,
    totals,
    startDate,
    endDate,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 2) => {
    return value.toFixed(decimals);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Inventory Movement Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Range and Export */}
          <div className="flex flex-wrap items-center gap-4 justify-between">
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
          </div>

          {/* Report Table */}
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commercial Name</TableHead>
                  <TableHead>Molecule</TableHead>
                  <TableHead>Function</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Purchase Units</TableHead>
                  <TableHead className="text-right">Purchase Value</TableHead>
                  <TableHead className="text-right">Use Units</TableHead>
                  <TableHead className="text-right">Use Value</TableHead>
                  <TableHead className="text-right">CO₂-e/Unit</TableHead>
                  <TableHead className="text-right">CO₂-e (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No movement data for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {reportData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.commercial_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.molecule_name || "-"}</TableCell>
                        <TableCell>{functionLabels[row.function] || row.function}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.stock)} {row.use_unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.purchaseUnits > 0 ? `${formatNumber(row.purchaseUnits)} ${row.use_unit}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.purchaseValue > 0 ? formatCurrency(row.purchaseValue) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.useUnits > 0 ? `${formatNumber(row.useUnits)} ${row.use_unit}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.useValue > 0 ? formatCurrency(row.useValue) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.co2ePerUnit != null ? formatNumber(row.co2ePerUnit) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.co2e > 0 ? formatNumber(row.co2e) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={5} className="text-right">Totals:</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.purchaseValue)}</TableCell>
                      <TableCell className="text-right"></TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.useValue)}</TableCell>
                      <TableCell className="text-right"></TableCell>
                      <TableCell className="text-right">{formatNumber(totals.co2e)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
