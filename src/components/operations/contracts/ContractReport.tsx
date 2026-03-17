import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { ContractEntry, ServiceContract } from "../ContractedServicesView";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import { FileText, DollarSign, Pencil, Trash2, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatters";
import { ContractPayment, PaymentDialog } from "./PaymentDialog";

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
  const queryClient = useQueryClient();
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ContractPayment | null>(null);

  // Fetch payments for selected contract
  const { data: payments = [] } = useQuery({
    queryKey: ["contract-report-payments", selectedContractId],
    queryFn: async () => {
      if (!selectedContractId) return [];
      const { data, error } = await supabase
        .from("service_contract_payments")
        .select("*")
        .eq("contract_id", selectedContractId)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return data as ContractPayment[];
    },
    enabled: !!selectedContractId && open,
    staleTime: 0,
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_contract_payments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-report-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contract-payments-detail"] });
      queryClient.invalidateQueries({ queryKey: ["service-contract-payments"] });
      toast.success(t("contracts.paymentDeleted"));
    },
    onError: () => {
      toast.error(t("contracts.paymentDeleteError"));
    },
  });

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentDialogOpen(true);
  };

  const handleEditPayment = (payment: ContractPayment) => {
    setEditingPayment(payment);
    setPaymentDialogOpen(true);
  };

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

  const filteredPayments = payments.filter((payment) => {
    if (startDate && payment.payment_date < startDate) return false;
    if (endDate && payment.payment_date > endDate) return false;
    return true;
  });

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
  const totalInvoiced = filteredEntries.reduce((sum, e) => sum + getFinalCost(e), 0);
  const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalInvoiced - totalPaid;

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
      const finalCost = getFinalCost(entry);
      
      const formatAmount = (amount: number) => 
        amount < 0 ? `($${Math.abs(amount).toLocaleString()})` : `$${amount.toLocaleString()}`;
      
      // Main entry row
      tableData.push([
        format(parseDateLocal(entry.entry_date), "dd/MM/yyyy"),
        entry.description,
        `${entry.units_charged.toLocaleString()} ${UNIT_LABELS[selectedContract.unit_type]}`,
        `$${baseCost.toLocaleString()}`,
        lineItemsTotal !== 0 ? formatAmount(lineItemsTotal) : "–",
        formatAmount(finalCost),
      ]);
      
      // Line items as sub-rows
      if (entry.line_items && entry.line_items.length > 0) {
        entry.line_items.forEach((item) => {
          tableData.push([
            "",
            `  + ${item.description}`,
            "",
            "",
            formatAmount(item.amount),
            "",
          ]);
        });
      }
    });

    // Add totals row
    const formatTotalAmount = (amount: number) => 
      amount < 0 ? `($${Math.abs(amount).toLocaleString()})` : `$${amount.toLocaleString()}`;
    
    tableData.push([
      "TOTAL FACTURADO",
      "",
      `${totalUnits.toLocaleString()} ${UNIT_LABELS[selectedContract.unit_type]}`,
      `$${totalBaseCost.toLocaleString()}`,
      totalLineItems !== 0 ? formatTotalAmount(totalLineItems) : "–",
      `$${totalInvoiced.toLocaleString()}`,
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

    let finalY = doc.lastAutoTable.finalY || 200;

    // Payments table if there are payments
    if (filteredPayments.length > 0) {
      finalY += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Pagos Registrados", 14, finalY);
      finalY += 5;

      const paymentData = filteredPayments.map((payment) => [
        format(parseDateLocal(payment.payment_date), "dd/MM/yyyy"),
        payment.transaction_id,
        `$${Number(payment.amount).toLocaleString()}`,
        payment.notes || "",
      ]);

      // Add total paid row
      paymentData.push([
        "TOTAL PAGADO",
        "",
        `$${totalPaid.toLocaleString()}`,
        "",
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [["Fecha", "Transacción", "Monto", "Notas"]],
        body: paymentData,
        theme: "grid",
        headStyles: { 
          fillColor: [34, 197, 94],
          fontSize: 10,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 50 },
          2: { cellWidth: 35, halign: "right" },
          3: { cellWidth: "auto" },
        },
        didParseCell: (data) => {
          if (data.row.index === paymentData.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [220, 252, 231];
          }
        },
      });
      
      finalY = doc.lastAutoTable.finalY || finalY + 30;
    }

    // Summary section
    finalY += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Facturado: $${totalInvoiced.toLocaleString()}`, 14, finalY);
    finalY += 6;
    doc.text(`Total Pagado: $${totalPaid.toLocaleString()}`, 14, finalY);
    finalY += 6;
    doc.setFontSize(12);
    const balanceColor = balance > 0 ? [217, 119, 6] : balance < 0 ? [22, 163, 74] : [0, 0, 0];
    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.text(`Balance: $${balance.toLocaleString()}`, 14, finalY);

    // Footer with generation date
    finalY += 15;
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
                  ${formatMoney(selectedContract.price_per_unit)}/{UNIT_LABELS[selectedContract.unit_type]}
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

        {/* Report Tables */}
        {selectedContract && (
          <>
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
                                    <div key={i} className={item.amount < 0 ? "text-destructive" : ""}>
                                       + {item.description}: {item.amount < 0 
                                        ? `($${formatMoney(Math.abs(item.amount))})` 
                                        : `$${formatMoney(item.amount)}`}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.units_charged.toLocaleString()} {unitLabel}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${formatMoney(baseCost)}
                            {entry.cost_override !== null && (
                              <div className="text-xs text-muted-foreground line-through">
                                ${formatMoney(entry.calculated_cost)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${lineItemsTotal < 0 ? "text-destructive" : ""}`}>
                            {lineItemsTotal !== 0 
                              ? (lineItemsTotal < 0 
                                  ? `($${formatMoney(Math.abs(lineItemsTotal))})` 
                                  : `$${formatMoney(lineItemsTotal)}`)
                              : "–"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ${formatMoney(finalCost)}
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
                        ${formatMoney(totalBaseCost)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${totalLineItems < 0 ? "text-destructive" : ""}`}>
                        {totalLineItems !== 0 
                          ? (totalLineItems < 0 
                              ? `($${formatMoney(Math.abs(totalLineItems))})` 
                              : `$${formatMoney(totalLineItems)}`)
                          : "–"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        ${formatMoney(totalInvoiced)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Payments Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t("contracts.payments")}
              </h4>
              <Button variant="outline" size="sm" onClick={handleAddPayment}>
                <Plus className="h-4 w-4 mr-2" />
                {t("contracts.addPayment")}
              </Button>
            </div>
            
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("contracts.transactionId")}</TableHead>
                    <TableHead className="text-right">{t("common.amount")}</TableHead>
                    <TableHead>{t("common.notes")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        {t("contracts.noPayments")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(parseDateLocal(payment.payment_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-mono">{payment.transaction_id}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 font-semibold">
                            ${Number(payment.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{payment.notes || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditPayment(payment)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t("contracts.confirmDeletePayment")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("contracts.confirmDeletePaymentDesc")}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletePaymentMutation.mutate(payment.id)}>
                                      {t("common.delete")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Paid Row */}
                      <TableRow className="bg-emerald-50 dark:bg-emerald-950/20 font-semibold">
                        <TableCell colSpan={2}>{t("contracts.totalPaid")}</TableCell>
                        <TableCell className="text-right font-mono text-lg text-emerald-600">
                          ${totalPaid.toLocaleString()}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Summary Section */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
            <h4 className="font-semibold mb-3">{t("contracts.contractSummary")}</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-sm text-muted-foreground">{t("contracts.totalInvoiced")}</div>
                <div className="text-xl font-bold font-mono">${totalInvoiced.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-sm text-muted-foreground">{t("contracts.totalPaid")}</div>
                <div className="text-xl font-bold font-mono text-emerald-600">${totalPaid.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-sm text-muted-foreground">{t("contracts.balance")}</div>
                <div className={`text-xl font-bold font-mono ${balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-emerald-600' : ''}`}>
                  ${balance.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </DialogContent>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        payment={editingPayment}
        contracts={selectedContract ? [selectedContract] : []}
        preselectedContractId={selectedContractId}
      />
    </Dialog>
  );
}
