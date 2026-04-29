import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Save } from "lucide-react";
import { EmployeeLoansSection } from "./EmployeeLoansSection";
import { ScanCedulaButton, CedulaOcrResult } from "./ScanCedulaButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntity } from "@/contexts/EntityContext";

const POSITIONS = ["Servicios Generales", "Supervisor", "Tractorista", "Gerencia", "Administrativa", "Volteador", "Sereno"] as const;

const employeeSchema = z.object({
  name: z.string().min(1, "required").max(200),
  cedula: z.string().min(1, "required").max(20),
  position: z.enum(POSITIONS).default("Servicios Generales"),
  sex: z.string().optional(),
  bank: z.string().optional(),
  bank_account_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  date_of_hire: z.string().min(1, "required"),
  date_of_termination: z.string().optional(),
  salary: z.coerce.number().min(0, "positive"),
  boot_size: z.string().optional(),
  pant_size: z.string().optional(),
  shirt_size: z.string().optional(),
  is_active: z.boolean().default(true),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeFormDialogProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const PANT_SIZES = ["28", "30", "32", "34", "36", "38", "40", "42", "44"];
const BOOT_SIZES = ["6", "7", "8", "9", "10", "11", "12", "13", "14"];

const BANKS = [
  "Banco Popular Dominicano",
  "Banco de Reservas",
  "Banco BHD León",
  "Scotiabank",
  "Banco Santa Cruz",
  "Banco Promerica",
  "Banco Caribe",
  "Asociación Popular",
  "Banco López de Haro",
  "Banco Vimenca",
];

export function EmployeeFormDialog({ employeeId, open, onOpenChange }: EmployeeFormDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { requireEntity } = useEntity();
  const isEditing = !!employeeId;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      cedula: "",
      position: "Servicios Generales",
      sex: "",
      bank: "",
      bank_account_number: "",
      date_of_birth: "",
      date_of_hire: "",
      date_of_termination: "",
      salary: 0,
      boot_size: "",
      pant_size: "",
      shirt_size: "",
      is_active: true,
    },
  });

  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees_safe")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        name: employee.name,
        cedula: employee.cedula,
        position: (POSITIONS.includes(employee.position as typeof POSITIONS[number]) ? employee.position : "Servicios Generales") as typeof POSITIONS[number],
        sex: (employee as any).sex || "",
        bank: employee.bank || "",
        bank_account_number: employee.bank_account_number || "",
        date_of_birth: employee.date_of_birth || "",
        date_of_hire: employee.date_of_hire,
        date_of_termination: (employee as any).date_of_termination || "",
        salary: employee.salary,
        boot_size: employee.boot_size || "",
        pant_size: employee.pant_size || "",
        shirt_size: employee.shirt_size || "",
        is_active: employee.is_active,
      });
    } else if (!employeeId) {
      form.reset({
        name: "",
        cedula: "",
        position: "Servicios Generales",
        sex: "",
        bank: "",
        bank_account_number: "",
        date_of_birth: "",
        date_of_hire: "",
        date_of_termination: "",
        salary: 0,
        boot_size: "",
        pant_size: "",
        shirt_size: "",
        is_active: true,
      });
    }
  }, [employee, employeeId, form]);

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      const entityId = ((employee as any)?.entity_id as string | undefined) ?? requireEntity();
      if (!entityId) return;

      const payload = {
        name: data.name,
        cedula: data.cedula,
        position: data.position,
        sex: data.sex || null,
        bank: data.bank || null,
        bank_account_number: data.bank_account_number || null,
        date_of_birth: data.date_of_birth || null,
        date_of_hire: data.date_of_hire,
        date_of_termination: data.is_active ? null : (data.date_of_termination || new Date().toISOString().split("T")[0]),
        salary: data.salary,
        boot_size: data.boot_size || null,
        pant_size: data.pant_size || null,
        shirt_size: data.shirt_size || null,
        is_active: data.is_active,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", employeeId);

        if (error) throw error;

        if (employee && employee.salary !== data.salary) {
          await supabase.from("employee_salary_history").insert({
            employee_id: employeeId,
            entity_id: entityId,
            salary: data.salary,
            effective_date: new Date().toISOString().split("T")[0],
            notes: `Salario actualizado de ${employee.salary} a ${data.salary}`,
          });
        }

        // Deactivate open loans when employee is terminated
        if (!data.is_active && employee?.is_active) {
          await supabase
            .from("employee_loans")
            .update({ is_active: false })
            .eq("employee_id", employeeId)
            .eq("is_active", true);
        }

        toast.success(t("empForm.employeeUpdated"));
      } else {
        const { data: newEmployee, error } = await supabase
          .from("employees")
          .insert({ ...payload, entity_id: entityId })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            toast.error(t("empForm.duplicateCedula"));
            return;
          }
          throw error;
        }

        await supabase.from("employee_salary_history").insert({
          employee_id: newEmployee.id,
          entity_id: entityId,
          salary: data.salary,
          effective_date: data.date_of_hire,
          notes: "Salario inicial",
        });

        toast.success(t("empForm.employeeCreated"));
      }

      queryClient.invalidateQueries({ queryKey: ["employees"] });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error(t("empForm.saveError"));
    }
  };

  const handleCedulaScan = (result: CedulaOcrResult) => {
    if (result.name) form.setValue("name", result.name);
    if (result.cedula) form.setValue("cedula", result.cedula);
    if (result.date_of_birth) form.setValue("date_of_birth", result.date_of_birth);
    if (result.sex) form.setValue("sex", result.sex);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {isEditing ? t("empForm.editEmployee") : t("empForm.addNewEmployee")}
            </DialogTitle>
            {!isEditing && <ScanCedulaButton onResult={handleCedulaScan} />}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("empForm.personalInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.fullName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cedula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.cedula")}</FormLabel>
                      <FormControl>
                        <Input placeholder="001-0000000-0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.dateOfBirth")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.sex")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("empForm.selectSex")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M">{t("empForm.male")}</SelectItem>
                          <SelectItem value="F">{t("empForm.female")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("empForm.employmentInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.position")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("empForm.selectPosition")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {POSITIONS.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {pos}
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
                  name="date_of_hire"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.dateOfHire")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.monthlySalary")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-6">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked && !form.getValues("date_of_termination")) {
                              form.setValue("date_of_termination", new Date().toISOString().split("T")[0]);
                            }
                            if (checked) {
                              form.setValue("date_of_termination", "");
                            }
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{t("empForm.activeEmployee")}</FormLabel>
                    </FormItem>
                  )}
                />

                {!form.watch("is_active") && (
                  <FormField
                    control={form.control}
                    name="date_of_termination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("empForm.terminationDate")}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Banking Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("empForm.bankingInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.bank")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("empForm.selectBank")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BANKS.map((bank) => (
                            <SelectItem key={bank} value={bank}>
                              {bank}
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
                  name="bank_account_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.accountNumber")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("empForm.accountNumber")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Uniform Sizes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("empForm.uniformSizes")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="shirt_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.shirtSize")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("empForm.selectSize")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SHIRT_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
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
                  name="pant_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.pantSize")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("empForm.selectSize")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PANT_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
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
                  name="boot_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("empForm.bootSize")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("empForm.selectSize")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BOOT_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? t("empForm.updateEmployee") : t("empForm.saveEmployee")}
              </Button>
            </div>
          </form>
        </Form>

        {/* Loans section - only shown when editing */}
        {isEditing && employeeId && (
          <div className="mt-6 pt-6 border-t">
            <EmployeeLoansSection employeeId={employeeId} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}