import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, FileSpreadsheet, FileText, Search, AlertTriangle, Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfDay, endOfDay, isWithinInterval, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import ExcelJS from "exceljs";

interface Operation {
  id: string;
  operation_date: string;
  field_id: string;
  operation_type_id: string;
  hectares_done: number;
  fields: {
    id: string;
    name: string;
    hectares: number | null;
    farms: { name: string };
  };
  operation_types: { name: string; is_mechanical: boolean };
  operation_inputs: Array<{
    id: string;
    quantity_used: number;
    inventory_items: {
      commercial_name: string;
      use_unit: string;
    };
  }>;
}

interface OperationType {
  id: string;
  name: string;
  is_active: boolean;
}

interface Farm {
  id: string;
  name: string;
  is_active: boolean;
}

interface Field {
  id: string;
  name: string;
  farm_id: string;
  hectares: number | null;
  is_active: boolean;
}

interface FieldProgress {
  fieldId: string;
  fieldName: string;
  farmName: string;
  operationTypeName: string;
  totalHectares: number;
  hectaresDone: number;
  hectaresRemaining: number;
  percentComplete: number;
  isOverage: boolean;
  inputs: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export function FieldProgressReport() {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedOperationType, setSelectedOperationType] = useState<string>("all");
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [selectedField, setSelectedField] = useState<string>("all");
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch operation types
  const { data: operationTypes } = useQuery({
    queryKey: ["operation-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_types")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as OperationType[];
    },
  });

  // Fetch farms
  const { data: farms } = useQuery({
    queryKey: ["farms-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Farm[];
    },
  });

  // Fetch fields
  const { data: fields } = useQuery({
    queryKey: ["fields-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("id, name, farm_id, hectares, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Field[];
    },
  });

  // Fetch all operations with related data
  const { data: operations, isLoading } = useQuery({
    queryKey: ["operations-for-report"],
    queryFn: async () => {
      // Fetch all operations (may exceed default 1000 row limit)
      let allData: Operation[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("operations")
          .select(`
            id,
            operation_date,
            field_id,
            operation_type_id,
            hectares_done,
            fields(id, name, hectares, farms(name)),
            operation_types(name, is_mechanical),
            operation_inputs(id, quantity_used, inventory_items(commercial_name, use_unit))
          `)
          .order("operation_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allData = allData.concat(data as Operation[]);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    },
  });

  // Calculate field progress based on filters
  const fieldProgressData = useMemo(() => {
    if (!operations || !startDate || !endDate || !hasSearched) return [];

    // Filter operations by date range, operation type, farm, and field
    const filtered = operations.filter((op) => {
      const opDate = parseDateLocal(op.operation_date);
      const inDateRange = isWithinInterval(opDate, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });
      const matchesType = selectedOperationType === "all" || op.operation_type_id === selectedOperationType;
      
      // Get farm_id for this operation's field
      const fieldData = fields?.find((f) => f.id === op.field_id);
      const matchesFarm = selectedFarm === "all" || fieldData?.farm_id === selectedFarm;
      const matchesField = selectedField === "all" || op.field_id === selectedField;
      
      return inDateRange && matchesType && matchesFarm && matchesField;
    });

    // Group by field AND operation type to show breakdown
    const fieldOpMap = new Map<string, FieldProgress>();

    filtered.forEach((op) => {
      const fieldId = op.field_id;
      const opTypeName = op.operation_types?.name || "Desconocida";
      const compositeKey = `${fieldId}__${opTypeName}`;
      const existing = fieldOpMap.get(compositeKey);

      if (existing) {
        existing.hectaresDone += op.hectares_done ?? 0;
        // Aggregate inputs
        op.operation_inputs?.forEach((input) => {
          const existingInput = existing.inputs.find(
            (i) => i.name === input.inventory_items.commercial_name
          );
          if (existingInput) {
            existingInput.quantity += input.quantity_used;
          } else {
            existing.inputs.push({
              name: input.inventory_items.commercial_name,
              quantity: input.quantity_used,
              unit: input.inventory_items.use_unit,
            });
          }
        });
      } else {
        const totalHectares = op.fields?.hectares || 0;
        const inputs: Array<{ name: string; quantity: number; unit: string }> = [];
        
        op.operation_inputs?.forEach((input) => {
          inputs.push({
            name: input.inventory_items.commercial_name,
            quantity: input.quantity_used,
            unit: input.inventory_items.use_unit,
          });
        });

        fieldOpMap.set(compositeKey, {
          fieldId,
          fieldName: op.fields?.name || "Unknown",
          farmName: op.fields?.farms?.name || "Unknown",
          operationTypeName: opTypeName,
          totalHectares,
          hectaresDone: op.hectares_done ?? 0,
          hectaresRemaining: 0, // calculated after
          percentComplete: 0, // calculated after
          isOverage: false, // calculated after
          inputs,
        });
      }
    });

    // Calculate remaining and percent
    const result: FieldProgress[] = [];
    fieldOpMap.forEach((field) => {
      field.hectaresRemaining = Math.max(0, field.totalHectares - field.hectaresDone);
      field.percentComplete = field.totalHectares > 0 
        ? Math.min(100, (field.hectaresDone / field.totalHectares) * 100)
        : 0;
      field.isOverage = field.hectaresDone > field.totalHectares;
      result.push(field);
    });

    // Sort by farm name, then field name, then operation type
    return result.sort((a, b) => {
      const farmCompare = a.farmName.localeCompare(b.farmName);
      if (farmCompare !== 0) return farmCompare;
      const fieldCompare = a.fieldName.localeCompare(b.fieldName);
      if (fieldCompare !== 0) return fieldCompare;
      return a.operationTypeName.localeCompare(b.operationTypeName);
    });
  }, [operations, fields, startDate, endDate, selectedOperationType, selectedFarm, selectedField, hasSearched]);

  // Filter fields by selected farm
  const filteredFields = useMemo(() => {
    if (!fields) return [];
    if (selectedFarm === "all") return fields;
    return fields.filter((f) => f.farm_id === selectedFarm);
  }, [fields, selectedFarm]);

  // Reset field selection when farm changes
  const handleFarmChange = (farmId: string) => {
    setSelectedFarm(farmId);
    setSelectedField("all");
  };

  const handleSearch = () => {
    setHasSearched(true);
  };

  const getOperationTypeName = () => {
    if (selectedOperationType === "all") return "Todas las Operaciones";
    return operationTypes?.find((t) => t.id === selectedOperationType)?.name || "";
  };

  const exportToExcel = async () => {
    if (fieldProgressData.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Progreso de Campos");

    // Add title
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = `Reporte de Progreso: ${getOperationTypeName()}`;
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // Add date range
    worksheet.mergeCells("A2:H2");
    worksheet.getCell("A2").value = `Período: ${format(startDate!, "dd/MM/yyyy")} - ${format(endDate!, "dd/MM/yyyy")}`;
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Add headers
    const headers = ["Finca", "Campo", "Tipo de Operación", "Ha Totales", "Ha Realizadas", "Ha Pendientes", "% Completado", "Insumos Utilizados"];
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
    fieldProgressData.forEach((field) => {
      const inputsStr = field.inputs.length > 0
        ? field.inputs.map((i) => `${i.name}: ${i.quantity.toFixed(2)} ${i.unit}`).join("; ")
        : "-";

      const row = worksheet.addRow([
        field.farmName,
        field.fieldName,
        field.operationTypeName,
        field.totalHectares,
        field.hectaresDone,
        field.hectaresRemaining,
        `${field.percentComplete.toFixed(1)}%`,
        inputsStr,
      ]);

      // Highlight overages in yellow
      if (field.isOverage) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFEB3B" },
          };
        });
      }
    });

    // Add totals row
    const totalDone = fieldProgressData.reduce((sum, f) => sum + f.hectaresDone, 0);
    const totalArea = fieldProgressData.reduce((sum, f) => sum + f.totalHectares, 0);
    const totalRemaining = fieldProgressData.reduce((sum, f) => sum + f.hectaresRemaining, 0);
    worksheet.addRow([]);
    const totalsRow = worksheet.addRow([
      "TOTALES",
      "",
      "",
      totalArea,
      totalDone,
      totalRemaining,
      totalArea > 0 ? `${((totalDone / totalArea) * 100).toFixed(1)}%` : "0%",
      "",
    ]);
    totalsRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 18;
    });
    worksheet.getColumn(8).width = 40; // Inputs column wider

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Progreso_Campos_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (fieldProgressData.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Reporte de Progreso: ${getOperationTypeName()}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${format(startDate!, "dd/MM/yyyy")} - ${format(endDate!, "dd/MM/yyyy")}`, 14, 22);

    const totalDone = fieldProgressData.reduce((sum, f) => sum + f.hectaresDone, 0);
    const totalArea = fieldProgressData.reduce((sum, f) => sum + f.totalHectares, 0);
    const totalRemaining = fieldProgressData.reduce((sum, f) => sum + f.hectaresRemaining, 0);

    autoTable(doc, {
      head: [["Finca", "Campo", "Tipo Operación", "Ha Totales", "Ha Realizadas", "Ha Pendientes", "% Completado", "Insumos"]],
      body: fieldProgressData.map((field) => [
        field.farmName,
        field.fieldName,
        field.operationTypeName,
        field.totalHectares.toFixed(1),
        field.hectaresDone.toFixed(1),
        field.hectaresRemaining.toFixed(1),
        `${field.percentComplete.toFixed(1)}%`,
        field.inputs.map((i) => `${i.name}: ${i.quantity.toFixed(2)} ${i.unit}`).join("; ") || "-",
      ]),
      startY: 28,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
      foot: [["TOTALES", "", "", totalArea.toFixed(1), totalDone.toFixed(1), totalRemaining.toFixed(1), totalArea > 0 ? `${((totalDone / totalArea) * 100).toFixed(1)}%` : "0%", ""]],
      footStyles: { fontStyle: "bold" },
    });

    doc.save(`Progreso_Campos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros del Reporte</CardTitle>
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

            {/* Operation Type */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Tipo de Operación</label>
              <Select value={selectedOperationType} onValueChange={setSelectedOperationType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Operaciones</SelectItem>
                  {operationTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
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

            {/* Field Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Campo</label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Campos</SelectItem>
                  {filteredFields?.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch} disabled={!startDate || !endDate}>
              <Search className="mr-2 h-4 w-4" />
              Generar Reporte
            </Button>

            {/* Export */}
            {fieldProgressData.length > 0 && (
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
              {getOperationTypeName()} - Progreso por Campo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {startDate && endDate && `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando datos...</div>
            ) : fieldProgressData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron operaciones para los filtros seleccionados.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finca</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Tipo de Operación</TableHead>
                      <TableHead className="text-right">Ha Totales</TableHead>
                      <TableHead className="text-right">Ha Realizadas</TableHead>
                      <TableHead className="text-right">Ha Pendientes</TableHead>
                      <TableHead className="text-right">% Completado</TableHead>
                      <TableHead>Insumos Utilizados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldProgressData.map((field, index) => (
                      <TableRow key={`${field.fieldId}-${field.operationTypeName}-${index}`}>
                        <TableCell className="font-medium">{field.farmName}</TableCell>
                        <TableCell>{field.fieldName}</TableCell>
                        <TableCell>{field.operationTypeName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {field.totalHectares.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div className="flex items-center justify-end gap-1">
                            {field.isOverage && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ha Realizadas excede Ha Totales</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <span className={field.isOverage ? "text-amber-600" : "text-primary"}>
                              {field.hectaresDone.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {field.hectaresRemaining.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${field.isOverage ? "bg-amber-500" : "bg-primary"}`}
                                style={{ width: `${Math.min(field.percentComplete, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium w-12 text-right ${field.isOverage ? "text-amber-600" : ""}`}>
                              {field.percentComplete.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {field.inputs.length > 0 ? (
                            <div className="space-y-0.5">
                              {field.inputs.map((input, idx) => (
                                <div key={idx} className="text-xs">
                                  {input.name}: {input.quantity.toFixed(2)} {input.unit}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>TOTALES</TableCell>
                      <TableCell className="text-right font-mono">
                        {fieldProgressData.reduce((sum, f) => sum + f.totalHectares, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {fieldProgressData.reduce((sum, f) => sum + f.hectaresDone, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {fieldProgressData.reduce((sum, f) => sum + f.hectaresRemaining, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const totalArea = fieldProgressData.reduce((sum, f) => sum + f.totalHectares, 0);
                          const totalDone = fieldProgressData.reduce((sum, f) => sum + f.hectaresDone, 0);
                          return totalArea > 0 ? `${((totalDone / totalArea) * 100).toFixed(0)}%` : "0%";
                        })()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
