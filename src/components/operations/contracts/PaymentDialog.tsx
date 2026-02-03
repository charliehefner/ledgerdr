import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ServiceContract } from "../ContractedServicesView";

export interface ContractPayment {
  id: string;
  contract_id: string;
  transaction_id: string;
  payment_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ContractPayment | null;
  contracts: ServiceContract[];
  preselectedContractId?: string;
}

interface FormData {
  contract_id: string;
  transaction_id: string;
  payment_date: string;
  amount: number;
  notes: string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  payment,
  contracts,
  preselectedContractId,
}: PaymentDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      contract_id: preselectedContractId || "",
      transaction_id: "",
      payment_date: new Date().toISOString().split("T")[0],
      amount: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (payment) {
      form.reset({
        contract_id: payment.contract_id,
        transaction_id: payment.transaction_id,
        payment_date: payment.payment_date,
        amount: payment.amount,
        notes: payment.notes || "",
      });
    } else {
      form.reset({
        contract_id: preselectedContractId || "",
        transaction_id: "",
        payment_date: new Date().toISOString().split("T")[0],
        amount: 0,
        notes: "",
      });
    }
  }, [payment, preselectedContractId, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        contract_id: data.contract_id,
        transaction_id: data.transaction_id,
        payment_date: data.payment_date,
        amount: data.amount,
        notes: data.notes || null,
      };

      if (payment) {
        const { error } = await supabase
          .from("service_contract_payments")
          .update(payload)
          .eq("id", payment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_contract_payments")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contract-payments-detail"] });
      toast.success(payment ? t("contracts.paymentUpdated") : t("contracts.paymentCreated"));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("contracts.paymentSaveError"));
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payment ? t("contracts.editPayment") : t("contracts.newPayment")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="contract_id"
              rules={{ required: t("common.required") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contracts.contract")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!!preselectedContractId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("contracts.selectContract")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.contract_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_id"
              rules={{ required: t("common.required") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contracts.transactionId")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("contracts.transactionIdPlaceholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              rules={{ required: t("common.required") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contracts.paymentDate")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              rules={{ required: t("common.required"), min: { value: 0.01, message: t("common.required") } }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.amount")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.notes")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("contracts.paymentNotesPlaceholder")} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
