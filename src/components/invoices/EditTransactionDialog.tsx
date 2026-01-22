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
import { Transaction, voidTransaction, fetchAccounts, fetchProjects, fetchCbsCodes } from "@/lib/api";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { getDescription } = useLanguage();
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  
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
    if (transaction) {
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
        document: transaction.document || "",
        name: transaction.name || "",
        comments: transaction.comments || "",
      });
    }
  }, [transaction]);


  const voidMutation = useMutation({
    mutationFn: () => voidTransaction(transaction!.id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["reportTransactions"] });
      toast.success("Transaction voided successfully");
      onOpenChange(false);
      setShowVoidConfirm(false);
    },
    onError: (error) => {
      toast.error(`Failed to void: ${error.message}`);
    },
  });


  if (!transaction) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Transaction #{transaction.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Transaction Date</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={formData.currency}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Account */}
              <div className="space-y-2">
                <Label>Master Account</Label>
                <Input
                  value={formData.master_acct_code ? `${formData.master_acct_code} - ${getDescription(accounts.find(a => a.code === formData.master_acct_code) || { english_description: '', spanish_description: '' })}` : ''}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Project</Label>
                <Input
                  value={formData.project_code ? `${formData.project_code} - ${getDescription(projects.find(p => p.code === formData.project_code) || { english_description: '', spanish_description: '' })}` : 'None'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* CBS Code */}
              <div className="space-y-2">
                <Label>CBS Code</Label>
                <Input
                  value={formData.cbs_code ? `${formData.cbs_code} - ${getDescription(cbsCodes.find(c => c.code === formData.cbs_code) || { english_description: '', spanish_description: '' })}` : 'None'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Pay Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Input
                  value={formData.pay_method || 'None'}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Amount</Label>
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
              <Label>Description</Label>
              <Input
                value={formData.description}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Vendor/Name</Label>
              <Input
                value={formData.name || ''}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Document */}
            <div className="space-y-2">
              <Label>Document #</Label>
              <Input
                value={formData.document || ''}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Comments</Label>
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
                  Void
                </Button>
              )}
              {transaction.is_void && (
                <span className="text-muted-foreground italic">This transaction is voided</span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>


      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark transaction #{transaction.id} as voided. The transaction will remain in records but be marked as void.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => voidMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
