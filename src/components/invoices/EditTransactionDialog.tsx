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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Transaction, updateTransaction, deleteTransaction, fetchAccounts, fetchProjects, fetchCbsCodes } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Transaction>) =>
      updateTransaction(transaction!.id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["reportTransactions"] });
      toast.success("Transaction updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTransaction(transaction!.id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["reportTransactions"] });
      toast.success("Transaction deleted successfully");
      onOpenChange(false);
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      transaction_date: formData.transaction_date,
      master_acct_code: formData.master_acct_code || undefined,
      project_code: formData.project_code || undefined,
      cbs_code: formData.cbs_code || undefined,
      description: formData.description,
      currency: formData.currency,
      amount: parseFloat(formData.amount) || 0,
      itbis: formData.itbis ? parseFloat(formData.itbis) : undefined,
      pay_method: formData.pay_method || undefined,
      document: formData.document || undefined,
      name: formData.name || undefined,
      comments: formData.comments || undefined,
    });
  };

  if (!transaction) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction #{transaction.id}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Transaction Date</Label>
                <Input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) =>
                    setFormData({ ...formData, transaction_date: e.target.value })
                  }
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) =>
                    setFormData({ ...formData, currency: v as "DOP" | "USD" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Account */}
              <div className="space-y-2">
                <Label>Master Account</Label>
                <Select
                  value={formData.master_acct_code}
                  onValueChange={(v) =>
                    setFormData({ ...formData, master_acct_code: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[200px]">
                    {accounts.map((acc) => (
                      <SelectItem key={acc.code} value={acc.code}>
                        {acc.code} - {getDescription(acc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={formData.project_code || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, project_code: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[200px]">
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((proj) => (
                      <SelectItem key={proj.code} value={proj.code}>
                        {proj.code} - {getDescription(proj)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CBS Code */}
              <div className="space-y-2">
                <Label>CBS Code</Label>
                <Select
                  value={formData.cbs_code || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, cbs_code: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select CBS" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[200px]">
                    <SelectItem value="none">None</SelectItem>
                    {cbsCodes.map((cbs) => (
                      <SelectItem key={cbs.code} value={cbs.code}>
                        {cbs.code} - {getDescription(cbs)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pay Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={formData.pay_method || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, pay_method: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="cc_management">CC Management</SelectItem>
                    <SelectItem value="cc_personal">CC Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                />
              </div>

              {/* ITBIS */}
              <div className="space-y-2">
                <Label>ITBIS</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.itbis}
                  onChange={(e) =>
                    setFormData({ ...formData, itbis: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Vendor/Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            {/* Document */}
            <div className="space-y-2">
              <Label>Document #</Label>
              <Input
                value={formData.document}
                onChange={(e) =>
                  setFormData({ ...formData, document: e.target.value })
                }
              />
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea
                value={formData.comments}
                onChange={(e) =>
                  setFormData({ ...formData, comments: e.target.value })
                }
                rows={2}
              />
            </div>

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              transaction #{transaction.id}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
