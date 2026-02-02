import { useState } from "react";
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
import { Download } from "lucide-react";

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
  const [selectedContractId, setSelectedContractId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredEntries = entries.filter((entry) => {
    if (selectedContractId !== "all" && entry.contract_id !== selectedContractId) {
      return false;
    }
    if (startDate && entry.entry_date < startDate) {
      return false;
    }
    if (endDate && entry.entry_date > endDate) {
      return false;
    }
    return true;
  });

  const selectedContract = selectedContractId !== "all" 
    ? contracts.find((c) => c.id === selectedContractId) 
    : null;

  const getFinalCost = (entry: ContractEntry) => {
    const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
    const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
    return baseCost + lineItemsTotal;
  };

  const totalUnits = filteredEntries.reduce((sum, e) => sum + e.units_charged, 0);
  const totalCost = filteredEntries.reduce((sum, e) => sum + getFinalCost(e), 0);

  const handleExport = () => {
    const headers = [
      t("common.date"),
      t("contracts.contract"),
      t("contracts.owner"),
      t("common.description"),
      t("contracts.unitsCharged"),
      t("contracts.unitType"),
      t("contracts.calculatedCost"),
      t("contracts.override"),
      t("contracts.lineItems"),
      t("contracts.totalCost"),
    ];

    const rows = filteredEntries.map((entry) => {
      const contract = entry.contract;
      const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
      return [
        format(new Date(entry.entry_date), "dd/MM/yyyy"),
        contract?.contract_name || "",
        contract?.owner_name || "",
        entry.description,
        entry.units_charged,
        contract?.unit_type || "",
        entry.calculated_cost,
        entry.cost_override || "",
        lineItemsTotal || "",
        getFinalCost(entry),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      "",
      `"${t("common.total")}","","","","${totalUnits}","","","","","${totalCost}"`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contract-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("contracts.report")}</DialogTitle>
        </DialogHeader>

        {/* Report Header */}
        {selectedContract && (
          <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
            <h3 className="font-semibold text-lg">{selectedContract.contract_name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("contracts.owner")}:</span>
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

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("contracts.contract")}</label>
            <Select value={selectedContractId} onValueChange={setSelectedContractId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contracts.allContracts")}</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.contract_name}
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("common.export")} CSV
          </Button>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                {selectedContractId === "all" && (
                  <TableHead>{t("contracts.contract")}</TableHead>
                )}
                <TableHead>{t("common.description")}</TableHead>
                <TableHead className="text-right">{t("contracts.unitsCharged")}</TableHead>
                <TableHead className="text-right">{t("contracts.baseCost")}</TableHead>
                <TableHead className="text-right">{t("contracts.lineItems")}</TableHead>
                <TableHead className="text-right">{t("contracts.totalCost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedContractId === "all" ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    {t("contracts.noEntries")}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredEntries.map((entry) => {
                    const contract = entry.contract;
                    const unitLabel = contract ? UNIT_LABELS[contract.unit_type] : "";
                    const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
                    const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
                    const finalCost = getFinalCost(entry);

                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                        {selectedContractId === "all" && (
                          <TableCell className="font-medium">{contract?.contract_name}</TableCell>
                        )}
                        <TableCell>
                          <div className="max-w-xs">
                            {entry.description}
                            {entry.comments && (
                              <div className="text-xs text-muted-foreground">{entry.comments}</div>
                            )}
                            {(entry.line_items?.length || 0) > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
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
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={selectedContractId === "all" ? 3 : 2}>
                      {t("common.total")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totalUnits.toLocaleString()}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      ${totalCost.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
