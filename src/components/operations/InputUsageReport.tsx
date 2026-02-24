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
import { CalendarIcon, FileSpreadsheet, FileText, Search, ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfMonth, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import ExcelJS from "exceljs";

interface OperationWithInput {
  id: string;
  operation_date: string;
  hectares_done: number;
  driver: string | null;
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
      price_per_purchase_unit: number;
      purchase_unit_quantity: number;
    };
  }>;
}

interface InventoryItem {
  id: string;
  commercial_name: string;
  use_unit: string;
  function: string;
  is_active: boolean;
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

  // Fetch inventory items (inputs)
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory-items-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, use_unit, function, is_active")
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
          fields(name, farms(name)),
          fuel_equipment(name),
          operation_inputs(id, quantity_used, inventory_items(id, commercial_name, use_unit, price_per_purchase_unit, purchase_unit_quantity))
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
    if (!selectedInput || !inventoryItems) return null;
    return inventoryItems.find((i) => i.id === selectedInput);
  }, [selectedInput, inventoryItems]);

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

      // Get all inputs or just the selected one
      const inputsToProcess = selectedInput === "all"
        ? op.operation_inputs || []
        : (op.operation_inputs || []).filter((input) => input.inventory_items.id === selectedInput);

      inputsToProcess.forEach((inputUsage) => {
        const hectares = op.hectares_done || 0;
        const amount = inputUsage.quantity_used;
        const amountPerHectare = hectares > 0 ? amount / hectares : 0;
        const purchaseQty = inputUsage.inventory_items?.purchase_unit_quantity || 1;
        const pricePerUnit = inputUsage.inventory_items?.price_per_purchase_unit ?? 0;
        const costPerUnit = purchaseQty > 0 ? pricePerUnit / purchaseQty : 0;

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

    // Sort by date descending, then by input name
    return results.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.inputName.localeCompare(b.inputName);
    });
  }, [operations, fields, startDate, endDate, selectedInput, selectedFarm, selectedFields, hasSearched]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalAmount = usageData.reduce((sum, row) => sum + row.amount, 0);
    const totalHectares = usageData.reduce((sum, row) => sum + row.hectares, 0);
    const avgPerHectare = totalHectares > 0 ? totalAmount / totalHectares : 0;
    const totalCost = usageData.reduce((sum, row) => sum + row.costPerUnit * row.amount, 0);
    return { totalAmount, totalHectares, avgPerHectare, totalCost };
  }, [usageData]);

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
            ) : (
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
