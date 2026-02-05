import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { ServiceContract, ContractEntry, ContractLineItem } from "../ContractedServicesView";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import { Download, FileText, Pencil, Trash2, Plus, DollarSign } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { PaymentDialog, ContractPayment } from "./PaymentDialog";

interface ContractDetailReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ServiceContract | null;
  onEditEntry: (entry: ContractEntry) => void;
  onDeleteEntry: (id: string) => void;
}

const OPERATION_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  bulldozer: { es: "Bulldozer", en: "Bulldozer" },
  excavator: { es: "Excavadora", en: "Excavator" },
  tractor: { es: "Tractor", en: "Tractor" },
  backhoe: { es: "Retroexcavadora", en: "Backhoe" },
  transportation: { es: "Transporte", en: "Transportation" },
  other: { es: "Otro", en: "Other" },
};

const UNIT_LABELS: Record<string, string> = {
  m3: "m³",
  hours: "hrs",
  hectares: "ha",
};

export function ContractDetailReport({ 
  open, 
  onOpenChange, 
  contract,
  onEditEntry,
  onDeleteEntry,
}: ContractDetailReportProps) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ContractPayment | null>(null);

  // Fetch entries for this contract
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["contract-entries-detail", contract?.id],
    queryFn: async () => {
      if (!contract) return [];
      
      const { data, error } = await supabase
        .from("service_contract_entries")
        .select("*")
        .eq("contract_id", contract.id)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      
      // Fetch line items for each entry
      const entriesWithLineItems = await Promise.all(
        (data || []).map(async (entry) => {
          const { data: lineItems } = await supabase
            .from("service_contract_line_items")
            .select("*")
            .eq("entry_id", entry.id);
          return { ...entry, line_items: lineItems || [], contract } as ContractEntry;
        })
      );
      
      return entriesWithLineItems;
    },
    enabled: !!contract && open,
  });

  // Fetch payments for this contract
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["contract-payments-detail", contract?.id],
    queryFn: async () => {
      if (!contract) return [];
      
      const { data, error } = await supabase
        .from("service_contract_payments")
        .select("*")
        .eq("contract_id", contract.id)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      return data as ContractPayment[];
    },
    enabled: !!contract && open,
    staleTime: 0, // Always refetch when dialog opens
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
      queryClient.invalidateQueries({ queryKey: ["contract-payments-detail"] });
      toast.success(t("contracts.paymentDeleted"));
    },
    onError: () => {
      toast.error(t("contracts.paymentDeleteError"));
    },
  });

  const filteredEntries = entries.filter((entry) => {
    if (startDate && entry.entry_date < startDate) return false;
    if (endDate && entry.entry_date > endDate) return false;
    return true;
  });

  const filteredPayments = payments.filter((payment) => {
    if (startDate && payment.payment_date < startDate) return false;
    if (endDate && payment.payment_date > endDate) return false;
    return true;
  });

  const getOperationTypeLabel = (type: string, other?: string | null) => {
    if (type === "other" && other) return other;
    return OPERATION_TYPE_LABELS[type]?.[language] || type;
  };

  const getFinalCost = (entry: ContractEntry) => {
    const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
    const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
    return baseCost + lineItemsTotal;
  };

  const totalUnits = filteredEntries.reduce((sum, e) => sum + e.units_charged, 0);
  const totalInvoiced = filteredEntries.reduce((sum, e) => sum + getFinalCost(e), 0);
  const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalInvoiced - totalPaid;
  const unitLabel = contract ? UNIT_LABELS[contract.unit_type] || contract.unit_type : "";

  // Combine entries and payments for chronological display
  type ReportItem = 
    | { type: 'entry'; date: string; data: ContractEntry }
    | { type: 'payment'; date: string; data: ContractPayment };

  const combinedItems: ReportItem[] = [
    ...filteredEntries.map(e => ({ type: 'entry' as const, date: e.entry_date, data: e })),
    ...filteredPayments.map(p => ({ type: 'payment' as const, date: p.payment_date, data: p })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentDialogOpen(true);
  };

  const handleEditPayment = (payment: ContractPayment) => {
    setEditingPayment(payment);
    setPaymentDialogOpen(true);
  };

  const generatePdf = async () => {
    if (!contract) return;
    
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(t("contracts.contractDetails"), pageWidth / 2, 20, { align: "center" });
      
      // Contract Info Section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(contract.contract_name, 14, 35);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let yPos = 45;
      
      doc.text(`${t("contracts.owner")}: ${contract.owner_name}`, 14, yPos);
      yPos += 6;
      
      if (contract.owner_cedula_rnc) {
        doc.text(`${t("contracts.cedulaRnc")}: ${contract.owner_cedula_rnc}`, 14, yPos);
        yPos += 6;
      }
      
      doc.text(`${t("contracts.operationTypeLabel")}: ${getOperationTypeLabel(contract.operation_type, contract.operation_type_other)}`, 14, yPos);
      yPos += 6;
      
      doc.text(`${t("contracts.pricePerUnit")}: $${contract.price_per_unit.toLocaleString()} / ${unitLabel}`, 14, yPos);
      yPos += 6;
      
      if (contract.farm?.name) {
        doc.text(`${t("contracts.farm")}: ${contract.farm.name}`, 14, yPos);
        yPos += 6;
      }
      
      if (contract.bank) {
        doc.text(`${t("contracts.bank")}: ${contract.bank}`, 14, yPos);
        yPos += 6;
        if (contract.bank_account) {
          doc.text(`${t("contracts.bankAccount")}: ${contract.bank_account}`, 14, yPos);
          yPos += 6;
        }
      }
      
      doc.text(`${t("common.status")}: ${contract.is_active ? t("common.active") : t("common.inactive")}`, 14, yPos);
      yPos += 10;
      
      // Date filter info if applied
      if (startDate || endDate) {
        doc.setFont("helvetica", "italic");
        let dateFilter = "";
        if (startDate && endDate) {
          dateFilter = `${t("contracts.startDate")}: ${startDate} - ${t("contracts.endDate")}: ${endDate}`;
        } else if (startDate) {
          dateFilter = `${t("contracts.startDate")}: ${startDate}`;
        } else if (endDate) {
          dateFilter = `${t("contracts.endDate")}: ${endDate}`;
        }
        doc.text(dateFilter, 14, yPos);
        yPos += 8;
      }
      
      // Entries Table
      const tableData = filteredEntries.map((entry) => {
        const lineItemsTotal = (entry.line_items || []).reduce((sum, item) => sum + item.amount, 0);
        const baseCost = entry.cost_override !== null ? entry.cost_override : entry.calculated_cost;
        const finalCost = getFinalCost(entry);
        
        const formatAmount = (amount: number) => 
          amount < 0 ? `($${Math.abs(amount).toLocaleString()})` : `$${amount.toLocaleString()}`;
        
        return [
          format(parseDateLocal(entry.entry_date), "dd/MM/yyyy"),
          entry.description,
          `${entry.units_charged.toLocaleString()} ${unitLabel}`,
          `$${baseCost.toLocaleString()}`,
          lineItemsTotal !== 0 ? formatAmount(lineItemsTotal) : "-",
          formatAmount(finalCost),
        ];
      });
      
      autoTable(doc, {
        startY: yPos,
        head: [[
          t("common.date"),
          t("common.description"),
          t("contracts.unitsCharged"),
          t("contracts.baseCost"),
          t("contracts.lineItems"),
          t("contracts.totalCost"),
        ]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 'auto' },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 25 },
          4: { halign: 'right', cellWidth: 25 },
          5: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
        },
        foot: [[
          t("contracts.totalInvoiced"),
          "",
          `${totalUnits.toLocaleString()} ${unitLabel}`,
          "",
          "",
          `$${totalInvoiced.toLocaleString()}`,
        ]],
        footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
      });
      
      let finalY = (doc as any).lastAutoTable.finalY || 200;
      
      // Payments table if there are payments
      if (filteredPayments.length > 0) {
        finalY += 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(t("contracts.payments"), 14, finalY);
        finalY += 5;

        const paymentData = filteredPayments.map((payment) => [
          format(parseDateLocal(payment.payment_date), "dd/MM/yyyy"),
          payment.transaction_id,
          `$${Number(payment.amount).toLocaleString()}`,
          payment.notes || "",
        ]);

        autoTable(doc, {
          startY: finalY,
          head: [[
            t("common.date"),
            t("contracts.transactionId"),
            t("common.amount"),
            t("common.notes"),
          ]],
          body: paymentData,
          theme: "striped",
          headStyles: { fillColor: [34, 197, 94] },
          styles: { fontSize: 8 },
          foot: [[
            t("contracts.totalPaid"),
            "",
            `$${totalPaid.toLocaleString()}`,
            "",
          ]],
          footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
        });
        
        finalY = (doc as any).lastAutoTable.finalY || finalY + 30;
      }
      
      // Summary section
      finalY += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("contracts.totalInvoiced")}: $${totalInvoiced.toLocaleString()}`, 14, finalY);
      finalY += 6;
      doc.text(`${t("contracts.totalPaid")}: $${totalPaid.toLocaleString()}`, 14, finalY);
      finalY += 6;
      doc.setFontSize(12);
      doc.text(`${t("contracts.balance")}: $${balance.toLocaleString()}`, 14, finalY);
      
      // Footer with generation date
      finalY += 15;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(`${t("common.date")}: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, finalY);
      
      // Save PDF
      doc.save(`${contract.contract_name.replace(/[^a-zA-Z0-9]/g, '-')}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success(t("contracts.pdfGenerated"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("contracts.saveError"));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("contracts.contractDetails")}
          </DialogTitle>
        </DialogHeader>

        {/* Contract Header Info */}
        <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{contract.contract_name}</h3>
            <Badge variant={contract.is_active ? "default" : "secondary"}>
              {contract.is_active ? t("common.active") : t("common.inactive")}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t("contracts.owner")}:</span>
              <div className="font-medium">{contract.owner_name}</div>
              {contract.owner_cedula_rnc && (
                <div className="text-xs text-muted-foreground">{contract.owner_cedula_rnc}</div>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">{t("contracts.operationTypeLabel")}:</span>
              <div className="font-medium">
                {getOperationTypeLabel(contract.operation_type, contract.operation_type_other)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">{t("contracts.pricePerUnit")}:</span>
              <div className="font-medium font-mono">
                ${contract.price_per_unit.toLocaleString()}/{unitLabel}
              </div>
            </div>
            {contract.farm?.name && (
              <div>
                <span className="text-muted-foreground">{t("contracts.farm")}:</span>
                <div className="font-medium">{contract.farm.name}</div>
              </div>
            )}
            {contract.bank && (
              <div>
                <span className="text-muted-foreground">{t("contracts.bank")}:</span>
                <div className="font-medium">{contract.bank}</div>
                {contract.bank_account && (
                  <div className="text-xs text-muted-foreground">{contract.bank_account}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filters and Export */}
        <div className="flex flex-wrap gap-4 items-end">
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
          <Button variant="default" onClick={generatePdf} disabled={isGeneratingPdf || filteredEntries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {isGeneratingPdf ? t("contracts.generatingPdf") : t("contracts.exportPdf")}
          </Button>
        </div>

        {/* Entries Table */}
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead className="text-right">{t("contracts.unitsCharged")}</TableHead>
                <TableHead className="text-right">{t("contracts.baseCost")}</TableHead>
                <TableHead className="text-right">{t("contracts.lineItems")}</TableHead>
                <TableHead className="text-right">{t("contracts.totalCost")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("contracts.noEntries")}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredEntries.map((entry) => {
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
                              <div className="text-xs text-muted-foreground mt-1">
                                {entry.line_items?.map((item, i) => (
                                  <div key={i} className={item.amount < 0 ? "text-destructive" : ""}>
                                    + {item.description}: {item.amount < 0 
                                      ? `($${Math.abs(item.amount).toLocaleString()})` 
                                      : `$${item.amount.toLocaleString()}`}
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
                          ${baseCost.toLocaleString()}
                          {entry.cost_override !== null && (
                            <div className="text-xs text-muted-foreground line-through">
                              ${entry.calculated_cost.toLocaleString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${lineItemsTotal < 0 ? "text-destructive" : ""}`}>
                          {lineItemsTotal !== 0 
                            ? (lineItemsTotal < 0 
                                ? `($${Math.abs(lineItemsTotal).toLocaleString()})` 
                                : `$${lineItemsTotal.toLocaleString()}`)
                            : "–"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ${finalCost.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => onEditEntry(entry)}>
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
                                  <AlertDialogTitle>{t("contracts.confirmDeleteEntry")}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("contracts.confirmDeleteEntryDesc")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteEntry(entry.id)}>
                                    {t("common.delete")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>{t("contracts.totalInvoiced")}</TableCell>
                    <TableCell className="text-right font-mono">
                      {totalUnits.toLocaleString()} {unitLabel}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono text-lg">
                      ${totalInvoiced.toLocaleString()}
                    </TableCell>
                    <TableCell></TableCell>
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
                {loadingPayments ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
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
                        <TableCell className="text-right font-mono text-green-600 font-semibold">
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
                    <TableRow className="bg-green-50 dark:bg-green-950/20 font-semibold">
                      <TableCell colSpan={2}>{t("contracts.totalPaid")}</TableCell>
                      <TableCell className="text-right font-mono text-lg text-green-600">
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
              <div className="text-xl font-bold font-mono text-green-600">${totalPaid.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <div className="text-sm text-muted-foreground">{t("contracts.balance")}</div>
              <div className={`text-xl font-bold font-mono ${balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-green-600' : ''}`}>
                ${balance.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        payment={editingPayment}
        contracts={contract ? [contract] : []}
        preselectedContractId={contract?.id}
      />
    </Dialog>
  );
}
