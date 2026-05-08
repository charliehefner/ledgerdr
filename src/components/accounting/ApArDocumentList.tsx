import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEntity } from "@/contexts/EntityContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDateLocal, parseDateLocal } from "@/lib/dateUtils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Plus, Receipt, DollarSign, ArrowLeftRight, CalendarIcon, Pencil, Ban, Layers } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PaymentDialog } from "./PaymentDialog";
import { MultiPaymentDialog } from "./MultiPaymentDialog";

interface ApArDocument {
  id: string;
  document_type: string;
  direction: string;
  contact_name: string;
  contact_rnc: string | null;
  document_number: string | null;
  document_date: string;
  due_date: string | null;
  currency: string;
  total_amount: number;
  amount_paid: number;
  balance_remaining: number;
  status: string;
  notes: string | null;
  created_at: string;
  account_id: string | null;
  account_code?: string;
  account_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 border-yellow-200",
  partial: "bg-blue-100 text-blue-800 border-blue-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  void: "bg-gray-100 text-gray-800 border-gray-200",
};

const CURRENCY_BADGE_COLORS: Record<string, string> = {
  DOP: "bg-emerald-100 text-emerald-800 border-emerald-200",
  USD: "bg-blue-100 text-blue-800 border-blue-200",
  EUR: "bg-purple-100 text-purple-800 border-purple-200",
};

type DocTypeFilter = "all" | "invoices" | "advances";
type CurrencyFilter = "all" | "DOP" | "USD" | "EUR";

interface AgingBuckets {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90plus: number;
}

interface Props {
  direction: "receivable" | "payable";
}

export function ApArDocumentList({ direction }: Props) {
  const { t } = useLanguage();
  const { canWriteSection, user } = useAuth();
  const { selectedEntityId } = useEntity();
  const queryClient = useQueryClient();
  const canWrite = canWriteSection("ap-ar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDoc, setPaymentDoc] = useState<ApArDocument | null>(null);
  const [allocDoc, setAllocDoc] = useState<ApArDocument | null>(null);
  const [dueDateDoc, setDueDateDoc] = useState<ApArDocument | null>(null);
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(undefined);
  const [allocAmount, setAllocAmount] = useState("");
  const [selectedAdvanceId, setSelectedAdvanceId] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocTypeFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [voidDoc, setVoidDoc] = useState<ApArDocument | null>(null);
  const [multiOpen, setMultiOpen] = useState(false);
  const [creditDoc, setCreditDoc] = useState<ApArDocument | null>(null);
  const [selectedCreditId, setSelectedCreditId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [form, setForm] = useState({
    document_type: "invoice",
    supplier_id: "",
    contact_name: "",
    contact_rnc: "",
    document_number: "",
    document_date: new Date().toISOString().split("T")[0],
    due_date: "",
    currency: "DOP",
    total_amount: "",
    notes: "",
    account_id: "",
    offset_account_id: "",
    post_journal: false,
  });

  // Fetch relevant GL accounts for the direction
  const { data: glAccounts = [] } = useQuery({
    queryKey: ["ap-ar-gl-accounts", direction],
    queryFn: async () => {
      // For payables, include both 24xx and 1690 accounts
      const conditions = direction === "receivable"
        ? [{ prefix: "12" }]
        : [{ prefix: "24" }, { prefix: "1690" }];
      
      const results: { id: string; account_code: string; account_name: string }[] = [];
      for (const cond of conditions) {
        const { data, error } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name")
          .like("account_code", `${cond.prefix}%`)
          .eq("allow_posting", true)
          .is("deleted_at", null)
          .order("account_code");
        if (!error && data) results.push(...data);
      }
      return results;
    },
  });

  // Postable accounts for the offsetting side of a manual journal
  const { data: offsetAccounts = [] } = useQuery({
    queryKey: ["postable-accounts-for-offset", direction],
    queryFn: async () => {
      // payable: expense (4xxx/5xxx/6xxx/7xxx/8xxx); receivable: income (3xxx)
      const prefixes = direction === "payable" ? ["4", "5", "6", "7", "8"] : ["3"];
      const out: { id: string; account_code: string; account_name: string }[] = [];
      for (const p of prefixes) {
        const { data } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name")
          .like("account_code", `${p}%`)
          .eq("allow_posting", true)
          .is("deleted_at", null)
          .order("account_code");
        if (data) out.push(...data);
      }
      return out;
    },
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["ap-ar-documents", direction],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ap_ar_documents")
        .select("*, chart_of_accounts:account_id(account_code, account_name)")
        .eq("direction", direction)
        .order("document_date", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        account_code: d.chart_of_accounts?.account_code || null,
        account_name: d.chart_of_accounts?.account_name || null,
        chart_of_accounts: undefined,
      })) as ApArDocument[];
    },
  });

  // Fetch latest exchange rates for DOP conversion
  const { data: exchangeRates } = useQuery({
    queryKey: ["exchange-rates-latest"],
    queryFn: async () => {
      const rates: Record<string, number> = { DOP: 1 };
      for (const pair of ["USD/DOP", "EUR/DOP"]) {
        const { data } = await supabase
          .from("exchange_rates")
          .select("sell_rate")
          .eq("currency_pair", pair)
          .order("rate_date", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const currency = pair.split("/")[0];
          rates[currency] = data[0].sell_rate;
        }
      }
      return rates;
    },
    staleTime: 1000 * 60 * 30,
  });

  const rates = exchangeRates || { DOP: 1, USD: 1, EUR: 1 };

  // Filter documents by type and currency
  const filteredDocuments = useMemo(() => {
    let docs = documents;
    if (typeFilter === "advances") docs = docs.filter(d => d.document_type === "advance");
    else if (typeFilter === "invoices") docs = docs.filter(d => d.document_type !== "advance");
    if (currencyFilter !== "all") docs = docs.filter(d => d.currency === currencyFilter);
    return docs;
  }, [documents, typeFilter, currencyFilter]);

  // Get available advances for the allocation dialog
  const availableAdvances = useMemo(() => {
    if (!allocDoc) return [];
    return documents.filter(d =>
      d.document_type === "advance" &&
      d.contact_name === allocDoc.contact_name &&
      d.status !== "paid" &&
      d.status !== "void" &&
      d.balance_remaining > 0
    );
  }, [documents, allocDoc]);

  // Available credit memos / debit notes for the credit-application dialog
  const availableCredits = useMemo(() => {
    if (!creditDoc) return [];
    return documents.filter(d =>
      (d.document_type === "credit_memo" || d.document_type === "debit_note") &&
      d.contact_name === creditDoc.contact_name &&
      d.currency === creditDoc.currency &&
      d.status !== "paid" &&
      d.status !== "void" &&
      d.balance_remaining > 0
    );
  }, [documents, creditDoc]);

  const hasCreditsForContact = (contactName: string, currency: string) => {
    return documents.some(d =>
      (d.document_type === "credit_memo" || d.document_type === "debit_note") &&
      d.contact_name === contactName &&
      d.currency === currency &&
      d.status !== "paid" &&
      d.status !== "void" &&
      d.balance_remaining > 0
    );
  };

  // Currencies present in the data
  const activeCurrencies = useMemo(() => {
    const set = new Set(documents.map(d => d.currency));
    return ["DOP", "USD", "EUR"].filter(c => set.has(c));
  }, [documents]);

  // Aging summary per currency
  const agingByCurrency = useMemo(() => {
    const now = new Date();
    const result: Record<string, AgingBuckets> = {};
    for (const cur of activeCurrencies) {
      result[cur] = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    }
    documents.filter(d => d.status !== "paid" && d.status !== "void" && d.document_type !== "advance").forEach(d => {
      const buckets = result[d.currency];
      if (!buckets) return;
      const due = d.due_date ? new Date(d.due_date) : new Date(d.document_date);
      const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      const bal = d.balance_remaining;
      if (days <= 0) buckets.current += bal;
      else if (days <= 30) buckets.d30 += bal;
      else if (days <= 60) buckets.d60 += bal;
      else if (days <= 90) buckets.d90 += bal;
      else buckets.d90plus += bal;
    });
    return result;
  }, [documents, activeCurrencies]);

  // DOP equivalent aging
  const agingDopEquivalent = useMemo(() => {
    const totals: AgingBuckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    for (const cur of activeCurrencies) {
      const b = agingByCurrency[cur];
      const rate = rates[cur] || 1;
      totals.current += b.current * rate;
      totals.d30 += b.d30 * rate;
      totals.d60 += b.d60 * rate;
      totals.d90 += b.d90 * rate;
      totals.d90plus += b.d90plus * rate;
    }
    return totals;
  }, [agingByCurrency, activeCurrencies, rates]);

  const bucketTotal = (b: AgingBuckets) => b.current + b.d30 + b.d60 + b.d90 + b.d90plus;

  // Total advances outstanding per currency
  const totalAdvancesByCurrency = useMemo(() => {
    const result: Record<string, number> = {};
    documents
      .filter(d => d.document_type === "advance" && d.status !== "paid" && d.status !== "void")
      .forEach(d => {
        result[d.currency] = (result[d.currency] || 0) + d.balance_remaining;
      });
    return result;
  }, [documents]);

  // Table footer totals per currency for visible docs
  const footerTotals = useMemo(() => {
    const result: Record<string, { total: number; paid: number; balance: number }> = {};
    filteredDocuments.forEach(d => {
      if (!result[d.currency]) result[d.currency] = { total: 0, paid: 0, balance: 0 };
      result[d.currency].total += d.total_amount;
      result[d.currency].paid += d.amount_paid;
      result[d.currency].balance += d.balance_remaining;
    });
    return result;
  }, [filteredDocuments]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = parseFloat(form.total_amount) || 0;
      if (form.post_journal && !form.offset_account_id) {
        throw new Error("Seleccione cuenta de contrapartida para publicar el asiento");
      }
      const { error } = await supabase.rpc("create_ap_ar_document" as any, {
        p_direction: direction,
        p_document_type: form.document_type,
        p_contact_name: form.contact_name,
        p_contact_rnc: form.contact_rnc || null,
        p_document_number: form.document_number || null,
        p_document_date: form.document_date,
        p_due_date: form.due_date || null,
        p_currency: form.currency,
        p_total_amount: totalAmount,
        p_notes: form.notes || null,
        p_account_id: form.account_id || null,
        p_supplier_id: null,
        p_contract_id: null,
        p_entity_id: selectedEntityId || null,
        p_offset_account_id: form.offset_account_id || null,
        p_post_journal: form.post_journal,
        p_exchange_rate: null,
        p_user_id: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      setDialogOpen(false);
      toast.success(t("common.save"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!allocDoc || !selectedAdvanceId || !allocAmount) throw new Error("Missing data");
      const amount = parseFloat(allocAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Monto inválido");
      
      const { error } = await supabase.from("advance_allocations").insert({
        advance_doc_id: selectedAdvanceId,
        invoice_doc_id: allocDoc.id,
        amount,
        allocated_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      setAllocDoc(null);
      setAllocAmount("");
      setSelectedAdvanceId("");
      toast.success(t("apar.advanceApplied"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyCreditMutation = useMutation({
    mutationFn: async () => {
      if (!creditDoc || !selectedCreditId || !creditAmount) throw new Error("Datos faltantes");
      const amount = parseFloat(creditAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Monto inválido");
      const { error } = await supabase.from("ap_ar_credit_applications" as any).insert({
        credit_doc_id: selectedCreditId,
        target_doc_id: creditDoc.id,
        amount,
        applied_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      setCreditDoc(null);
      setSelectedCreditId("");
      setCreditAmount("");
      toast.success("Nota aplicada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async () => {
      if (!dueDateDoc) throw new Error("Documento no encontrado");
      if (dueDateDoc.status === "paid" || dueDateDoc.status === "void") {
        throw new Error("No se puede editar la fecha de vencimiento de este documento");
      }

      if (editedDueDate) {
        const documentDate = parseDateLocal(dueDateDoc.document_date);
        if (editedDueDate < documentDate) {
          throw new Error("La fecha de vencimiento no puede ser anterior a la fecha del documento");
        }
      }

      const { error } = await supabase
        .from("ap_ar_documents")
        .update({ due_date: editedDueDate ? formatDateLocal(editedDueDate) : null })
        .eq("id", dueDateDoc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      setDueDateDoc(null);
      setEditedDueDate(undefined);
      toast.success("Fecha de vencimiento actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!voidDoc) throw new Error("No document");
      const { error } = await supabase.rpc("void_ap_ar_document" as any, {
        p_document_id: voidDoc.id,
        p_user_id: user?.id || null,
        p_reason: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      setVoidDoc(null);
      toast.success("Documento anulado y asientos reversados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({
      document_type: "invoice",
      supplier_id: "",
      contact_name: "",
      contact_rnc: "",
      document_number: "",
      document_date: new Date().toISOString().split("T")[0],
      due_date: "",
      currency: "DOP",
      total_amount: "",
      notes: "",
      account_id: glAccounts.length > 0 ? glAccounts[0].id : "",
      offset_account_id: "",
      post_journal: false,
    });
  };

  // Check if a doc row has available advances for same supplier
  const hasAdvancesForContact = (contactName: string) => {
    return documents.some(d =>
      d.document_type === "advance" &&
      d.contact_name === contactName &&
      d.status !== "paid" &&
      d.status !== "void" &&
      d.balance_remaining > 0
    );
  };

  const openDueDateDialog = (doc: ApArDocument) => {
    setDueDateDoc(doc);
    setEditedDueDate(doc.due_date ? parseDateLocal(doc.due_date) : undefined);
  };

  return (
    <div className="space-y-4">
      {/* Aging Summary — per currency */}
      {activeCurrencies.map(cur => {
        const b = agingByCurrency[cur];
        if (!b) return null;
        const total = bucketTotal(b);
        const advTotal = totalAdvancesByCurrency[cur] || 0;
        return (
          <div key={cur}>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-xs ${CURRENCY_BADGE_COLORS[cur] || ""}`}>{cur}</Badge>
              {cur !== "DOP" && rates[cur] && (
                <span className="text-xs text-muted-foreground">Tasa: {rates[cur].toFixed(2)}</span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {[
                { label: t("apar.agingCurrent"), value: b.current },
                { label: t("apar.aging30"), value: b.d30 },
                { label: t("apar.aging60"), value: b.d60 },
                { label: t("apar.aging90"), value: b.d90 },
                { label: t("apar.aging90plus"), value: b.d90plus },
                { label: t("common.total"), value: total },
                ...(direction === "payable" ? [{ label: t("apar.advances"), value: advTotal }] : []),
              ].map((bucket, i) => (
                <div key={i} className={`rounded-lg border p-2 ${i === 5 ? "bg-primary/5 border-primary/20" : ""} ${i === 6 ? "bg-accent/50 border-accent" : ""}`}>
                  <div className="text-xs text-muted-foreground">{bucket.label}</div>
                  <div className={`text-sm font-semibold ${bucket.value > 0 && i > 0 && i < 5 ? "text-destructive" : ""}`}>
                    {formatCurrency(bucket.value, cur)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* DOP Equivalent totals (only if multiple currencies) */}
      {activeCurrencies.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs bg-muted border-muted-foreground/20">RD$ Equivalente</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {[
              { label: t("apar.agingCurrent"), value: agingDopEquivalent.current },
              { label: t("apar.aging30"), value: agingDopEquivalent.d30 },
              { label: t("apar.aging60"), value: agingDopEquivalent.d60 },
              { label: t("apar.aging90"), value: agingDopEquivalent.d90 },
              { label: t("apar.aging90plus"), value: agingDopEquivalent.d90plus },
              { label: t("common.total"), value: bucketTotal(agingDopEquivalent) },
            ].map((bucket, i) => (
              <div key={i} className={`rounded-lg border p-2 border-dashed ${i === 5 ? "bg-primary/5 border-primary/30" : "border-muted-foreground/20"}`}>
                <div className="text-xs text-muted-foreground">{bucket.label}</div>
                <div className={`text-sm font-semibold ${bucket.value > 0 && i > 0 && i < 5 ? "text-destructive" : ""}`}>
                  {formatCurrency(bucket.value, "DOP")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredDocuments.length} {t("acctReport.transactions")}
          </span>
          {direction === "payable" && (
            <div className="flex gap-1">
              {(["all", "invoices", "advances"] as DocTypeFilter[]).map(filter => (
                <Button
                  key={filter}
                  variant={typeFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTypeFilter(filter)}
                >
                  {t(`apar.filter_${filter}`)}
                </Button>
              ))}
            </div>
          )}
          {activeCurrencies.length > 1 && (
            <div className="flex gap-1 ml-2">
              {(["all", ...activeCurrencies] as CurrencyFilter[]).map(cur => (
                <Button
                  key={cur}
                  variant={currencyFilter === cur ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCurrencyFilter(cur)}
                >
                  {cur === "all" ? t("apar.filter_all") : cur}
                </Button>
              ))}
            </div>
          )}
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMultiOpen(true)}>
              <Layers className="h-4 w-4 mr-1" />
              {direction === "payable" ? "Pago múltiple" : "Cobro múltiple"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> {t("apar.newDocument")}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("apar.noDocuments")}
          description={t("apar.noDocumentsDesc")}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("apar.documentNumber")}</TableHead>
                <TableHead>{t("common.type")}</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>{direction === "payable" ? t("apar.vendor") : t("apar.customer")}</TableHead>
                <TableHead>{t("apar.documentDate")}</TableHead>
                <TableHead>{t("apar.dueDate")}</TableHead>
                <TableHead className="text-right">{t("apar.totalAmount")}</TableHead>
                <TableHead className="text-right">{t("apar.amountPaid")}</TableHead>
                <TableHead className="text-right">{t("apar.balance")}</TableHead>
                <TableHead>{t("common.currency")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-sm">{doc.document_number || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t(`apar.${doc.document_type}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {doc.account_code ? `${doc.account_code}` : "—"}
                  </TableCell>
                  <TableCell>{doc.contact_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(doc.document_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{doc.due_date ? formatDate(doc.due_date) : "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(doc.total_amount, doc.currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(doc.amount_paid, doc.currency)}</TableCell>
                  <TableCell className={`text-right font-medium ${doc.balance_remaining > 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(doc.balance_remaining, doc.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${CURRENCY_BADGE_COLORS[doc.currency] || ""}`}>
                      {doc.currency}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[doc.status] || ""}>
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {doc.status !== "paid" && doc.status !== "void" && canWrite && doc.document_type !== "advance" && (
                        <>
                          {hasAdvancesForContact(doc.contact_name) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("apar.applyAdvance")}
                              onClick={() => { setAllocDoc(doc); setAllocAmount(""); setSelectedAdvanceId(""); }}
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                            </Button>
                          )}
                          {hasCreditsForContact(doc.contact_name, doc.currency) && (doc.document_type === "invoice" || doc.document_type === "bill") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Aplicar nota de crédito/débito"
                              onClick={() => { setCreditDoc(doc); setCreditAmount(""); setSelectedCreditId(""); }}
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Registrar Pago"
                            onClick={() => setPaymentDoc(doc)}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar vencimiento"
                            onClick={() => openDueDateDialog(doc)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Anular documento"
                            onClick={() => setVoidDoc(doc)}
                          >
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {/* Footer totals per currency */}
            <TableFooter>
              {Object.entries(footerTotals).map(([cur, t_]) => (
                <TableRow key={cur}>
                  <TableCell colSpan={6} className="text-right font-medium">
                    Subtotal {cur}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(t_.total, cur)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(t_.paid, cur)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(t_.balance, cur)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              ))}
              {Object.keys(footerTotals).length > 1 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-medium">
                    Total RD$ Equivalente
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      Object.entries(footerTotals).reduce((s, [c, v]) => s + v.total * (rates[c] || 1), 0),
                      "DOP"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      Object.entries(footerTotals).reduce((s, [c, v]) => s + v.paid * (rates[c] || 1), 0),
                      "DOP"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      Object.entries(footerTotals).reduce((s, [c, v]) => s + v.balance * (rates[c] || 1), 0),
                      "DOP"
                    )}
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </div>
      )}

      {/* New Document Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("apar.newDocument")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("common.type")}</Label>
                <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="invoice">{t("apar.invoice")}</SelectItem>
                    {direction === "payable" && <SelectItem value="bill">{t("apar.bill")}</SelectItem>}
                    <SelectItem value="credit_memo">{t("apar.creditMemo")}</SelectItem>
                    <SelectItem value="debit_note">{t("apar.debitNote")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("common.currency")}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Cuenta Contable *</Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {glAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_code} — {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("apar.contactName")} *</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("apar.contactRnc")}</Label>
                <Input value={form.contact_rnc} onChange={e => setForm(f => ({ ...f, contact_rnc: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("apar.documentNumber")}</Label>
                <Input value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t("apar.documentDate")}</Label>
                <Input type="date" value={form.document_date} onChange={e => setForm(f => ({ ...f, document_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("apar.dueDate")}</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("apar.totalAmount")} *</Label>
                <Input type="number" step="0.01" min="0" value={form.total_amount}
                  onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("common.notes")}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            {/* Optional journal posting */}
            <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.post_journal}
                  onChange={e => setForm(f => ({ ...f, post_journal: e.target.checked }))}
                />
                Publicar asiento contable al guardar
              </label>
              {form.post_journal && (
                <div className="space-y-1">
                  <Label className="text-xs">
                    {direction === "payable" ? "Cuenta de gasto/contrapartida" : "Cuenta de ingreso/contrapartida"} *
                  </Label>
                  <Select value={form.offset_account_id} onValueChange={v => setForm(f => ({ ...f, offset_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                    <SelectContent className="bg-popover max-h-[300px]">
                      {offsetAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.account_code} — {a.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !form.contact_name || !form.total_amount || !form.account_id ||
                (form.post_journal && !form.offset_account_id) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-document payment dialog */}
      <MultiPaymentDialog
        open={multiOpen}
        onOpenChange={setMultiOpen}
        direction={direction}
        documents={documents.filter(d => d.status !== "paid" && d.status !== "void" && d.balance_remaining > 0)}
      />

      {/* Advance Allocation Dialog */}
      <Dialog open={!!allocDoc} onOpenChange={open => { if (!open) setAllocDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("apar.applyAdvance")}</DialogTitle>
            <DialogDescription>
              {allocDoc?.contact_name} — {t("apar.balance")}: {allocDoc ? formatCurrency(allocDoc.balance_remaining, allocDoc.currency) : ""}
            </DialogDescription>
          </DialogHeader>
          {availableAdvances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("apar.noAdvances")}</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("apar.availableAdvances")}</Label>
                <Select value={selectedAdvanceId} onValueChange={v => {
                  setSelectedAdvanceId(v);
                  const adv = availableAdvances.find(a => a.id === v);
                  if (adv && allocDoc) {
                    setAllocAmount(Math.min(adv.balance_remaining, allocDoc.balance_remaining).toString());
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder={t("apar.selectAdvance")} /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {availableAdvances.map(adv => (
                      <SelectItem key={adv.id} value={adv.id}>
                        {formatDate(adv.document_date)} — {formatCurrency(adv.balance_remaining, adv.currency)}
                        {adv.document_number ? ` (${adv.document_number})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("apar.allocationAmount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAdvanceId ? Math.min(
                    availableAdvances.find(a => a.id === selectedAdvanceId)?.balance_remaining || 0,
                    allocDoc?.balance_remaining || 0
                  ) : undefined}
                  value={allocAmount}
                  onChange={e => setAllocAmount(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocDoc(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => allocateMutation.mutate()}
              disabled={!selectedAdvanceId || !allocAmount || parseFloat(allocAmount) <= 0 || allocateMutation.isPending}
            >
              {allocateMutation.isPending ? t("common.saving") : t("apar.applyAdvance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit memo / debit note application */}
      <Dialog open={!!creditDoc} onOpenChange={o => { if (!o) { setCreditDoc(null); setSelectedCreditId(""); setCreditAmount(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar nota de crédito / débito</DialogTitle>
            <DialogDescription>
              {creditDoc?.contact_name} — Saldo: {creditDoc ? formatCurrency(creditDoc.balance_remaining, creditDoc.currency) : ""}
            </DialogDescription>
          </DialogHeader>
          {availableCredits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin notas disponibles</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Notas disponibles</Label>
                <Select value={selectedCreditId} onValueChange={v => {
                  setSelectedCreditId(v);
                  const c = availableCredits.find(a => a.id === v);
                  if (c && creditDoc) setCreditAmount(Math.min(c.balance_remaining, creditDoc.balance_remaining).toFixed(2));
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar nota..." /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {availableCredits.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {t(`apar.${c.document_type}`)} {c.document_number || "s/n"} — {formatCurrency(c.balance_remaining, c.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Monto a aplicar</Label>
                <Input type="number" step="0.01" min="0" value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)} className="font-mono" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDoc(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => applyCreditMutation.mutate()}
              disabled={!selectedCreditId || !creditAmount || parseFloat(creditAmount) <= 0 || applyCreditMutation.isPending}
            >
              {applyCreditMutation.isPending ? t("common.saving") : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dueDateDoc} onOpenChange={open => {
        if (!open) {
          setDueDateDoc(null);
          setEditedDueDate(undefined);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar fecha de vencimiento</DialogTitle>
            <DialogDescription>
              {dueDateDoc?.contact_name} {dueDateDoc?.document_number ? `— ${dueDateDoc.document_number}` : ""}
            </DialogDescription>
          </DialogHeader>

          {dueDateDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground">Fecha documento</div>
                  <div className="font-medium">{formatDate(dueDateDoc.document_date)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground">Vencimiento actual</div>
                  <div className="font-medium">{dueDateDoc.due_date ? formatDate(dueDateDoc.due_date) : "Sin fecha"}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nueva fecha de vencimiento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editedDueDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editedDueDate ? format(editedDueDate, "PPP") : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editedDueDate}
                      onSelect={setEditedDueDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  No puede ser anterior a {formatDate(dueDateDoc.document_date)}.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditedDueDate(undefined)}
              disabled={updateDueDateMutation.isPending}
            >
              Quitar fecha
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDueDateDoc(null);
                  setEditedDueDate(undefined);
                }}
                disabled={updateDueDateMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={() => updateDueDateMutation.mutate()} disabled={updateDueDateMutation.isPending}>
                {updateDueDateMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PaymentDialog
        open={!!paymentDoc}
        onOpenChange={open => { if (!open) setPaymentDoc(null); }}
        document={paymentDoc}
      />

      {/* Void Confirmation */}
      <AlertDialog open={!!voidDoc} onOpenChange={open => { if (!open) setVoidDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular documento</AlertDialogTitle>
            <AlertDialogDescription>
              Se reversarán todos los asientos del documento y de sus pagos.
              {voidDoc?.document_number ? ` (${voidDoc.document_number})` : ""}
              {voidDoc ? ` — ${voidDoc.contact_name}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); voidMutation.mutate(); }}
              disabled={voidMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidMutation.isPending ? "Anulando..." : "Anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
