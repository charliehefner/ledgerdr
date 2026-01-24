import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarIcon, Tractor, Users, MapPin, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface Field {
  id: string;
  name: string;
  hectares: number | null;
  farm_id: string;
  farms: { name: string };
}

interface OperationType {
  id: string;
  name: string;
  is_mechanical: boolean;
}

interface Tractor {
  id: string;
  name: string;
}

interface Implement {
  id: string;
  name: string;
  implement_type: string;
}

interface Operation {
  id: string;
  operation_date: string;
  field_id: string;
  operation_type_id: string;
  tractor_id: string | null;
  implement_id: string | null;
  workers_count: number | null;
  hectares_done: number;
  notes: string | null;
  fields: { name: string; farms: { name: string } };
  operation_types: { name: string; is_mechanical: boolean };
  fuel_equipment: { name: string } | null;
  implements: { name: string } | null;
}

export default function Operations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [form, setForm] = useState({
    operation_date: new Date(),
    field_id: "",
    operation_type_id: "",
    tractor_id: "",
    implement_id: "",
    workers_count: "",
    hectares_done: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch fields with farm names
  const { data: fields } = useQuery({
    queryKey: ["fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("*, farms(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Field[];
    },
  });

  // Fetch operation types
  const { data: operationTypes } = useQuery({
    queryKey: ["operationTypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_types")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as OperationType[];
    },
  });

  // Fetch tractors
  const { data: tractors } = useQuery({
    queryKey: ["tractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Tractor[];
    },
  });

  // Fetch implements
  const { data: implements_ } = useQuery({
    queryKey: ["implements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implements")
        .select("id, name, implement_type")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Implement[];
    },
  });

  // Fetch operations
  const { data: operations, isLoading } = useQuery({
    queryKey: ["operations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select(`
          *,
          fields(name, farms(name)),
          operation_types(name, is_mechanical),
          fuel_equipment(name),
          implements(name)
        `)
        .order("operation_date", { ascending: false });
      if (error) throw error;
      return data as Operation[];
    },
  });

  const selectedOperationType = operationTypes?.find(t => t.id === form.operation_type_id);
  const isMechanical = selectedOperationType?.is_mechanical ?? true;

  // Filter operations by date range
  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    return operations.filter((op) => {
      const opDate = new Date(op.operation_date);
      if (startDate && endDate) {
        return isWithinInterval(opDate, {
          start: startOfDay(startDate),
          end: endOfDay(endDate),
        });
      }
      return true;
    });
  }, [operations, startDate, endDate]);

  // Stats
  const totalHectares = filteredOperations.reduce((sum, op) => sum + op.hectares_done, 0);
  const mechanicalCount = filteredOperations.filter(op => op.operation_types.is_mechanical).length;
  const manualCount = filteredOperations.filter(op => !op.operation_types.is_mechanical).length;

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record = {
        operation_date: format(data.operation_date, "yyyy-MM-dd"),
        field_id: data.field_id,
        operation_type_id: data.operation_type_id,
        tractor_id: isMechanical && data.tractor_id ? data.tractor_id : null,
        implement_id: isMechanical && data.implement_id ? data.implement_id : null,
        workers_count: !isMechanical && data.workers_count ? parseInt(data.workers_count) : null,
        hectares_done: parseFloat(data.hectares_done),
        notes: data.notes || null,
      };

      const { error } = await supabase.from("operations").insert(record);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({
        title: "Operation recorded",
        description: "The field operation has been logged successfully.",
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setForm({
      operation_date: new Date(),
      field_id: "",
      operation_type_id: "",
      tractor_id: "",
      implement_id: "",
      workers_count: "",
      hectares_done: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.field_id || !form.operation_type_id || !form.hectares_done) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (isMechanical && (!form.tractor_id || !form.implement_id)) {
      toast({
        title: "Validation Error",
        description: "Mechanical operations require tractor and implement.",
        variant: "destructive",
      });
      return;
    }
    if (!isMechanical && !form.workers_count) {
      toast({
        title: "Validation Error",
        description: "Manual operations require worker count.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Operations</h1>
          <p className="text-muted-foreground">
            Track field operations across farms
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hectares</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHectares.toFixed(1)} ha</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operations</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredOperations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mechanical</CardTitle>
              <Tractor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mechanicalCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manual</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{manualCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="ml-auto">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Operation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Record Field Operation</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !form.operation_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.operation_date ? format(form.operation_date, "MMM d, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.operation_date}
                            onSelect={(date) => date && setForm({ ...form, operation_date: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Field *</Label>
                      <Select
                        value={form.field_id}
                        onValueChange={(value) => setForm({ ...form, field_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields?.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name} ({field.farms.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Operation Type *</Label>
                    <Select
                      value={form.operation_type_id}
                      onValueChange={(value) => setForm({ ...form, operation_type_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select operation" />
                      </SelectTrigger>
                      <SelectContent>
                        {operationTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} {type.is_mechanical ? "(Mechanical)" : "(Manual)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isMechanical ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tractor *</Label>
                        <Select
                          value={form.tractor_id}
                          onValueChange={(value) => setForm({ ...form, tractor_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tractor" />
                          </SelectTrigger>
                          <SelectContent>
                            {tractors?.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Implement *</Label>
                        <Select
                          value={form.implement_id}
                          onValueChange={(value) => setForm({ ...form, implement_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select implement" />
                          </SelectTrigger>
                          <SelectContent>
                            {implements_?.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label>Number of Workers *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.workers_count}
                        onChange={(e) => setForm({ ...form, workers_count: e.target.value })}
                        placeholder="Enter worker count"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Hectares Done *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.hectares_done}
                      onChange={(e) => setForm({ ...form, hectares_done: e.target.value })}
                      placeholder="Enter hectares"
                    />
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? "Saving..." : "Record Operation"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Operations Table */}
        {isLoading ? (
          <div className="text-center py-8">Loading operations...</div>
        ) : filteredOperations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No operations found for the selected period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Farm</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Tractor/Workers</TableHead>
                <TableHead>Implement</TableHead>
                <TableHead>Hectares</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOperations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>{format(new Date(op.operation_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{op.fields.name}</TableCell>
                  <TableCell>{op.fields.farms.name}</TableCell>
                  <TableCell>
                    <Badge variant={op.operation_types.is_mechanical ? "default" : "secondary"}>
                      {op.operation_types.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {op.operation_types.is_mechanical
                      ? op.fuel_equipment?.name || "-"
                      : `${op.workers_count} workers`}
                  </TableCell>
                  <TableCell>{op.implements?.name || "-"}</TableCell>
                  <TableCell className="font-medium">{op.hectares_done} ha</TableCell>
                  <TableCell className="text-muted-foreground">{op.notes || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </MainLayout>
  );
}
