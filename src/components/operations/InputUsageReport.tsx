import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, FileSpreadsheet, FileText, Search, ChevronDown, Download, BarChart3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfMonth, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import ExcelJS from "exceljs";
import { formatMoney } from "@/lib/formatters";

const DIESEL_VIRTUAL_ID = "__diesel__";

interface OperationWithInput {
  id: string;
  operation_date: string;
  hectares_done: number;
  driver: string | null;
  tractor_id: string | null;
  fields: {
    name: string;
    farms: { name: string };
  };
  fuel_equipment: { name: string } | null;
  operation_inputs: Array<{
    id: string;
    quantity_used: number;
    inventory_items: {
      id: string;
      commercial_name: string;
      use_unit: string;
      molecule_name: string | null;
      co2_equivalent: number | null;
    };
  }>;
}

interface InventoryItem {
  id: string;
  commercial_name: string;
  use_unit: string;
  function: string;
  is_active: boolean;
  molecule_name: string | null;
  co2_equivalent: number | null;
}

interface MoleculeSummaryRow {
  moleculeName: string;
  useUnit: string;
  totalAmount: number;
  costPerUnit: number;
  totalCost: number;
  totalCO2e: number;
}

interface Farm {
  id: string;
  name: string;
}

interface Field {
  id: string;
  name: string;
  farm_id: string;
}

interface UsageRow {
  operationId: string;
  date: string;
  fieldName: string;
  inputName: string;
  inputUnit: string;
  amount: number;
  hectares: number;
  amountPerHectare: number;
  costPerUnit: number;
  tractor: string;
}

interface InputUsageReportProps {
  initialInputId?: string | null;
}

export function InputUsageReport({ initialInputId }: InputUsageReportProps = {}) {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedInput, setSelectedInput] = useState<string>(initialInputId || "");
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [fieldPopoverOpen, setFieldPopoverOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Fetch inventory items (inputs)
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory-items-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, use_unit, function, is_active, molecule_name, co2_equivalent")
        .order("commercial_name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Fetch farms
  const { data: farms } = useQuery({
    queryKey: ["farms-for-input-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Farm[];
    },
  });

  // Fetch fields
  const { data: fields } = useQuery({
    queryKey: ["fields-for-input-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("id, name, farm_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Field[];
    },
  });

  // Fetch purchase history for weighted average cost per use unit
  const { data: purchases } = useQuery({
    queryKey: ["inventory-purchases-for-cost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_purchases")
        .select("item_id, quantity, unit_price, packaging_quantity");
      if (error) throw error;
      return data as Array<{ item_id: string; quantity: number; unit_price: number; packaging_quantity: number }>;
    },
  });

  // Fetch fuel dispense transactions to correlate diesel usage with operations
  const { data: fuelTransactions } = useQuery({
    queryKey: ["fuel-dispense-for-input-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select("id, equipment_id, gallons, transaction_date, transaction_type, tank_id, fuel_tanks!inner(fuel_type)")
        .eq("transaction_type", "dispense");
      if (error) throw error;
      return data as Array<{
        id: string;
        equipment_id: string | null;
        gallons: number;
        transaction_date: string;
        transaction_type: string;
        tank_id: string;
        fuel_tanks: { fuel_type: string };
      }>;
    },
  });

  // Fetch fuel purchase transactions for diesel cost per gallon
  const { data: fuelPurchases } = useQuery({
    queryKey: ["fuel-purchases-for-cost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select("gallons, notes, tank_id")
        .eq("transaction_type", "purchase");
      if (error) throw error;
      return data;
    },
  });

  // Build a map of item_id -> weighted average cost per use unit
  // Formula: cost_per_use_unit = unit_price / packaging_quantity
  // Weighted average across purchases by number of packages (quantity)
  const costPerUnitMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!purchases || purchases.length === 0) return map;
    const grouped: Record<string, { weightedCostSum: number; totalPackages: number }> = {};
    for (const p of purchases) {
      const pkgQty = Number(p.packaging_quantity) || 1;
      const price = Number(p.unit_price) || 0;
      const qty = Number(p.quantity) || 0;
      if (qty === 0) continue;
      const costPerUseUnit = pkgQty > 0 ? price / pkgQty : 0;
      if (!grouped[p.item_id]) grouped[p.item_id] = { weightedCostSum: 0, totalPackages: 0 };
      grouped[p.item_id].weightedCostSum += costPerUseUnit * qty;
      grouped[p.item_id].totalPackages += qty;
    }
    for (const [id, g] of Object.entries(grouped)) {
      map.set(id, g.totalPackages > 0 ? g.weightedCostSum / g.totalPackages : 0);
    }
    return map;
  }, [purchases]);

  // Fetch operations with inputs
  const { data: operations, isLoading } = useQuery({
    queryKey: ["operations-with-inputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select(`
          id,
          operation_date,
          hectares_done,
          driver,
          tractor_id,
          fields(name, farms(name)),
          fuel_equipment(name),
          operation_inputs(id, quantity_used, inventory_items(id, commercial_name, use_unit, molecule_name, co2_equivalent))
        `)
        .order("operation_date", { ascending: false });
      if (error) throw error;
      return data as OperationWithInput[];
    },
  });

  // Filter fields by selected farm
  const filteredFields = useMemo(() => {
    if (!fields) return [];
    if (selectedFarm === "all") return fields;
    return fields.filter((f) => f.farm_id === selectedFarm);
  }, [fields, selectedFarm]);

  // Get selected input details
  const selectedInputDetails = useMemo(() => {
    if (!selectedInput) return null;
    if (selectedInput === DIESEL_VIRTUAL_ID) {
      return { id: DIESEL_VIRTUAL_ID, commercial_name: "Diesel", use_unit: "gal", function: "fuel", is_active: true, molecule_name: null, co2_equivalent: null } as InventoryItem;
    }
    if (!inventoryItems) return null;
    return inventoryItems.find((i) => i.id === selectedInput);
  }, [selectedInput, inventoryItems]);

  // Build diesel usage rows by matching fuel dispense transactions to operations
  const dieselUsageRows = useMemo((): UsageRow[] => {
    if (!fuelTransactions || !operations || !startDate || !endDate || !hasSearched) return [];
    if (selectedInput !== "all" && selectedInput !== DIESEL_VIRTUAL_ID) return [];

    const results: UsageRow[] = [];

    // Build lookup: equipment_id + date -> operations on that day
    const opsLookup = new Map<string, OperationWithInput[]>();
    operations.forEach((op) => {
      if (!op.tractor_id) return;
      const key = `${op.tractor_id}__${op.operation_date}`;
      if (!opsLookup.has(key)) opsLookup.set(key, []);
      opsLookup.get(key)!.push(op);
    });

    // For each fuel dispense, find matching operations and distribute gallons
    // Look up diesel cost from inventory purchases
    const dieselItem = inventoryItems?.find((item) => item.function === 'fuel');
    const dieselCostPerUnit = dieselItem ? (costPerUnitMap.get(dieselItem.id) ?? 0) : 0;

    fuelTransactions.forEach((ft) => {
      if (!ft.equipment_id) return;
      const txDate = ft.transaction_date.substring(0, 10); // extract date part
      const txDateObj = parseDateLocal(txDate);
      const inDateRange = isWithinInterval(txDateObj, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });
      if (!inDateRange) return;

      const key = `${ft.equipment_id}__${txDate}`;
      const matchedOps = opsLookup.get(key) || [];

      if (matchedOps.length === 0) {
        // No matching operation - still show the fuel usage but field = "Sin operación"
        results.push({
          operationId: `fuel-${ft.id}`,
          date: txDate,
          fieldName: "Sin operación",
          inputName: "Diesel",
          inputUnit: "gal",
          amount: Number(ft.gallons) || 0,
          hectares: 0,
          amountPerHectare: 0,
          costPerUnit: dieselCostPerUnit,
          tractor: "-",
        });
        return;
      }

      // Distribute gallons proportionally by hectares, or evenly
      const totalHa = matchedOps.reduce((s, o) => s + (o.hectares_done || 0), 0);
      matchedOps.forEach((op) => {
        const field = fields?.find((f) => f.name === op.fields?.name);
        // Apply farm/field filters
        if (selectedFarm !== "all" && field?.farm_id !== selectedFarm) return;
        if (selectedFields.length > 0 && field && !selectedFields.includes(field.id)) return;

        const gallons = Number(ft.gallons) || 0;
        const share = totalHa > 0
          ? ((op.hectares_done || 0) / totalHa) * gallons
          : gallons / matchedOps.length;
        const hectares = op.hectares_done || 0;

        results.push({
          operationId: `fuel-${ft.id}-${op.id}`,
          date: op.operation_date,
          fieldName: op.fields?.name || "Unknown",
          inputName: "Diesel",
          inputUnit: "gal",
          amount: share,
          hectares,
          amountPerHectare: hectares > 0 ? share / hectares : 0,
          costPerUnit: dieselCostPerUnit,
          tractor: op.fuel_equipment?.name || op.driver || "-",
        });
      });
    });

    return results;
  }, [fuelTransactions, operations, startDate, endDate, hasSearched, selectedInput, fields, selectedFarm, selectedFields, costPerUnitMap, inventoryItems]);

  // Calculate usage data based on filters
  const usageData = useMemo(() => {
    if (!operations || !startDate || !endDate || !hasSearched) return [];

    const results: UsageRow[] = [];

    operations.forEach((op) => {
      const opDate = parseDateLocal(op.operation_date);
      const inDateRange = isWithinInterval(opDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });

      if (!inDateRange) return;

      // Check farm filter
      const field = fields?.find((f) => f.name === op.fields?.name);
      if (selectedFarm !== "all" && field?.farm_id !== selectedFarm) return;

      // Check field filter (now supports multiple fields)
      if (selectedFields.length > 0 && field && !selectedFields.includes(field.id)) return;

      // Skip chemical inputs if only diesel is selected
      if (selectedInput === DIESEL_VIRTUAL_ID) return;

      // Get all inputs or just the selected one
      const inputsToProcess = selectedInput === "all"
        ? op.operation_inputs || []
        : (op.operation_inputs || []).filter((input) => input.inventory_items.id === selectedInput);

      inputsToProcess.forEach((inputUsage) => {
        const hectares = op.hectares_done || 0;
        const amount = inputUsage.quantity_used;
        const amountPerHectare = hectares > 0 ? amount / hectares : 0;
        const costPerUnit = costPerUnitMap.get(inputUsage.inventory_items.id) ?? 0;

        results.push({
          operationId: `${op.id}-${inputUsage.id}`,
          date: op.operation_date,
          fieldName: op.fields?.name || "Unknown",
          inputName: inputUsage.inventory_items.commercial_name,
          inputUnit: inputUsage.inventory_items.use_unit,
          amount,
          hectares,
          amountPerHectare,
          costPerUnit,
          tractor: op.fuel_equipment?.name || op.driver || "-",
        });
      });
    });

    // Add diesel rows
    results.push(...dieselUsageRows);

    // Sort by date descending, then by input name
    return results.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.inputName.localeCompare(b.inputName);
    });
  }, [operations, fields, startDate, endDate, selectedInput, selectedFarm, selectedFields, hasSearched, costPerUnitMap, dieselUsageRows]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalAmount = usageData.reduce((sum, row) => sum + row.amount, 0);
    const totalHectares = usageData.reduce((sum, row) => sum + row.hectares, 0);
    const avgPerHectare = totalHectares > 0 ? totalAmount / totalHectares : 0;
    const totalCost = usageData.reduce((sum, row) => sum + row.costPerUnit * row.amount, 0);
    return { totalAmount, totalHectares, avgPerHectare, totalCost };
  }, [usageData]);

  // Molecule summary: consolidate by molecule_name
  const moleculeSummary = useMemo((): MoleculeSummaryRow[] => {
    if (!operations || !startDate || !endDate || !hasSearched || !inventoryItems) return [];

    const grouped: Record<string, { totalAmount: number; totalCost: number; totalCO2e: number; useUnit: string }> = {};

    operations.forEach((op) => {
      const opDate = parseDateLocal(op.operation_date);
      const inDateRange = isWithinInterval(opDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });
      if (!inDateRange) return;

      const field = fields?.find((f) => f.name === op.fields?.name);
      if (selectedFarm !== "all" && field?.farm_id !== selectedFarm) return;
      if (selectedFields.length > 0 && field && !selectedFields.includes(field.id)) return;

      const inputsToProcess = selectedInput === "all"
        ? op.operation_inputs || []
        : (op.operation_inputs || []).filter((input) => input.inventory_items.id === selectedInput);

      inputsToProcess.forEach((inputUsage) => {
        const item = inputUsage.inventory_items;
        const moleculeName = item.molecule_name || item.commercial_name;
        const amount = inputUsage.quantity_used;
        const costPerUnit = costPerUnitMap.get(item.id) ?? 0;
        const co2e = item.co2_equivalent ?? 0;

        if (!grouped[moleculeName]) {
          grouped[moleculeName] = { totalAmount: 0, totalCost: 0, totalCO2e: 0, useUnit: item.use_unit };
        }
        grouped[moleculeName].totalAmount += amount;
        grouped[moleculeName].totalCost += costPerUnit * amount;
        grouped[moleculeName].totalCO2e += co2e * amount;
      });
    });

    return Object.entries(grouped)
      .map(([name, g]) => ({
        moleculeName: name,
        useUnit: g.useUnit,
        totalAmount: g.totalAmount,
        costPerUnit: g.totalAmount > 0 ? g.totalCost / g.totalAmount : 0,
        totalCost: g.totalCost,
        totalCO2e: g.totalCO2e,
      }))
      .sort((a, b) => a.moleculeName.localeCompare(b.moleculeName));
  }, [operations, fields, inventoryItems, startDate, endDate, selectedInput, selectedFarm, selectedFields, hasSearched, costPerUnitMap]);

  const handleFarmChange = (farmId: string) => {
    setSelectedFarm(farmId);
    setSelectedFields([]);
  };

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((id) => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleSelectAllFields = () => {
    if (selectedFields.length === filteredFields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(filteredFields.map((f) => f.id));
    }
  };

  const getFieldSelectorLabel = () => {
    if (selectedFields.length === 0) return "Todos los Campos";
    if (selectedFields.length === 1) {
      const field = filteredFields.find((f) => f.id === selectedFields[0]);
      return field?.name || "1 campo";
    }
    return `${selectedFields.length} campos`;
  };

  const handleSearch = () => {
    setHasSearched(true);
  };

  const exportToExcel = async () => {
    if (usageData.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Uso de Insumo");

    // Add title
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = `Reporte de Uso: ${selectedInputDetails?.commercial_name || ""}`;
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // Add date range
    worksheet.mergeCells("A2:H2");
    worksheet.getCell("A2").value = `Período: ${format(startDate!, "dd/MM/yyyy")} - ${format(endDate!, "dd/MM/yyyy")}`;
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Add headers
    const unit = selectedInputDetails?.use_unit || "units";
    const headers = ["Fecha", "Campo", `Cantidad (${unit})`, "Hectáreas", `${unit}/Ha`, `Costo/${unit}`, "Costo Total", "Tractor/Operador"];
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Add data rows
    usageData.forEach((row) => {
      worksheet.addRow([
        format(parseDateLocal(row.date), "dd/MM/yyyy"),
        row.fieldName,
        row.amount.toFixed(2),
        row.hectares.toFixed(2),
        row.amountPerHectare.toFixed(2),
        row.costPerUnit.toFixed(2),
        (row.costPerUnit * row.amount).toFixed(2),
        row.tractor,
      ]);
    });

    // Add totals row
    worksheet.addRow([]);
    const totalsRow = worksheet.addRow([
      "TOTALES",
      "",
      totals.totalAmount.toFixed(2),
      totals.totalHectares.toFixed(2),
      totals.avgPerHectare.toFixed(2),
      "",
      totals.totalCost.toFixed(2),
      "",
    ]);
    totalsRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 16;
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Uso_Insumo_${selectedInputDetails?.commercial_name || "report"}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (usageData.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const unit = selectedInputDetails?.use_unit || "units";
    doc.setFontSize(14);
    doc.text(`Reporte de Uso: ${selectedInputDetails?.commercial_name || "Todos"}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${format(startDate!, "dd/MM/yyyy")} - ${format(endDate!, "dd/MM/yyyy")}`, 14, 22);

    autoTable(doc, {
      head: [["Fecha", "Campo", `Cantidad (${unit})`, "Hectáreas", `${unit}/Ha`, `Costo/${unit}`, "Costo Total", "Tractor/Operador"]],
      body: usageData.map((row) => [
        format(parseDateLocal(row.date), "dd/MM/yyyy"),
        row.fieldName,
        row.amount.toFixed(2),
        row.hectares.toFixed(2),
        row.amountPerHectare.toFixed(2),
        row.costPerUnit.toFixed(2),
        (row.costPerUnit * row.amount).toFixed(2),
        row.tractor,
      ]),
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      foot: [["TOTALES", "", totals.totalAmount.toFixed(2), totals.totalHectares.toFixed(2), totals.avgPerHectare.toFixed(2), "", totals.totalCost.toFixed(2), ""]],
      footStyles: { fontStyle: "bold" },
    });

    doc.save(`Uso_Insumo_${selectedInputDetails?.commercial_name || "report"}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uso de Insumo por Campo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd MMM yyyy", { locale: es }) : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">a</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd MMM yyyy", { locale: es }) : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Input Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Insumo</label>
              <Select value={selectedInput} onValueChange={setSelectedInput}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Seleccionar insumo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Insumos</SelectItem>
                  <SelectItem value={DIESEL_VIRTUAL_ID}>🛢️ Diesel (Combustible)</SelectItem>
                  {inventoryItems?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Farm Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Finca</label>
              <Select value={selectedFarm} onValueChange={handleFarmChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar finca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Fincas</SelectItem>
                  {farms?.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field Filter - Multi-select */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Campo (Cmd+click)</label>
              <Popover open={fieldPopoverOpen} onOpenChange={setFieldPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-[200px] justify-between font-normal"
                  >
                    <span className="truncate">{getFieldSelectorLabel()}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {/* Select All option */}
                    <div
                      className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={handleSelectAllFields}
                    >
                      <Checkbox
                        checked={selectedFields.length === filteredFields.length && filteredFields.length > 0}
                        className="pointer-events-none"
                      />
                      <span className="text-sm font-medium">
                        {selectedFields.length === filteredFields.length ? "Deseleccionar todos" : "Seleccionar todos"}
                      </span>
                    </div>
                    <div className="border-t my-1" />
                    {filteredFields.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-2">No hay campos</div>
                    ) : (
                      filteredFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => handleFieldToggle(field.id)}
                        >
                          <Checkbox
                            checked={selectedFields.includes(field.id)}
                            className="pointer-events-none"
                          />
                          <span className="text-sm">{field.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch} disabled={!startDate || !endDate}>
              <Search className="mr-2 h-4 w-4" />
              Generar Reporte
            </Button>

            {/* Export */}
            {usageData.length > 0 && (
              <>
                <Button
                  variant={showSummary ? "default" : "outline"}
                  onClick={() => setShowSummary((v) => !v)}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Resumen Moléculas
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-popover">
                    <DropdownMenuItem onClick={exportToExcel} className="text-excel">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Exportar a Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPDF}>
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar a PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedInput === "all" ? "Todos los Insumos" : (selectedInputDetails?.commercial_name || "Insumo")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {startDate && endDate && `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando datos...</div>
            ) : usageData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontró uso de este insumo para los filtros seleccionados.
              </div>
            ) : showSummary ? (
              /* Molecule Summary View */
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Molécula</TableHead>
                        <TableHead className="text-right">Cantidad Usada</TableHead>
                        <TableHead className="text-right">Costo/Unidad</TableHead>
                        <TableHead className="text-right">Costo Total</TableHead>
                        <TableHead className="text-right">CO₂-e (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moleculeSummary.map((row) => (
                        <TableRow key={row.moleculeName}>
                          <TableCell className="font-medium">{row.moleculeName}</TableCell>
                          <TableCell className="text-right">{row.totalAmount.toFixed(2)} {row.useUnit}</TableCell>
                          <TableCell className="text-right">{row.costPerUnit.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.totalCost.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.totalCO2e.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>TOTALES</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">
                          {moleculeSummary.reduce((s, r) => s + r.totalCost, 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {moleculeSummary.reduce((s, r) => s + r.totalCO2e, 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              /* Detail View */
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        {selectedInput === "all" && <TableHead>Insumo</TableHead>}
                        <TableHead>Campo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Hectáreas</TableHead>
                        <TableHead className="text-right">Unidad/Ha</TableHead>
                        <TableHead className="text-right">Costo/Unidad</TableHead>
                        <TableHead className="text-right">Costo Total</TableHead>
                        <TableHead>Tractor/Operador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageData.map((row) => (
                        <TableRow key={row.operationId}>
                          <TableCell>{format(parseDateLocal(row.date), "dd/MM/yyyy")}</TableCell>
                          {selectedInput === "all" && <TableCell>{row.inputName}</TableCell>}
                          <TableCell>{row.fieldName}</TableCell>
                          <TableCell className="text-right">{row.amount.toFixed(2)} {row.inputUnit}</TableCell>
                          <TableCell className="text-right">{row.hectares.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.amountPerHectare.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.costPerUnit.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{(row.costPerUnit * row.amount).toFixed(2)}</TableCell>
                          <TableCell>{row.tractor}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={selectedInput === "all" ? 3 : 2}>TOTALES</TableCell>
                        <TableCell className="text-right">{totals.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{totals.totalHectares.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{totals.avgPerHectare.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{totals.totalCost.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
