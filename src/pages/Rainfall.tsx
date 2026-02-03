import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear, parseISO } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Download, Save, Loader2, CloudRain, BarChart3, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { MonthlyRainfallReport } from "@/components/rainfall/MonthlyRainfallReport";
import ExcelJS from "exceljs";

interface RainfallRecord {
  id: string;
  record_date: string;
  solar: number;
  caoba: number;
  palmarito: number;
  virgencita: number;
}

interface EditableRecord {
  record_date: string;
  solar: string;
  caoba: string;
  palmarito: string;
  virgencita: string;
  isNew?: boolean;
  isDirty?: boolean;
}

const LOCATIONS = ["solar", "caoba", "palmarito", "virgencita"] as const;

const LOCATION_LABELS: Record<typeof LOCATIONS[number], string> = {
  solar: "Solar",
  caoba: "Caoba",
  palmarito: "Palmarito",
  virgencita: "Virgencita",
};

export default function Rainfall() {
  const { toast } = useToast();
  const { canWriteSection } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const canEdit = canWriteSection("operations");
  const dateLocale = language === "en" ? enUS : es;

  const [fromDate, setFromDate] = useState<Date>(startOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date>(endOfMonth(new Date()));
  const [editableRecords, setEditableRecords] = useState<Map<string, EditableRecord>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Fetch rainfall records for current date range
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["rainfall-records", fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rainfall_records")
        .select("*")
        .gte("record_date", format(fromDate, "yyyy-MM-dd"))
        .lte("record_date", format(toDate, "yyyy-MM-dd"))
        .order("record_date", { ascending: true });

      if (error) throw error;
      return data as RainfallRecord[];
    },
  });

  // Fetch ALL rainfall records for monthly report
  const { data: allRecords = [] } = useQuery({
    queryKey: ["rainfall-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rainfall_records")
        .select("*")
        .order("record_date", { ascending: true });

      if (error) throw error;
      return data as RainfallRecord[];
    },
  });

  // Generate all dates in the selected range
  const allDates = eachDayOfInterval({ start: fromDate, end: toDate });

  // Merge records with all dates to show empty rows for missing dates
  const getRecordForDate = (date: Date): RainfallRecord | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return records.find((r) => r.record_date === dateStr) || null;
  };

  const getEditableValue = (date: Date, field: typeof LOCATIONS[number]): string => {
    const dateStr = format(date, "yyyy-MM-dd");
    const editable = editableRecords.get(dateStr);
    if (editable) return editable[field];

    const record = getRecordForDate(date);
    return record ? String(record[field] || 0) : "0";
  };

  const handleValueChange = (date: Date, field: typeof LOCATIONS[number], value: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = editableRecords.get(dateStr);
    const record = getRecordForDate(date);

    const newEditable: EditableRecord = existing || {
      record_date: dateStr,
      solar: String(record?.solar || 0),
      caoba: String(record?.caoba || 0),
      palmarito: String(record?.palmarito || 0),
      virgencita: String(record?.virgencita || 0),
      isNew: !record,
      isDirty: false,
    };

    newEditable[field] = value;
    newEditable.isDirty = true;

    setEditableRecords(new Map(editableRecords.set(dateStr, newEditable)));
  };

  const handleSave = async () => {
    const dirtyRecords = Array.from(editableRecords.values()).filter((r) => r.isDirty);
    if (dirtyRecords.length === 0) {
      toast({ title: language === "en" ? "No changes to save" : "No hay cambios para guardar" });
      return;
    }

    setIsSaving(true);
    try {
      for (const record of dirtyRecords) {
        const payload = {
          record_date: record.record_date,
          solar: parseFloat(record.solar) || 0,
          caoba: parseFloat(record.caoba) || 0,
          palmarito: parseFloat(record.palmarito) || 0,
          virgencita: parseFloat(record.virgencita) || 0,
        };

        const { error } = await supabase
          .from("rainfall_records")
          .upsert(payload, { onConflict: "record_date" });

        if (error) throw error;
      }

      toast({ title: language === "en" ? "Data saved successfully" : "Datos guardados correctamente" });
      setEditableRecords(new Map());
      queryClient.invalidateQueries({ queryKey: ["rainfall-records"] });
    } catch (error: any) {
      toast({
        title: language === "en" ? "Error saving" : "Error al guardar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = language === "en" ? "Rainfall" : "Pluviometría";
    const worksheet = workbook.addWorksheet(sheetName);

    // Headers
    worksheet.columns = [
      { header: t("col.date"), key: "date", width: 15 },
      { header: "Solar (mm)", key: "solar", width: 12 },
      { header: "Caoba (mm)", key: "caoba", width: 12 },
      { header: "Palmarito (mm)", key: "palmarito", width: 15 },
      { header: "Virgencita (mm)", key: "virgencita", width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF8DA8C3" },
    };

    // Add data rows
    allDates.forEach((date) => {
      const record = getRecordForDate(date);
      const solar = record?.solar || 0;
      const caoba = record?.caoba || 0;
      const palmarito = record?.palmarito || 0;
      const virgencita = record?.virgencita || 0;

      worksheet.addRow({
        date: format(date, "dd/MM/yyyy"),
        solar,
        caoba,
        palmarito,
        virgencita,
      });
    });

    // Add totals row
    const excelTotals = records.reduce(
      (acc, r) => ({
        solar: acc.solar + (r.solar || 0),
        caoba: acc.caoba + (r.caoba || 0),
        palmarito: acc.palmarito + (r.palmarito || 0),
        virgencita: acc.virgencita + (r.virgencita || 0),
      }),
      { solar: 0, caoba: 0, palmarito: 0, virgencita: 0 }
    );

    const totalRow = worksheet.addRow({
      date: "TOTAL",
      solar: excelTotals.solar,
      caoba: excelTotals.caoba,
      palmarito: excelTotals.palmarito,
      virgencita: excelTotals.virgencita,
    });
    totalRow.font = { bold: true };

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pluviometria_${format(fromDate, "yyyy-MM-dd")}_${format(toDate, "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasChanges = Array.from(editableRecords.values()).some((r) => r.isDirty);

  // Calculate totals for display
  const totals = allDates.reduce(
    (acc, date) => {
      const record = getRecordForDate(date);
      const editable = editableRecords.get(format(date, "yyyy-MM-dd"));
      
      return {
        solar: acc.solar + parseFloat(editable?.solar || String(record?.solar || 0)),
        caoba: acc.caoba + parseFloat(editable?.caoba || String(record?.caoba || 0)),
        palmarito: acc.palmarito + parseFloat(editable?.palmarito || String(record?.palmarito || 0)),
        virgencita: acc.virgencita + parseFloat(editable?.virgencita || String(record?.virgencita || 0)),
      };
    },
    { solar: 0, caoba: 0, palmarito: 0, virgencita: 0 }
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <CloudRain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("page.rainfall.title")}</h1>
              <p className="text-muted-foreground">{t("page.rainfall.subtitle")}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              {language === "en" ? "Daily Records" : "Registros Diarios"}
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {language === "en" ? "Monthly Summary" : "Resumen Mensual"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            {/* Daily Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Card className="flex-1">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{language === "en" ? "From:" : "Desde:"}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(fromDate, "dd MMM yyyy", { locale: dateLocale })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fromDate}
                            onSelect={(date) => date && setFromDate(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{language === "en" ? "To:" : "Hasta:"}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(toDate, "dd MMM yyyy", { locale: dateLocale })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={toDate}
                            onSelect={(date) => date && setToDate(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {canEdit && hasChanges && (
                        <Button onClick={handleSave} disabled={isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                          {t("common.save")}
                        </Button>
                      )}
                      <Button variant="outline" onClick={handleExportExcel}>
                        <Download className="h-4 w-4 mr-2" />
                        {language === "en" ? "Export Excel" : "Exportar Excel"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>{language === "en" ? "Precipitation Records (mm)" : "Registros de Precipitación (mm)"}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="relative overflow-auto max-h-[600px] border rounded-md">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sticky top-0 z-10 bg-background border-b">
                        <tr>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[120px]">{t("col.date")}</th>
                          {LOCATIONS.map((loc) => (
                            <th key={loc} className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[100px]">
                              {LOCATION_LABELS[loc]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allDates.map((date) => {
                          const dateStr = format(date, "yyyy-MM-dd");
                          const record = getRecordForDate(date);
                          const editable = editableRecords.get(dateStr);

                          return (
                            <tr key={dateStr} className={cn("border-b transition-colors hover:bg-muted/50", editable?.isDirty && "bg-warning/10")}>
                              <td className="p-4 align-middle font-medium">
                                {format(date, "dd MMM yyyy", { locale: dateLocale })}
                              </td>
                              {LOCATIONS.map((loc) => (
                                <td key={loc} className="p-1 align-middle">
                                  {canEdit ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="text-center h-8"
                                      value={getEditableValue(date, loc)}
                                      onChange={(e) => handleValueChange(date, loc, e.target.value)}
                                    />
                                  ) : (
                                    <span className="block text-center">
                                      {record?.[loc] || 0}
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {/* Totals Row */}
                        <tr className="bg-muted/50 font-bold border-b">
                          <td className="p-4 align-middle">TOTAL</td>
                          {LOCATIONS.map((loc) => (
                            <td key={loc} className="p-4 align-middle text-center">
                              {totals[loc].toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly">
            <MonthlyRainfallReport records={allRecords} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
