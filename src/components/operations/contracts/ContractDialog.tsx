import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ServiceContract } from "../ContractedServicesView";

interface ContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ServiceContract | null;
}

interface FormData {
  contract_name: string;
  owner_name: string;
  owner_cedula_rnc: string;
  bank: string;
  bank_account: string;
  operation_type: string;
  operation_type_other: string;
  unit_type: string;
  price_per_unit: number;
  farm_id: string;
  is_active: boolean;
}

const OPERATION_TYPES = [
  { value: "bulldozer", labelEs: "Bulldozer", labelEn: "Bulldozer" },
  { value: "excavator", labelEs: "Excavadora", labelEn: "Excavator" },
  { value: "tractor", labelEs: "Tractor", labelEn: "Tractor" },
  { value: "backhoe", labelEs: "Retroexcavadora", labelEn: "Backhoe" },
  { value: "transportation", labelEs: "Transporte", labelEn: "Transportation" },
  { value: "other", labelEs: "Otro", labelEn: "Other" },
];

const UNIT_TYPES = [
  { value: "m3", labelEs: "m³ (metros cúbicos)", labelEn: "m³ (cubic meters)" },
  { value: "hours", labelEs: "Horas", labelEn: "Hours" },
  { value: "hectares", labelEs: "Hectáreas", labelEn: "Hectares" },
];

export function ContractDialog({ open, onOpenChange, contract }: ContractDialogProps) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      contract_name: "",
      owner_name: "",
      owner_cedula_rnc: "",
      bank: "",
      bank_account: "",
      operation_type: "bulldozer",
      operation_type_other: "",
      unit_type: "hours",
      price_per_unit: 0,
      farm_id: "",
      is_active: true,
    },
  });

  const { data: farms = [] } = useQuery({
    queryKey: ["farms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (contract) {
      form.reset({
        contract_name: contract.contract_name,
        owner_name: contract.owner_name,
        owner_cedula_rnc: contract.owner_cedula_rnc || "",
        bank: contract.bank || "",
        bank_account: contract.bank_account || "",
        operation_type: contract.operation_type,
        operation_type_other: contract.operation_type_other || "",
        unit_type: contract.unit_type,
        price_per_unit: contract.price_per_unit,
        farm_id: contract.farm_id || "",
        is_active: contract.is_active,
      });
    } else {
      form.reset({
        contract_name: "",
        owner_name: "",
        owner_cedula_rnc: "",
        bank: "",
        bank_account: "",
        operation_type: "bulldozer",
        operation_type_other: "",
        unit_type: "hours",
        price_per_unit: 0,
        farm_id: "",
        is_active: true,
      });
    }
  }, [contract, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        contract_name: data.contract_name,
        owner_name: data.owner_name,
        owner_cedula_rnc: data.owner_cedula_rnc || null,
        bank: data.bank || null,
        bank_account: data.bank_account || null,
        operation_type: data.operation_type,
        operation_type_other: data.operation_type === "other" ? data.operation_type_other : null,
        unit_type: data.unit_type,
        price_per_unit: data.price_per_unit,
        farm_id: data.farm_id || null,
        is_active: data.is_active,
      };

      if (contract) {
        const { error } = await supabase
          .from("service_contracts")
          .update(payload)
          .eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contracts"] });
      toast.success(contract ? t("contracts.updated") : t("contracts.created"));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("contracts.saveError"));
    },
  });

  const operationType = form.watch("operation_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contract ? t("contracts.editContract") : t("contracts.newContract")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="contract_name"
              rules={{ required: t("contracts.required") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contracts.contractName")} *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("contracts.contractNamePlaceholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="owner_name"
                rules={{ required: t("contracts.required") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.owner")} *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("contracts.ownerPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="owner_cedula_rnc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.cedulaRnc")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("contracts.cedulaRncPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.bank")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("contracts.bankPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bank_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.bankAccount")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("contracts.bankAccountPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="operation_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.operationType")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OPERATION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {language === "es" ? type.labelEs : type.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {operationType === "other" && (
                <FormField
                  control={form.control}
                  name="operation_type_other"
                  rules={{ required: operationType === "other" ? t("contracts.required") : false }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contracts.otherOperationType")} *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("contracts.otherPlaceholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="unit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.unitType")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {language === "es" ? type.labelEs : type.labelEn}
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
                name="price_per_unit"
                rules={{ required: t("contracts.required"), min: 0 }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.pricePerUnit")} *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
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
                name="farm_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.farm")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("contracts.selectFarm")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">{t("contracts.noFarm")}</SelectItem>
                        {farms.map((farm) => (
                          <SelectItem key={farm.id} value={farm.id}>
                            {farm.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">{t("contracts.activeContract")}</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
