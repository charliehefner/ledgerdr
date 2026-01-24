import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

const POSITIONS = ["Obrero", "Supervisor", "Tractorista", "Gerencia", "Administrativa", "Volteador", "Sereno"] as const;

const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  cedula: z.string().min(1, "Cédula is required").max(20),
  position: z.enum(POSITIONS).default("Obrero"),
  bank: z.string().optional(),
  bank_account_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  date_of_hire: z.string().min(1, "Date of hire is required"),
  salary: z.coerce.number().min(0, "Salary must be positive"),
  boot_size: z.string().optional(),
  pant_size: z.string().optional(),
  shirt_size: z.string().optional(),
  is_active: z.boolean().default(true),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  employeeId: string | null;
  onComplete: () => void;
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

export function EmployeeForm({ employeeId, onComplete }: EmployeeFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!employeeId;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      cedula: "",
      position: "Obrero",
      bank: "",
      bank_account_number: "",
      date_of_birth: "",
      date_of_hire: "",
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
        .from("employees")
        .select("*")
        .eq("id", employeeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        name: employee.name,
        cedula: employee.cedula,
        position: (employee.position as typeof POSITIONS[number]) || "Obrero",
        bank: employee.bank || "",
        bank_account_number: employee.bank_account_number || "",
        date_of_birth: employee.date_of_birth || "",
        date_of_hire: employee.date_of_hire,
        salary: employee.salary,
        boot_size: employee.boot_size || "",
        pant_size: employee.pant_size || "",
        shirt_size: employee.shirt_size || "",
        is_active: employee.is_active,
      });
    }
  }, [employee, form]);

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

        // Log salary change if different
        if (employee && employee.salary !== data.salary) {
          await supabase.from("employee_salary_history").insert({
            employee_id: employeeId,
            salary: data.salary,
            effective_date: new Date().toISOString().split("T")[0],
            notes: `Salary updated from ${employee.salary} to ${data.salary}`,
          });
        }

        toast.success("Employee updated successfully");
      } else {
        const { data: newEmployee, error } = await supabase
          .from("employees")
          .insert(payload)
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            toast.error("An employee with this cédula already exists");
            return;
          }
          throw error;
        }

        // Create initial salary history entry
        await supabase.from("employee_salary_history").insert({
          employee_id: newEmployee.id,
          salary: data.salary,
          effective_date: data.date_of_hire,
          notes: "Initial salary",
        });

        toast.success("Employee created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["employees"] });
      form.reset();
      onComplete();
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error("Failed to save employee");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle>{isEditing ? "Edit Employee" : "Add New Employee"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
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
                      <FormLabel>Date of Birth</FormLabel>
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
                Employment Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select position" />
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
                      <FormLabel>Date of Hire *</FormLabel>
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
                      <FormLabel>Monthly Salary (DOP) *</FormLabel>
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
                      <FormLabel className="font-normal">Active Employee</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Banking Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Banking Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a bank" />
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
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Account number" {...field} />
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
                Uniform Sizes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="shirt_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shirt Size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
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
                      <FormLabel>Pant Size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
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
                      <FormLabel>Boot Size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
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

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onComplete}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? "Update Employee" : "Save Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
