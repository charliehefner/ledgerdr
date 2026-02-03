import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { ContractEntry, ServiceContract } from "../ContractedServicesView";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ContractReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: ServiceContract[];
  entries: ContractEntry[];
}

const UNIT_LABELS: Record<string, string> = {
  m3: "m³",
  hours: "hrs",
  hectares: "ha",
};

export function ContractReport({ open, onOpenChange, contracts, entries }: ContractReportProps) {
  const { t } = useLanguage();
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const selectedContract = contracts.find((c) => c.id === selectedContractId) || null;

  // When contract is selected, set start date to contract creation date
  const handleContractChange = (contractId: string) => {
    setSelectedContractId(contractId);
    const contract = contracts.find((c) => c.id === contractId);
    if (contract) {
      // Use the contract's created_at date as the start date
      setStartDate(contract.created_at.split("T")[0]);
      setEndDate(""); // Keep end date open
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (!selectedContractId || entry.contract_id !== selectedContractId) {
      return false;
    }
    if (startDate && entry.entry_date < startDate) {
      return false;
    }
    if (endDate && entry.entry_date > endDate) {
      return false;
    }
    return true;
  }).sort((a, b) => parseDateLocal(a.entry_date).getTime() - parseDateLocal(b.entry_date).getTime());

  const getFinalCost = (entry: ContractEntry) => {
    const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
    const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
    return baseCost + lineItemsTotal;
  };

  const totalUnits = filteredEntries.reduce((sum, e) => sum + e.units_charged, 0);
  const totalBaseCost = filteredEntries.reduce((sum, e) => {
    return sum + (e.cost_override !== null ? e.cost_override : e.calculated_cost);
  }, 0);
  const totalLineItems = filteredEntries.reduce((sum, e) => {
    return sum + (e.line_items || []).reduce((s, item) => s + item.amount, 0);
  }, 0);
  const totalCost = filteredEntries.reduce((sum, e) => sum + getFinalCost(e), 0);

  const handleExportPDF = () => {
    if (!selectedContract) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Contrato de Servicios", pageWidth / 2, 20, { align: "center" });

    // Contract header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(selectedContract.contract_name, 14, 35);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    let yPos = 45;
    
    doc.text(`Contratista: ${selectedContract.owner_name}`, 14, yPos);
    yPos += 6;
    
    if (selectedContract.owner_cedula_rnc) {
      doc.text(`Cédula/RNC: ${selectedContract.owner_cedula_rnc}`, 14, yPos);
      yPos += 6;
    }
    
    if (selectedContract.bank) {
      doc.text(`Banco: ${selectedContract.bank}${selectedContract.bank_account ? ` - ${selectedContract.bank_account}` : ""}`, 14, yPos);
      yPos += 6;
    }
    
    doc.text(`Precio por Unidad: $${selectedContract.price_per_unit.toLocaleString()} / ${UNIT_LABELS[selectedContract.unit_type]}`, 14, yPos);
    yPos += 6;
    
    if (startDate || endDate) {
      const dateRange = `Período: ${startDate ? format(parseDateLocal(startDate), "dd/MM/yyyy") : "Inicio"} - ${endDate ? format(parseDateLocal(endDate), "dd/MM/yyyy") : "Presente"}`;
      doc.text(dateRange, 14, yPos);
      yPos += 6;
    }

    yPos += 4;

    // Build table data
    const tableData: (string | number)[][] = [];
    
    filteredEntries.forEach((entry) => {
      const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
      const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
      
      // Main entry row
      tableData.push([
        format(parseDateLocal(entry.entry_date), "dd/MM/yyyy"),
        entry.description,
        `${entry.units_charged.toLocaleString()} ${UNIT_LABELS[selectedContract.unit_type]}`,
        `$${baseCost.toLocaleString()}`,
        lineItemsTotal > 0 ? `$${lineItemsTotal.toLocaleString()}` : "-",
        `$${getFinalCost(entry).toLocaleString()}`,
      ]);
      
      // Line items as sub-rows
      if (entry.line_items && entry.line_items.length > 0) {
        entry.line_items.forEach((item) => {
          tableData.push([
            "",
            `  + ${item.description}`,
            "",
            "",
            `$${item.amount.toLocaleString()}`,
            "",
          ]);
        });
      }
    });

    // Add totals row
    tableData.push([
      "TOTAL",
      "",
      `${totalUnits.toLocaleString()} ${UNIT_LABELS[selectedContract.unit_type]}`,
      `$${totalBaseCost.toLocaleString()}`,
      totalLineItems > 0 ? `$${totalLineItems.toLocaleString()}` : "-",
      `$${totalCost.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Fecha", "Descripción", "Unidades", "Costo Base", "Cargos Adic.", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { 
        fillColor: [64, 64, 64],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
      },
      didParseCell: (data) => {
        // Style the totals row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
        // Style line item sub-rows
        if (data.row.raw && typeof data.row.raw[1] === "string" && data.row.raw[1].startsWith("  +")) {
          data.cell.styles.fontSize = 8;
          data.cell.styles.textColor = [100, 100, 100];
        }
      },
    });

    // Footer with generation date
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, finalY);

    doc.save(`reporte-contrato-${selectedContract.contract_name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("contracts.report")}</DialogTitle>
        </DialogHeader>

        {/* Contract Selection */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("contracts.selectContract")}</label>
            <Select value={selectedContractId} onValueChange={handleContractChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.contract_name} - {c.owner_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("contracts.startDate")}</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("contracts.endDate")}</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <Button 
            variant="default" 
            onClick={handleExportPDF}
            disabled={!selectedContractId || filteredEntries.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t("common.export")} PDF
          </Button>
        </div>

        {/* Contract Header */}
        {selectedContract && (
          <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
            <h3 className="font-semibold text-lg">{selectedContract.contract_name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("contracts.contractor")}:</span>
                <div className="font-medium">{selectedContract.owner_name}</div>
                {selectedContract.owner_cedula_rnc && (
                  <div className="text-xs text-muted-foreground">{selectedContract.owner_cedula_rnc}</div>
                )}
              </div>
              {selectedContract.bank && (
                <div>
                  <span className="text-muted-foreground">{t("contracts.bank")}:</span>
                  <div className="font-medium">{selectedContract.bank}</div>
                  {selectedContract.bank_account && (
                    <div className="text-xs text-muted-foreground">{selectedContract.bank_account}</div>
                  )}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("contracts.pricePerUnit")}:</span>
                <div className="font-medium font-mono">
                  ${selectedContract.price_per_unit.toLocaleString()}/{UNIT_LABELS[selectedContract.unit_type]}
                </div>
              </div>
              {selectedContract.farm?.name && (
                <div>
                  <span className="text-muted-foreground">{t("contracts.farm")}:</span>
                  <div className="font-medium">{selectedContract.farm.name}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No contract selected message */}
        {!selectedContractId && (
          <div className="text-center py-12 text-muted-foreground">
            {t("contracts.selectContractToViewReport")}
          </div>
        )}

        {/* Report Table */}
        {selectedContract && (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-right">{t("contracts.unitsCharged")}</TableHead>
                  <TableHead className="text-right">{t("contracts.baseCost")}</TableHead>
                  <TableHead className="text-right">{t("contracts.additionalCharges")}</TableHead>
                  <TableHead className="text-right">{t("contracts.totalCost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t("contracts.noEntries")}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredEntries.map((entry) => {
                      const unitLabel = UNIT_LABELS[selectedContract.unit_type];
                      const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
                      const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
                      const finalCost = getFinalCost(entry);

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{format(parseDateLocal(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {entry.description}
                              {entry.comments && (
                                <div className="text-xs text-muted-foreground">{entry.comments}</div>
                              )}
                              {(entry.line_items?.length || 0) > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  {entry.line_items?.map((item, i) => (
                                    <div key={i}>+ {item.description}: ${item.amount.toLocaleString()}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.units_charged.toLocaleString()} {unitLabel}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${baseCost.toLocaleString()}
                            {entry.cost_override !== null && (
                              <div className="text-xs text-muted-foreground line-through">
                                ${entry.calculated_cost.toLocaleString()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {lineItemsTotal > 0 ? `$${lineItemsTotal.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ${finalCost.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold border-t-2">
                      <TableCell colSpan={2}>
                        {t("common.total")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totalUnits.toLocaleString()} {UNIT_LABELS[selectedContract.unit_type]}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${totalBaseCost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totalLineItems > 0 ? `$${totalLineItems.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        ${totalCost.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
