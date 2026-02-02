import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { ContractEntry, ServiceContract } from "../ContractedServicesView";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface DailyEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ContractEntry | null;
  contracts: ServiceContract[];
}

interface LineItemForm {
  id?: string;
  description: string;
  amount: number;
}

interface FormData {
  contract_id: string;
  entry_date: string;
  description: string;
  comments: string;
  units_charged: number;
  use_override: boolean;
  cost_override: number;
  line_items: LineItemForm[];
}

const UNIT_LABELS: Record<string, { es: string; en: string }> = {
  m3: { es: "m³", en: "m³" },
  hours: { es: "horas", en: "hours" },
  hectares: { es: "hectáreas", en: "hectares" },
};

export function DailyEntryDialog({ open, onOpenChange, entry, contracts }: DailyEntryDialogProps) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [calculatedCost, setCalculatedCost] = useState(0);

  const form = useForm<FormData>({
    defaultValues: {
      contract_id: "",
      entry_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      comments: "",
      units_charged: 0,
      use_override: false,
      cost_override: 0,
      line_items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  const selectedContractId = form.watch("contract_id");
  const unitsCharged = form.watch("units_charged");
  const useOverride = form.watch("use_override");
  const lineItems = form.watch("line_items");

  const selectedContract = contracts.find((c) => c.id === selectedContractId);

  useEffect(() => {
    if (selectedContract && unitsCharged) {
      setCalculatedCost(selectedContract.price_per_unit * unitsCharged);
    } else {
      setCalculatedCost(0);
    }
  }, [selectedContract, unitsCharged]);

  useEffect(() => {
    if (entry) {
      form.reset({
        contract_id: entry.contract_id,
        entry_date: entry.entry_date,
        description: entry.description,
        comments: entry.comments || "",
        units_charged: entry.units_charged,
        use_override: entry.cost_override !== null,
        cost_override: entry.cost_override || 0,
        line_items: (entry.line_items || []).map((item) => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
        })),
      });
    } else {
      form.reset({
        contract_id: contracts[0]?.id || "",
        entry_date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        comments: "",
        units_charged: 0,
        use_override: false,
        cost_override: 0,
        line_items: [],
      });
    }
  }, [entry, contracts, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const entryPayload = {
        contract_id: data.contract_id,
        entry_date: data.entry_date,
        description: data.description,
        comments: data.comments || null,
        units_charged: data.units_charged,
        calculated_cost: calculatedCost,
        cost_override: data.use_override ? data.cost_override : null,
      };

      let entryId: string;

      if (entry) {
        const { error } = await supabase
          .from("service_contract_entries")
          .update(entryPayload)
          .eq("id", entry.id);
        if (error) throw error;
        entryId = entry.id;

        // Delete existing line items
        await supabase.from("service_contract_line_items").delete().eq("entry_id", entry.id);
      } else {
        const { data: newEntry, error } = await supabase
          .from("service_contract_entries")
          .insert(entryPayload)
          .select("id")
          .single();
        if (error) throw error;
        entryId = newEntry.id;
      }

      // Insert new line items
      if (data.line_items.length > 0) {
        const lineItemsPayload = data.line_items.map((item) => ({
          entry_id: entryId,
          description: item.description,
          amount: item.amount,
        }));
        const { error } = await supabase.from("service_contract_line_items").insert(lineItemsPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract-entries"] });
      toast.success(entry ? t("contracts.entryUpdated") : t("contracts.entryCreated"));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("contracts.entrySaveError"));
    },
  });

  const lineItemsTotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const baseCost = useOverride ? form.watch("cost_override") : calculatedCost;
  const totalCost = baseCost + lineItemsTotal;

  const unitLabel = selectedContract
    ? UNIT_LABELS[selectedContract.unit_type]?.[language] || selectedContract.unit_type
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? t("contracts.editEntry") : t("contracts.newEntry")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_id"
                rules={{ required: t("contracts.required") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("contracts.contract")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("contracts.selectContract")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contracts.map((contract) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.contract_name} - ${contract.price_per_unit}/{UNIT_LABELS[contract.unit_type]?.[language] || contract.unit_type}
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
                name="entry_date"
                rules={{ required: t("contracts.required") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.date")} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              rules={{ required: t("contracts.required") }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.description")} *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("contracts.descriptionPlaceholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.notes")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("contracts.commentsPlaceholder")} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="units_charged"
                rules={{ required: t("contracts.required"), min: 0 }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("contracts.unitsCharged")} {unitLabel && `(${unitLabel})`} *
                    </FormLabel>
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

              <div className="space-y-2">
                <FormLabel>{t("contracts.calculatedCost")}</FormLabel>
                <div className="h-10 px-3 py-2 border rounded-md bg-muted font-mono">
                  ${calculatedCost.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <FormField
                control={form.control}
                name="use_override"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("contracts.overrideCost")}</FormLabel>
                  </FormItem>
                )}
              />

              {useOverride && (
                <FormField
                  control={form.control}
                  name="cost_override"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contracts.manualCost")}</FormLabel>
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
              )}
            </div>

            {/* Line Items Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">{t("contracts.additionalItems")}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: "", amount: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("contracts.addLineItem")}
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                  <FormField
                    control={form.control}
                    name={`line_items.${index}.description`}
                    rules={{ required: t("contracts.required") }}
                    render={({ field }) => (
                      <FormItem>
                        {index === 0 && <FormLabel>{t("common.description")}</FormLabel>}
                        <FormControl>
                          <Input {...field} placeholder={t("contracts.lineItemDescPlaceholder")} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`line_items.${index}.amount`}
                    rules={{ required: t("contracts.required"), min: 0 }}
                    render={({ field }) => (
                      <FormItem>
                        {index === 0 && <FormLabel>{t("common.amount")}</FormLabel>}
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {fields.length > 0 && (
                <div className="text-right text-sm">
                  {t("contracts.lineItemsSubtotal")}: <span className="font-mono">${lineItemsTotal.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>{t("contracts.totalCost")}:</span>
                <span className="font-mono">${totalCost.toLocaleString()}</span>
              </div>
            </div>

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
