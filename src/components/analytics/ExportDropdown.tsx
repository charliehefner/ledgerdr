import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useExport, ExportData, ExportConfig } from "@/hooks/useExport";

interface Props {
  getData: () => ExportData;
  config: ExportConfig;
}

export function ExportDropdown({ getData, config }: Props) {
  const [loading, setLoading] = useState(false);
  const { exportToExcel, exportToPDF } = useExport();

  const handleExport = async (type: "excel" | "pdf") => {
    setLoading(true);
    try {
      const data = getData();
      if (type === "excel") {
        await exportToExcel(data, config);
      } else {
        await exportToPDF(data, config);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
