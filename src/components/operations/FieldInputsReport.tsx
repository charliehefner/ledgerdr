import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, FileSpreadsheet, Search } from "lucide-react";
import { format, startOfMonth, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import ExcelJS from "exceljs";

interface OperationWithInput {
  id: string;
  operation_date: string;
  hectares_done: number;
  driver: string | null;
  field_id: string;
  fuel_equipment: { name: string } | null;
  operation_types: { name: string };
  operation_inputs: Array<{
    id: string;
    quantity_used: number;
    inventory_items: {
      id: string;
      commercial_name: string;
      use_unit: string;
    };
  }>;
}

interface Farm {
  id: string;
  name: string;
}

interface Field {
  id: string;
  name: string;
  farm_id: string;
  hectares: number | null;
  farms?: { name: string };
}

interface InputRow {
  operationId: string;
  date: string;
  operationType: string;
  inputName: string;
  inputUnit: string;
  amount: number;
  hectares: number;
  amountPerHectare: number;
  tractor: string;
}

interface FieldInputsReportProps {
  initialFieldId?: string | null;
}

export function FieldInputsReport({ initialFieldId }: FieldInputsReportProps = {}) {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [selectedField, setSelectedField] = useState<string>(initialFieldId || "");
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch farms
  const { data: farms } = useQuery({
    queryKey: ["farms-for-field-inputs"],
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
    queryKey: ["fields-for-field-inputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("id, name, farm_id, hectares, farms(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Field[];
    },
  });

  // Fetch operations with inputs
  const { data: operations, isLoading } = useQuery({
    queryKey: ["operations-for-field-inputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select(`
          id,
          operation_date,
          hectares_done,
          driver,
          field_id,
          fuel_equipment(name),
          operation_types(name),
          operation_inputs(id, quantity_used, inventory_items(id, commercial_name, use_unit))
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

  // Get selected field details
  const selectedFieldDetails = useMemo(() => {
    if (!selectedField || !fields) return null;
    return fields.find((f) => f.id === selectedField);
  }, [selectedField, fields]);

  // Calculate input data for selected field
  const inputData = useMemo(() => {
    if (!operations || !startDate || !endDate || !selectedField || !hasSearched) return [];

    const results: InputRow[] = [];

    operations.forEach((op) => {
      if (op.field_id !== selectedField) return;

      const opDate = parseDateLocal(op.operation_date);
      const inDateRange = isWithinInterval(opDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });

      if (!inDateRange) return;

      // Add each input as a separate row
      op.operation_inputs?.forEach((input) => {
        const hectares = op.hectares_done || 0;
        const amount = input.quantity_used;
        const amountPerHectare = hectares > 0 ? amount / hectares : 0;

        results.push({
          operationId: op.id,
          date: op.operation_date,
          operationType: op.operation_types?.name || "-",
          inputName: input.inventory_items.commercial_name,
          inputUnit: input.inventory_items.use_unit,
          amount,
          hectares,
          amountPerHectare,
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
  }, [operations, startDate, endDate, selectedField, hasSearched]);

  // Calculate aggregated totals by input
  const inputTotals = useMemo(() => {
    const totals: Record<string, { name: string; unit: string; totalAmount: number; totalHectares: number }> = {};
    
    inputData.forEach((row) => {
      if (!totals[row.inputName]) {
        totals[row.inputName] = {
          name: row.inputName,
          unit: row.inputUnit,
          totalAmount: 0,
          totalHectares: 0,
        };
      }
      totals[row.inputName].totalAmount += row.amount;
      totals[row.inputName].totalHectares += row.hectares;
    });

    return Object.values(totals).map((t) => ({
      ...t,
      avgPerHectare: t.totalHectares > 0 ? t.totalAmount / t.totalHectares : 0,
    }));
  }, [inputData]);

  const handleFarmChange = (farmId: string) => {
    setSelectedFarm(farmId);
    setSelectedField("");
  };

  const handleSearch = () => {
    setHasSearched(true);
  };

  const exportToExcel = async () => {
    if (inputData.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    
    // Detailed sheet
    const detailSheet = workbook.addWorksheet("Detalle");

    // Add title
    detailSheet.mergeCells("A1:H1");
    detailSheet.getCell("A1").value = `Insumos Aplicados: ${selectedFieldDetails?.name || ""}`;
    detailSheet.getCell("A1").font = { bold: true, size: 14 };
    detailSheet.getCell("A1").alignment = { horizontal: "center" };

    // Add field info
    detailSheet.mergeCells("A2:H2");
    detailSheet.getCell("A2").value = `Finca: ${selectedFieldDetails?.farms?.name || ""} | Período: ${format(startDate!, "dd/MM/yyyy")} - ${format(endDate!, "dd/MM/yyyy")}`;
    detailSheet.getCell("A2").alignment = { horizontal: "center" };

    // Add headers
    const headers = ["Fecha", "Operación", "Insumo", "Unidad", "Cantidad", "Hectáreas", "Cantidad/Ha", "Tractor/Operador"];
    detailSheet.addRow([]);
    const headerRow = detailSheet.addRow(headers);
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
    inputData.forEach((row) => {
      detailSheet.addRow([
        format(parseDateLocal(row.date), "dd/MM/yyyy"),
        row.operationType,
        row.inputName,
        row.inputUnit,
        row.amount.toFixed(2),
        row.hectares.toFixed(2),
        row.amountPerHectare.toFixed(2),
        row.tractor,
      ]);
    });

    // Auto-fit columns
    detailSheet.columns.forEach((column) => {
      column.width = 16;
    });

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Resumen");
    summarySheet.mergeCells("A1:D1");
    summarySheet.getCell("A1").value = `Resumen de Insumos: ${selectedFieldDetails?.name || ""}`;
    summarySheet.getCell("A1").font = { bold: true, size: 14 };
    summarySheet.getCell("A1").alignment = { horizontal: "center" };

    const summaryHeaders = ["Insumo", "Total Aplicado", "Total Hectáreas", "Promedio/Ha"];
    summarySheet.addRow([]);
    const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
    summaryHeaderRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    });

    inputTotals.forEach((total) => {
      summarySheet.addRow([
        total.name,
        `${total.totalAmount.toFixed(2)} ${total.unit}`,
        total.totalHectares.toFixed(2),
        `${total.avgPerHectare.toFixed(2)} ${total.unit}/Ha`,
      ]);
    });

    summarySheet.columns.forEach((column) => {
      column.width = 20;
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Insumos_Campo_${selectedFieldDetails?.name || "report"}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Insumos por Campo</CardTitle>
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

            {/* Field Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Campo</label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar campo" />
                </SelectTrigger>
                <SelectContent>
                  {filteredFields?.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch} disabled={!startDate || !endDate || !selectedField}>
              <Search className="mr-2 h-4 w-4" />
              Generar Reporte
            </Button>

            {/* Export Button */}
            {inputData.length > 0 && (
              <Button variant="outline" onClick={exportToExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && selectedField && (
        <>
          {/* Summary Card */}
          {inputTotals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Resumen - {selectedFieldDetails?.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Finca: {selectedFieldDetails?.farms?.name} | {startDate && endDate && `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Total Aplicado</TableHead>
                        <TableHead className="text-right">Total Hectáreas</TableHead>
                        <TableHead className="text-right">Promedio/Ha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inputTotals.map((total) => (
                        <TableRow key={total.name}>
                          <TableCell className="font-medium">{total.name}</TableCell>
                          <TableCell className="text-right">{total.totalAmount.toFixed(2)} {total.unit}</TableCell>
                          <TableCell className="text-right">{total.totalHectares.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{total.avgPerHectare.toFixed(2)} {total.unit}/Ha</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detail Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Detalle de Aplicaciones - {selectedFieldDetails?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando datos...</div>
              ) : inputData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron aplicaciones de insumos para los filtros seleccionados.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Operación</TableHead>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Hectáreas</TableHead>
                        <TableHead className="text-right">Cantidad/Ha</TableHead>
                        <TableHead>Tractor/Operador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inputData.map((row, idx) => (
                        <TableRow key={`${row.operationId}-${idx}`}>
                          <TableCell>{format(parseDateLocal(row.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{row.operationType}</TableCell>
                          <TableCell>{row.inputName}</TableCell>
                          <TableCell className="text-right">{row.amount.toFixed(2)} {row.inputUnit}</TableCell>
                          <TableCell className="text-right">{row.hectares.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.amountPerHectare.toFixed(2)}</TableCell>
                          <TableCell>{row.tractor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
