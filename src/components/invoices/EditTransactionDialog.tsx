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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Transaction, voidTransaction, fetchAccounts, fetchProjects, fetchCbsCodes, updateTransaction } from "@/lib/api";
import { toast } from "sonner";
import { Ban, Loader2, Save } from "lucide-react";
import { getDescription } from "@/lib/getDescription";

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
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [editedDocument, setEditedDocument] = useState("");
  const [originalDocument, setOriginalDocument] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    transaction_date: "",
    master_acct_code: "",
    project_code: "",
    cbs_code: "",
    description: "",
    currency: "DOP" as "DOP" | "USD",
    amount: "",
    itbis: "",
    pay_method: "",
    document: "",
    name: "",
    rnc: "",
    comments: "",
  });

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

  useEffect(() => {
    if (transaction && open) {
      const docValue = transaction.document ?? "";
      setFormData({
        transaction_date: transaction.transaction_date?.split("T")[0] || "",
        master_acct_code: transaction.master_acct_code || "",
        project_code: transaction.project_code || "",
        cbs_code: transaction.cbs_code || "",
        description: transaction.description || "",
        currency: transaction.currency || "DOP",
        amount: String(transaction.amount || ""),
        itbis: String(transaction.itbis || ""),
        pay_method: transaction.pay_method || "",
        document: docValue,
        name: transaction.name || "",
        rnc: transaction.rnc || "",
        comments: transaction.comments || "",
      });
      setEditedDocument(docValue);
      setOriginalDocument(docValue);
    }
  }, [transaction, open]);


  const voidMutation = useMutation({
    mutationFn: () => voidTransaction(transaction!.id!),
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

  const handleSaveDocument = async () => {
    if (!transaction?.id) return;
    setIsSaving(true);
    try {
      await updateTransaction(String(transaction.id), { document: editedDocument });
      setOriginalDocument(editedDocument);
      queryClient.invalidateQueries({ queryKey: ["invoiceTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      toast.success("Documento # guardado exitosamente");
    } catch (error) {
      toast.error("Error al guardar Documento #");
    } finally {
      setIsSaving(false);
    }
  };

  const hasDocumentChanges = editedDocument !== originalDocument;

  if (!transaction) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ver Transacción #{transaction.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Fecha de Transacción</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input
                  value={formData.currency}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Account */}
              <div className="space-y-2">
                <Label>Cuenta Principal</Label>
                <Input
                  value={formData.master_acct_code ? `${formData.master_acct_code} - ${getDescription(accounts.find(a => a.code === formData.master_acct_code) || { english_description: '', spanish_description: '' })}` : ''}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Proyecto</Label>
                <Input
                  value={formData.project_code ? `${formData.project_code} - ${getDescription(projects.find(p => p.code === formData.project_code) || { english_description: '', spanish_description: '' })}` : 'Ninguno'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* CBS Code */}
              <div className="space-y-2">
                <Label>Código CBS</Label>
                <Input
                  value={formData.cbs_code ? `${formData.cbs_code} - ${getDescription(cbsCodes.find(c => c.code === formData.cbs_code) || { english_description: '', spanish_description: '' })}` : 'Ninguno'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Pay Method */}
              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Input
                  value={formData.pay_method || 'Ninguno'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  value={formData.amount}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* ITBIS */}
              <div className="space-y-2">
                <Label>ITBIS</Label>
                <Input
                  value={formData.itbis || '0'}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={formData.description}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Name and RNC */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor/Nombre</Label>
                <Input
                  value={formData.name || ''}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>RNC</Label>
                <Input
                  value={formData.rnc || ''}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Document - EDITABLE */}
            <div className="space-y-2">
              <Label>Documento # (NCF)</Label>
              <div className="flex gap-2">
                <Input
                  value={editedDocument}
                  onChange={(e) => setEditedDocument(e.target.value)}
                  placeholder="Ingrese número de documento/NCF"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveDocument}
                  disabled={!hasDocumentChanges || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Este campo puede actualizarse después de guardar</p>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Comentarios</Label>
              <Textarea
                value={formData.comments || ''}
                readOnly
                className="bg-muted"
                rows={2}
              />
            </div>

            <DialogFooter className="flex justify-between">
              {!transaction.is_void && (
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
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>


      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular Transacción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto marcará la transacción #{transaction.id} como anulada. La transacción permanecerá en los registros pero se marcará como anulada.
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
