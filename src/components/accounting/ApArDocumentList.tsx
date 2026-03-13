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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Plus, FileText, Receipt, DollarSign } from "lucide-react";
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
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 border-yellow-200",
  partial: "bg-blue-100 text-blue-800 border-blue-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  void: "bg-gray-100 text-gray-800 border-gray-200",
};

interface Props {
  direction: "receivable" | "payable";
}

export function ApArDocumentList({ direction }: Props) {
  const { t } = useLanguage();
  const { canWriteSection, user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = canWriteSection("ap-ar");
  const [dialogOpen, setDialogOpen] = useState(false);
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
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["ap-ar-documents", direction],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ap_ar_documents")
        .select("*")
        .eq("direction", direction)
        .order("document_date", { ascending: false });
      if (error) throw error;
      return data as ApArDocument[];
    },
  });

  // Aging summary
  const aging = useMemo(() => {
    const now = new Date();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    documents.filter(d => d.status !== "paid" && d.status !== "void").forEach(d => {
      const due = d.due_date ? new Date(d.due_date) : new Date(d.document_date);
      const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      const bal = d.balance_remaining;
      if (days <= 0) buckets.current += bal;
      else if (days <= 30) buckets.d30 += bal;
      else if (days <= 60) buckets.d60 += bal;
      else if (days <= 90) buckets.d90 += bal;
      else buckets.d90plus += bal;
    });
    return buckets;
  }, [documents]);

  const totalOutstanding = aging.current + aging.d30 + aging.d60 + aging.d90 + aging.d90plus;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ap_ar_documents").insert({
        direction,
        document_type: form.document_type,
        contact_name: form.contact_name,
        contact_rnc: form.contact_rnc || null,
        document_number: form.document_number || null,
        document_date: form.document_date,
        due_date: form.due_date || null,
        currency: form.currency,
        total_amount: parseFloat(form.total_amount) || 0,
        notes: form.notes || null,
        created_by: user?.id || null,
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
    });
  };

  return (
    <div className="space-y-4">
      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: t("apar.agingCurrent"), value: aging.current },
          { label: t("apar.aging30"), value: aging.d30 },
          { label: t("apar.aging60"), value: aging.d60 },
          { label: t("apar.aging90"), value: aging.d90 },
          { label: t("apar.aging90plus"), value: aging.d90plus },
          { label: t("common.total"), value: totalOutstanding },
        ].map((bucket, i) => (
          <div key={i} className={`rounded-lg border p-3 ${i === 5 ? "bg-primary/5 border-primary/20" : ""}`}>
            <div className="text-xs text-muted-foreground">{bucket.label}</div>
            <div className={`text-sm font-semibold ${bucket.value > 0 && i > 0 && i < 5 ? "text-destructive" : ""}`}>
              {formatCurrency(bucket.value, "DOP")}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {documents.length} {t("acctReport.transactions")}
        </span>
        {canWrite && (
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> {t("apar.newDocument")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : documents.length === 0 ? (
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
                <TableHead>{t("apar.contactName")}</TableHead>
                <TableHead>{t("apar.documentDate")}</TableHead>
                <TableHead>{t("apar.dueDate")}</TableHead>
                <TableHead className="text-right">{t("apar.totalAmount")}</TableHead>
                <TableHead className="text-right">{t("apar.amountPaid")}</TableHead>
                <TableHead className="text-right">{t("apar.balance")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-sm">{doc.document_number || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t(`apar.${doc.document_type}`)}
                    </Badge>
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
            <Button onClick={() => createMutation.mutate()} disabled={!form.contact_name || !form.total_amount || createMutation.isPending}>
              {createMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
