import { useMemo, useState } from "react";
import { format, parseISO, startOfYear, endOfYear } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { parseDateLocal } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, BarChart3, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLanguage } from "@/contexts/LanguageContext";
import ExcelJS from "exceljs";

interface RainfallRecord {
  id: string;
  record_date: string;
  solar: number;
  caoba: number;
  palmarito: number;
  virgencita: number;
}

interface MonthlyRainfallReportProps {
  records: RainfallRecord[];
}

const LOCATIONS = ["solar", "caoba", "palmarito", "virgencita"] as const;

const LOCATION_LABELS: Record<typeof LOCATIONS[number], string> = {
  solar: "Solar",
  caoba: "Caoba",
  palmarito: "Palmarito",
  virgencita: "Virgencita",
};

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function MonthlyRainfallReport({ records }: MonthlyRainfallReportProps) {
  const { language } = useLanguage();
  const monthNames = language === "en" ? MONTH_NAMES_EN : MONTH_NAMES_ES;

  // Get available years from records
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    records.forEach((r) => {
      const year = parseDateLocal(r.record_date).getFullYear();
      years.add(year);
    });
    // Add current year if not present
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || new Date().getFullYear());

  // Calculate monthly totals per location
  const monthlyData = useMemo(() => {
    const data: Record<number, Record<typeof LOCATIONS[number], number>> = {};

    // Initialize all months
    for (let month = 0; month < 12; month++) {
      data[month] = { solar: 0, caoba: 0, palmarito: 0, virgencita: 0 };
    }

    // Aggregate records by month
    records.forEach((record) => {
      const date = parseDateLocal(record.record_date);
      if (date.getFullYear() === selectedYear) {
        const month = date.getMonth();
        LOCATIONS.forEach((loc) => {
          data[month][loc] += record[loc] || 0;
        });
      }
    });

    return data;
  }, [records, selectedYear]);

  // Calculate yearly totals per location
  const yearlyTotals = useMemo(() => {
    const totals: Record<typeof LOCATIONS[number], number> = {
      solar: 0,
      caoba: 0,
      palmarito: 0,
      virgencita: 0,
    };

    Object.values(monthlyData).forEach((monthData) => {
      LOCATIONS.forEach((loc) => {
        totals[loc] += monthData[loc];
      });
    });

    return totals;
  }, [monthlyData]);

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = language === "en" ? "Monthly Rainfall" : "Lluvia Mensual";
    const worksheet = workbook.addWorksheet(sheetName);

    // Headers
    worksheet.columns = [
      { header: language === "en" ? "Month" : "Mes", key: "month", width: 15 },
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
    for (let month = 0; month < 12; month++) {
      worksheet.addRow({
        month: monthNames[month],
        solar: monthlyData[month].solar,
        caoba: monthlyData[month].caoba,
        palmarito: monthlyData[month].palmarito,
        virgencita: monthlyData[month].virgencita,
      });
    }

    // Add totals row
    const totalRow = worksheet.addRow({
      month: "TOTAL",
      solar: yearlyTotals.solar,
      caoba: yearlyTotals.caoba,
      palmarito: yearlyTotals.palmarito,
      virgencita: yearlyTotals.virgencita,
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
    a.download = `lluvia_mensual_${selectedYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const title = language === "en" ? "Monthly Rainfall Summary" : "Resumen Mensual de Lluvia";
    doc.setFontSize(14);
    doc.text(`${title} - ${selectedYear}`, 14, 15);

    const body: string[][] = [];
    for (let month = 0; month < 12; month++) {
      body.push([
        monthNames[month],
        monthlyData[month].solar.toString(),
        monthlyData[month].caoba.toString(),
        monthlyData[month].palmarito.toString(),
        monthlyData[month].virgencita.toString(),
      ]);
    }

    autoTable(doc, {
      head: [[language === "en" ? "Month" : "Mes", "Solar (mm)", "Caoba (mm)", "Palmarito (mm)", "Virgencita (mm)"]],
      body,
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [141, 168, 195] },
      foot: [["TOTAL", yearlyTotals.solar.toString(), yearlyTotals.caoba.toString(), yearlyTotals.palmarito.toString(), yearlyTotals.virgencita.toString()]],
      footStyles: { fontStyle: "bold" },
    });

    doc.save(`lluvia_mensual_${selectedYear}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>
              {language === "en" ? "Monthly Rainfall Summary" : "Resumen Mensual de Lluvia"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {language === "en" ? "Export" : "Exportar"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover">
                <DropdownMenuItem onClick={handleExportExcel} className="text-excel">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {language === "en" ? "Export to Excel" : "Exportar a Excel"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  {language === "en" ? "Export to PDF" : "Exportar a PDF"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded-md">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  {language === "en" ? "Month" : "Mes"}
                </th>
                {LOCATIONS.map((loc) => (
                  <th
                    key={loc}
                    className="h-12 px-4 text-center align-middle font-medium text-muted-foreground"
                  >
                    {LOCATION_LABELS[loc]} (mm)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, month) => (
                <tr key={month} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-4 align-middle font-medium">{monthNames[month]}</td>
                  {LOCATIONS.map((loc) => (
                    <td key={loc} className="p-4 align-middle text-center">
                      {monthlyData[month][loc].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Totals Row */}
              <tr className="bg-muted/50 font-bold border-b">
                <td className="p-4 align-middle">TOTAL</td>
                {LOCATIONS.map((loc) => (
                  <td key={loc} className="p-4 align-middle text-center">
                    {yearlyTotals[loc].toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
