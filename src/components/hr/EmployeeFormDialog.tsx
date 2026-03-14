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

const POSITIONS = ["Servicios Generales", "Supervisor", "Tractorista", "Gerencia", "Administrativa", "Volteador", "Sereno"] as const;

const employeeSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  cedula: z.string().min(1, "La cédula es requerida").max(20),
  position: z.enum(POSITIONS).default("Servicios Generales"),
  bank: z.string().optional(),
  bank_account_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  date_of_hire: z.string().min(1, "La fecha de ingreso es requerida"),
  date_of_termination: z.string().optional(),
  salary: z.coerce.number().min(0, "El salario debe ser positivo"),
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
  const isEditing = !!employeeId;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      cedula: "",
      position: "Servicios Generales",
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
      const payload = {
        name: data.name,
        cedula: data.cedula,
        position: data.position,
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
            salary: data.salary,
            effective_date: new Date().toISOString().split("T")[0],
            notes: `Salario actualizado de ${employee.salary} a ${data.salary}`,
          });
        }

        toast.success("Empleado actualizado exitosamente");
      } else {
        const { data: newEmployee, error } = await supabase
          .from("employees")
          .insert(payload)
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            toast.error("Ya existe un empleado con esta cédula");
            return;
          }
          throw error;
        }

        await supabase.from("employee_salary_history").insert({
          employee_id: newEmployee.id,
          salary: data.salary,
          effective_date: data.date_of_hire,
          notes: "Salario inicial",
        });

        toast.success("Empleado creado exitosamente");
      }

      queryClient.invalidateQueries({ queryKey: ["employees"] });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error("Error al guardar empleado");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Empleado" : "Agregar Nuevo Empleado"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Información Personal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo *</FormLabel>
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
                      <FormLabel>Cédula *</FormLabel>
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
                      <FormLabel>Fecha de Nacimiento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Información Laboral
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Posición *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar posición" />
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
                      <FormLabel>Fecha de Ingreso *</FormLabel>
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
                      <FormLabel>Salario Mensual (DOP) *</FormLabel>
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
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Empleado Activo</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Banking Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Información Bancaria
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar banco" />
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
                      <FormLabel>Número de Cuenta</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de cuenta" {...field} />
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
                Tallas de Uniforme
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="shirt_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Talla de Camisa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar talla" />
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
                      <FormLabel>Talla de Pantalón</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar talla" />
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
                      <FormLabel>Talla de Botas</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar talla" />
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
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? "Actualizar Empleado" : "Guardar Empleado"}
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
