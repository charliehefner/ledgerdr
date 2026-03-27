import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Plus, FileText, Receipt, DollarSign, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { PaymentDialog } from "./PaymentDialog";

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
  const queryClient = useQueryClient();
  const canWrite = canWriteSection("ap-ar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDoc, setPaymentDoc] = useState<ApArDocument | null>(null);
  const [allocDoc, setAllocDoc] = useState<ApArDocument | null>(null);
  const [allocAmount, setAllocAmount] = useState("");
  const [selectedAdvanceId, setSelectedAdvanceId] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocTypeFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [form, setForm] = useState({
    document_type: "invoice",
    contact_name: "",
    contact_rnc: "",
    document_number: "",
    document_date: new Date().toISOString().split("T")[0],
    due_date: "",
    currency: "DOP",
    total_amount: "",
    notes: "",
    account_id: "",
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
      for (const pair of ["USD_DOP", "EUR_DOP"]) {
        const { data } = await supabase
          .from("exchange_rates")
          .select("sell_rate")
          .eq("currency_pair", pair)
          .order("rate_date", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const currency = pair.split("_")[0];
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
      const { error } = await supabase.from("ap_ar_documents").insert({
        direction,
        document_type: form.document_type,
        contact_name: form.contact_name,
        contact_rnc: form.contact_rnc || null,
        document_number: form.document_number || null,
        document_date: form.document_date,
        due_date: form.due_date || null,
        currency: form.currency,
        total_amount: totalAmount,
        notes: form.notes || null,
        created_by: user?.id || null,
        account_id: form.account_id || null,
        status: 'open',
        amount_paid: 0,
        balance_remaining: totalAmount,
      } as any);
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

  const resetForm = () => {
    setForm({
      document_type: "invoice",
      contact_name: "",
      contact_rnc: "",
      document_number: "",
      document_date: new Date().toISOString().split("T")[0],
      due_date: "",
      currency: "DOP",
      total_amount: "",
      notes: "",
      account_id: glAccounts.length > 0 ? glAccounts[0].id : "",
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

  return (
    <div className="space-y-4">
      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {[
          { label: t("apar.agingCurrent"), value: aging.current },
          { label: t("apar.aging30"), value: aging.d30 },
          { label: t("apar.aging60"), value: aging.d60 },
          { label: t("apar.aging90"), value: aging.d90 },
          { label: t("apar.aging90plus"), value: aging.d90plus },
          { label: t("common.total"), value: totalOutstanding },
          ...(direction === "payable" ? [{ label: t("apar.advances"), value: totalAdvances }] : []),
        ].map((bucket, i) => (
          <div key={i} className={`rounded-lg border p-3 ${i === 5 ? "bg-primary/5 border-primary/20" : ""} ${i === 6 ? "bg-accent/50 border-accent" : ""}`}>
            <div className="text-xs text-muted-foreground">{bucket.label}</div>
            <div className={`text-sm font-semibold ${bucket.value > 0 && i > 0 && i < 5 ? "text-destructive" : ""}`}>
              {formatCurrency(bucket.value, "DOP")}
            </div>
          </div>
        ))}
      </div>

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
        </div>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> {t("apar.newDocument")}
          </Button>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Registrar Pago"
                            onClick={() => setPaymentDoc(doc)}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.contact_name || !form.total_amount || !form.account_id || createMutation.isPending}>
              {createMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Payment Dialog */}
      <PaymentDialog
        open={!!paymentDoc}
        onOpenChange={open => { if (!open) setPaymentDoc(null); }}
        document={paymentDoc}
      />
    </div>
  );
}
