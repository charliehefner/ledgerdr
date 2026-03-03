import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Transaction, voidTransaction, fetchAccounts, fetchProjects, fetchCbsCodes, updateTransaction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ban, Loader2, Lock, Save } from "lucide-react";
import { getDescription } from "@/lib/getDescription";
import { useLanguage } from "@/contexts/LanguageContext";
import { TIPO_BIENES_SERVICIOS } from "@/components/accounting/dgiiConstants";

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: EditTransactionDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isJournalPosted, setIsJournalPosted] = useState(false);
  const [checkingJournal, setCheckingJournal] = useState(false);

  // Editable fields state
  const [editedDocument, setEditedDocument] = useState("");
  const [originalDocument, setOriginalDocument] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [editedRnc, setEditedRnc] = useState("");
  const [originalRnc, setOriginalRnc] = useState("");
  const [editedItbis, setEditedItbis] = useState("");
  const [originalItbis, setOriginalItbis] = useState("");
  const [editedItbisRetenido, setEditedItbisRetenido] = useState("");
  const [originalItbisRetenido, setOriginalItbisRetenido] = useState("");
  const [editedIsrRetenido, setEditedIsrRetenido] = useState("");
  const [originalIsrRetenido, setOriginalIsrRetenido] = useState("");
  const [editedPayMethod, setEditedPayMethod] = useState("");
  const [originalPayMethod, setOriginalPayMethod] = useState("");
  const [editedTipoBienes, setEditedTipoBienes] = useState("");
  const [originalTipoBienes, setOriginalTipoBienes] = useState("");
  const [editedCostCenter, setEditedCostCenter] = useState("");
  const [originalCostCenter, setOriginalCostCenter] = useState("");

  // Form data for previously read-only fields
  const [formData, setFormData] = useState({
    transaction_date: "",
    master_acct_code: "",
    project_code: "",
    cbs_code: "",
    currency: "DOP" as "DOP" | "USD" | "EUR",
    amount: "",
    name: "",
    comments: "",
    transaction_direction: "purchase" as "purchase" | "sale" | "investment" | "payment",
    destination_acct_code: "",
  });
  const [originalFormData, setOriginalFormData] = useState(formData);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const { data: cbsCodes = [] } = useQuery({
    queryKey: ["cbsCodes"],
    queryFn: fetchCbsCodes,
  });

  // Check journal posted status
  useEffect(() => {
    if (transaction?.id && open) {
      setCheckingJournal(true);
      supabase
        .from('journals')
        .select('posted')
        .eq('transaction_source_id', transaction.id)
        .eq('posted', true)
        .maybeSingle()
        .then(({ data }) => {
          setIsJournalPosted(!!data);
          setCheckingJournal(false);
        });
    } else {
      setIsJournalPosted(false);
    }
  }, [transaction?.id, open]);

  useEffect(() => {
    if (transaction && open) {
      const docValue = transaction.document ?? "";
      const descValue = transaction.description || "";
      const rncValue = transaction.rnc || "";
      const itbisValue = String(transaction.itbis || "");
      const itbisRetValue = String(transaction.itbis_retenido || "");
      const isrRetValue = String(transaction.isr_retenido || "");
      const payMethodValue = transaction.pay_method || "";
      const tipoBienesValue = transaction.dgii_tipo_bienes_servicios || "";
      const costCenterValue = (transaction as any).cost_center || "general";

      const newFormData = {
        transaction_date: transaction.transaction_date?.split("T")[0] || "",
        master_acct_code: transaction.master_acct_code || "",
        project_code: transaction.project_code || "",
        cbs_code: transaction.cbs_code || "",
        currency: transaction.currency || "DOP",
        amount: String(transaction.amount || ""),
        name: transaction.name || "",
        comments: transaction.comments || "",
        transaction_direction: transaction.transaction_direction || "purchase",
        destination_acct_code: transaction.destination_acct_code || "",
      };
      setFormData(newFormData);
      setOriginalFormData(newFormData);

      setEditedDocument(docValue);
      setOriginalDocument(docValue);
      setEditedDescription(descValue);
      setOriginalDescription(descValue);
      setEditedRnc(rncValue);
      setOriginalRnc(rncValue);
      setEditedItbis(itbisValue);
      setOriginalItbis(itbisValue);
      setEditedItbisRetenido(itbisRetValue);
      setOriginalItbisRetenido(itbisRetValue);
      setEditedIsrRetenido(isrRetValue);
      setOriginalIsrRetenido(isrRetValue);
      setEditedPayMethod(payMethodValue);
      setOriginalPayMethod(payMethodValue);
      setEditedTipoBienes(tipoBienesValue);
      setOriginalTipoBienes(tipoBienesValue);
      setEditedCostCenter(costCenterValue);
      setOriginalCostCenter(costCenterValue);
    }
  }, [transaction, open]);


  const voidMutation = useMutation({
    mutationFn: () => voidTransaction(transaction!.legacy_id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["reportTransactions"] });
      toast.success("Transacción anulada exitosamente");
      onOpenChange(false);
      setShowVoidConfirm(false);
    },
    onError: (error) => {
      toast.error(`Error al anular: ${error.message}`);
    },
  });

  const handleSaveChanges = async () => {
    if (!transaction?.legacy_id) return;
    setIsSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (editedDocument !== originalDocument) updates.document = editedDocument;
      if (editedDescription !== originalDescription) updates.description = editedDescription;
      if (editedRnc !== originalRnc) updates.rnc = editedRnc || null;
      if (editedItbis !== originalItbis) updates.itbis = editedItbis ? parseFloat(editedItbis) : null;
      if (editedItbisRetenido !== originalItbisRetenido) updates.itbis_retenido = editedItbisRetenido ? parseFloat(editedItbisRetenido) : null;
      if (editedIsrRetenido !== originalIsrRetenido) updates.isr_retenido = editedIsrRetenido ? parseFloat(editedIsrRetenido) : null;
      if (editedPayMethod !== originalPayMethod) updates.pay_method = editedPayMethod || null;
      if (editedTipoBienes !== originalTipoBienes) updates.dgii_tipo_bienes_servicios = editedTipoBienes || null;
      if (editedCostCenter !== originalCostCenter) updates.cost_center = editedCostCenter;

      // New editable fields
      if (formData.transaction_date !== originalFormData.transaction_date) updates.transaction_date = formData.transaction_date;
      if (formData.master_acct_code !== originalFormData.master_acct_code) updates.master_acct_code = formData.master_acct_code;
      if (formData.project_code !== originalFormData.project_code) updates.project_code = formData.project_code || null;
      if (formData.cbs_code !== originalFormData.cbs_code) updates.cbs_code = formData.cbs_code || null;
      if (formData.currency !== originalFormData.currency) updates.currency = formData.currency;
      if (formData.amount !== originalFormData.amount) updates.amount = parseFloat(formData.amount);
      if (formData.name !== originalFormData.name) updates.name = formData.name || null;
      if (formData.comments !== originalFormData.comments) updates.comments = formData.comments || null;
      if (formData.transaction_direction !== originalFormData.transaction_direction) updates.transaction_direction = formData.transaction_direction;
      if (formData.destination_acct_code !== originalFormData.destination_acct_code) updates.destination_acct_code = formData.destination_acct_code || null;

      await updateTransaction(String(transaction.legacy_id), updates);

      // Sync original values
      setOriginalDocument(editedDocument);
      setOriginalDescription(editedDescription);
      setOriginalRnc(editedRnc);
      setOriginalItbis(editedItbis);
      setOriginalItbisRetenido(editedItbisRetenido);
      setOriginalIsrRetenido(editedIsrRetenido);
      setOriginalPayMethod(editedPayMethod);
      setOriginalTipoBienes(editedTipoBienes);
      setOriginalCostCenter(editedCostCenter);
      setOriginalFormData({ ...formData });

      queryClient.invalidateQueries({ queryKey: ["invoiceTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["reportTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["allTransactions"] });
      toast.success("Cambios guardados exitosamente");
    } catch (error) {
      toast.error("Error al guardar cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    editedDocument !== originalDocument ||
    editedDescription !== originalDescription ||
    editedRnc !== originalRnc ||
    editedItbis !== originalItbis ||
    editedItbisRetenido !== originalItbisRetenido ||
    editedIsrRetenido !== originalIsrRetenido ||
    editedPayMethod !== originalPayMethod ||
    editedTipoBienes !== originalTipoBienes ||
    editedCostCenter !== originalCostCenter ||
    formData.transaction_date !== originalFormData.transaction_date ||
    formData.master_acct_code !== originalFormData.master_acct_code ||
    formData.project_code !== originalFormData.project_code ||
    formData.cbs_code !== originalFormData.cbs_code ||
    formData.currency !== originalFormData.currency ||
    formData.amount !== originalFormData.amount ||
    formData.name !== originalFormData.name ||
    formData.comments !== originalFormData.comments ||
    formData.transaction_direction !== originalFormData.transaction_direction ||
    formData.destination_acct_code !== originalFormData.destination_acct_code;

  if (!transaction) return null;

  const locked = isJournalPosted || transaction.is_void;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {locked ? "Ver" : "Editar"} Transacción #{transaction.legacy_id}
            </DialogTitle>
          </DialogHeader>

          {isJournalPosted && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Esta transacción tiene un asiento contable publicado y no puede ser editada.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Fecha de Transacción</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData(f => ({ ...f, transaction_date: e.target.value }))}
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Moneda</Label>
                {locked ? (
                  <Input value={formData.currency} readOnly className="bg-muted" />
                ) : (
                  <Select
                    value={formData.currency}
                    onValueChange={(v) => setFormData(f => ({ ...f, currency: v as "DOP" | "USD" | "EUR" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="DOP">DOP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Account */}
              <div className="space-y-2">
                <Label>Cuenta Principal</Label>
                {locked ? (
                  <Input
                    value={formData.master_acct_code ? `${formData.master_acct_code} - ${getDescription(accounts.find(a => a.code === formData.master_acct_code) || { english_description: '', spanish_description: '' })}` : ''}
                    readOnly
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={formData.master_acct_code}
                    onValueChange={(v) => setFormData(f => ({ ...f, master_acct_code: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      {accounts.map((a) => (
                        <SelectItem key={a.code} value={a.code}>
                          {a.code} - {getDescription(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Proyecto</Label>
                {locked ? (
                  <Input
                    value={formData.project_code ? `${formData.project_code} - ${getDescription(projects.find(p => p.code === formData.project_code) || { english_description: '', spanish_description: '' })}` : 'Ninguno'}
                    readOnly
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={formData.project_code || "__none__"}
                    onValueChange={(v) => setFormData(f => ({ ...f, project_code: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ninguno" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      <SelectItem value="__none__">Ninguno</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.code} - {getDescription(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* CBS Code */}
              <div className="space-y-2">
                <Label>Código CBS</Label>
                {locked ? (
                  <Input
                    value={formData.cbs_code ? `${formData.cbs_code} - ${getDescription(cbsCodes.find(c => c.code === formData.cbs_code) || { english_description: '', spanish_description: '' })}` : 'Ninguno'}
                    readOnly
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={formData.cbs_code || "__none__"}
                    onValueChange={(v) => setFormData(f => ({ ...f, cbs_code: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ninguno" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      <SelectItem value="__none__">Ninguno</SelectItem>
                      {cbsCodes.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} - {getDescription(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type={locked ? "text" : "number"}
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Descripción"
                readOnly={locked}
                className={locked ? "bg-muted" : ""}
              />
            </div>

            {/* Name and RNC */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor/Nombre</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre"
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>RNC</Label>
                <Input
                  value={editedRnc}
                  onChange={(e) => setEditedRnc(e.target.value)}
                  placeholder="RNC / Cédula"
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>
            </div>

            {/* Document */}
            <div className="space-y-2">
              <Label>Documento # (NCF)</Label>
              <Input
                value={editedDocument}
                onChange={(e) => setEditedDocument(e.target.value)}
                placeholder="Ingrese número de documento/NCF"
                readOnly={locked}
                className={locked ? "bg-muted" : ""}
              />
            </div>

            {/* ITBIS fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ITBIS</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editedItbis}
                  onChange={(e) => setEditedItbis(e.target.value)}
                  placeholder="0.00"
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>ITBIS Retenido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editedItbisRetenido}
                  onChange={(e) => setEditedItbisRetenido(e.target.value)}
                  placeholder="0.00"
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>ISR Retenido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editedIsrRetenido}
                  onChange={(e) => setEditedIsrRetenido(e.target.value)}
                  placeholder="0.00"
                  readOnly={locked}
                  className={locked ? "bg-muted" : ""}
                />
              </div>
            </div>

            {/* Transaction Direction */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dirección</Label>
                {locked ? (
                  <Input
                    value={
                      formData.transaction_direction === 'purchase' ? 'Compra' :
                      formData.transaction_direction === 'sale' ? 'Venta' :
                      formData.transaction_direction === 'investment' ? 'Inversión' :
                      formData.transaction_direction === 'payment' ? 'Pago' : ''
                    }
                    readOnly
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={formData.transaction_direction}
                    onValueChange={(v) => setFormData(f => ({ ...f, transaction_direction: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="purchase">Compra</SelectItem>
                      <SelectItem value="sale">Venta</SelectItem>
                      <SelectItem value="investment">Inversión</SelectItem>
                      <SelectItem value="payment">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Destination Account - shown for investment/payment */}
              {(formData.transaction_direction === 'investment' || formData.transaction_direction === 'payment') && (
                <div className="space-y-2">
                  <Label>Cuenta Destino</Label>
                  {locked ? (
                    <Input
                      value={formData.destination_acct_code ? `${formData.destination_acct_code} - ${getDescription(accounts.find(a => a.code === formData.destination_acct_code) || { english_description: '', spanish_description: '' })}` : ''}
                      readOnly
                      className="bg-muted"
                    />
                  ) : (
                    <Select
                      value={formData.destination_acct_code || "__none__"}
                      onValueChange={(v) => setFormData(f => ({ ...f, destination_acct_code: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cuenta" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover max-h-60">
                        <SelectItem value="__none__">Ninguno</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.code} value={a.code}>
                            {a.code} - {getDescription(a)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Pay Method and Tipo Bienes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('txForm.payMethod')}</Label>
                {locked ? (
                  <Input value={editedPayMethod} readOnly className="bg-muted" />
                ) : (
                  <Select
                    value={editedPayMethod}
                    onValueChange={setEditedPayMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('txForm.selectMethod')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="transfer_bdi">{t('txForm.transferBdi')}</SelectItem>
                      <SelectItem value="transfer_bhd">{t('txForm.transferBhd')}</SelectItem>
                      <SelectItem value="cash">{t('txForm.cash')}</SelectItem>
                      <SelectItem value="cc_management">{t('txForm.ccManagement')}</SelectItem>
                      <SelectItem value="cc_agri">{t('txForm.ccAgri')}</SelectItem>
                      <SelectItem value="cc_industry">{t('txForm.ccIndustry')}</SelectItem>
                      <SelectItem value="credit">{t('txForm.credit')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {formData.transaction_direction === 'purchase' && (
                <div className="space-y-2">
                  <Label>Tipo Bienes/Servicios</Label>
                  {locked ? (
                    <Input value={editedTipoBienes} readOnly className="bg-muted" />
                  ) : (
                    <Select
                      value={editedTipoBienes}
                      onValueChange={setEditedTipoBienes}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {Object.entries(TIPO_BIENES_SERVICIOS).map(([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {code} - {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Cost Center */}
            <div className="space-y-2">
              <Label>Centro de Costo</Label>
              {locked ? (
                <Input value={editedCostCenter} readOnly className="bg-muted" />
              ) : (
                <Select value={editedCostCenter} onValueChange={setEditedCostCenter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar centro de costo" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="agricultural">Agrícola</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Comentarios</Label>
              <Textarea
                value={formData.comments || ''}
                onChange={(e) => setFormData(f => ({ ...f, comments: e.target.value }))}
                readOnly={locked}
                className={locked ? "bg-muted" : ""}
                rows={2}
              />
            </div>

            <DialogFooter className="flex justify-between gap-2">
              {!transaction.is_void && !locked && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowVoidConfirm(true)}
                  disabled={voidMutation.isPending}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Anular
                </Button>
              )}
              {transaction.is_void && (
                <span className="text-muted-foreground italic">Esta transacción está anulada</span>
              )}
              <div className="flex gap-2">
                {hasChanges && !locked && (
                  <Button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Guardar Cambios
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cerrar
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>


      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular Transacción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto marcará la transacción #{transaction.legacy_id} como anulada. La transacción permanecerá en los registros pero se marcará como anulada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => voidMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
