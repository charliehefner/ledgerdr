import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, CalendarIcon, Tractor, Users, MapPin, Activity, Trash2, Package, Clock, MoreHorizontal, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ColumnSelector } from "@/components/ui/column-selector";
import { useColumnVisibility, ColumnConfig } from "@/hooks/useColumnVisibility";

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

interface TractorEquipment {
  id: string;
  name: string;
}

interface Implement {
  id: string;
  name: string;
  implement_type: string;
}

interface InventoryItem {
  id: string;
  commercial_name: string;
  use_unit: string;
  current_quantity: number;
  function: string;
}

interface OperationInput {
  inventory_item_id: string;
  quantity_used: number;
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
  start_hours: number | null;
  end_hours: number | null;
  notes: string | null;
  fields: { name: string; farms: { name: string } };
  operation_types: { name: string; is_mechanical: boolean };
  fuel_equipment: { name: string } | null;
  implements: { name: string } | null;
  operation_inputs: { 
    id: string;
    quantity_used: number; 
    inventory_items: { commercial_name: string; use_unit: string } 
  }[];
}

const operationsColumns: ColumnConfig[] = [
  { key: "date", label: "Fecha", defaultVisible: true },
  { key: "field", label: "Campo", defaultVisible: true },
  { key: "farm", label: "Finca", defaultVisible: true },
  { key: "operation", label: "Operación", defaultVisible: true },
  { key: "tractor", label: "Tractor/Obreros", defaultVisible: true },
  { key: "implement", label: "Implemento", defaultVisible: true },
  { key: "hours", label: "Horas", defaultVisible: true },
  { key: "hectares", label: "Hectáreas", defaultVisible: true },
  { key: "inputs", label: "Insumos", defaultVisible: true },
  { key: "notes", label: "Notas", defaultVisible: false },
];

type SortDirection = "asc" | "desc" | null;
type SortColumn = "date" | "field" | "farm" | "operation" | "tractor" | "implement" | "hours" | "hectares" | null;

export function OperationsLogView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [deleteOperationId, setDeleteOperationId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "management" || user?.role === "supervisor";
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [form, setForm] = useState({
    operation_date: new Date(),
    field_id: "",
    operation_type_id: "",
    tractor_id: "",
    implement_id: "",
    start_hours: "",
    end_hours: "",
    workers_count: "",
    hectares_done: "",
    notes: "",
  });
  const [inputs, setInputs] = useState<OperationInput[]>([]);
  const [newInput, setNewInput] = useState({ inventory_item_id: "", quantity_used: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    visibility,
    toggleColumn,
    resetToDefaults,
    isVisible,
    allColumns,
  } = useColumnVisibility("operations-log", operationsColumns);

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
      return data as TractorEquipment[];
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

  // Fetch inventory items
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, use_unit, current_quantity, function")
        .eq("is_active", true)
        .order("commercial_name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Fetch operations with inputs
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
          implements(name),
          operation_inputs(id, quantity_used, inventory_items(commercial_name, use_unit))
        `)
        .order("operation_date", { ascending: false });
      if (error) throw error;
      return data as Operation[];
    },
  });

  const selectedOperationType = operationTypes?.find(t => t.id === form.operation_type_id);
  const isMechanical = selectedOperationType?.is_mechanical ?? true;

  // Calculate hours helper
  const calculateHoursValue = (op: Operation): number => {
    if (op.start_hours != null && op.end_hours != null) {
      return op.end_hours - op.start_hours;
    }
    return 0;
  };

  // Sorting helper
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    if (sortDirection === "asc") return <ArrowUp className="ml-2 h-4 w-4" />;
    if (sortDirection === "desc") return <ArrowDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  // Filter and sort operations
  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    let result = operations.filter((op) => {
      const opDate = new Date(op.operation_date);
      if (startDate && endDate) {
        return isWithinInterval(opDate, {
          start: startOfDay(startDate),
          end: endOfDay(endDate),
        });
      }
      return true;
    });

    // Apply sorting
    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        switch (sortColumn) {
          case "date":
            comparison = new Date(a.operation_date).getTime() - new Date(b.operation_date).getTime();
            break;
          case "field":
            comparison = a.fields.name.localeCompare(b.fields.name);
            break;
          case "farm":
            comparison = a.fields.farms.name.localeCompare(b.fields.farms.name);
            break;
          case "operation":
            comparison = a.operation_types.name.localeCompare(b.operation_types.name);
            break;
          case "tractor":
            const aVal = a.operation_types.is_mechanical ? (a.fuel_equipment?.name || "") : String(a.workers_count || 0);
            const bVal = b.operation_types.is_mechanical ? (b.fuel_equipment?.name || "") : String(b.workers_count || 0);
            comparison = aVal.localeCompare(bVal);
            break;
          case "implement":
            comparison = (a.implements?.name || "").localeCompare(b.implements?.name || "");
            break;
          case "hours":
            comparison = calculateHoursValue(a) - calculateHoursValue(b);
            break;
          case "hectares":
            comparison = a.hectares_done - b.hectares_done;
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [operations, startDate, endDate, sortColumn, sortDirection]);

  // Top 5 operations by hectares
  const top5Operations = useMemo(() => {
    const operationHectares: Record<string, { name: string; hectares: number }> = {};
    
    filteredOperations.forEach((op) => {
      const opName = op.operation_types.name;
      if (!operationHectares[opName]) {
        operationHectares[opName] = { name: opName, hectares: 0 };
      }
      operationHectares[opName].hectares += op.hectares_done;
    });
    
    return Object.values(operationHectares)
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 5);
  }, [filteredOperations]);

  const addInput = () => {
    if (!newInput.inventory_item_id || !newInput.quantity_used) {
      toast({
        title: "Error de Validación",
        description: "Seleccione un artículo e ingrese la cantidad.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if item already added
    if (inputs.some(i => i.inventory_item_id === newInput.inventory_item_id)) {
      toast({
        title: "Artículo Duplicado",
        description: "Este artículo ya está agregado. Actualice la cantidad.",
        variant: "destructive",
      });
      return;
    }

    const item = inventoryItems?.find(i => i.id === newInput.inventory_item_id);
    const qty = parseFloat(newInput.quantity_used);
    
    if (item && qty > item.current_quantity) {
      toast({
        title: "Stock Insuficiente",
        description: `Solo ${item.current_quantity} ${item.use_unit} disponibles.`,
        variant: "destructive",
      });
      return;
    }

    setInputs([...inputs, { 
      inventory_item_id: newInput.inventory_item_id, 
      quantity_used: qty 
    }]);
    setNewInput({ inventory_item_id: "", quantity_used: "" });
  };

  const removeInput = (itemId: string) => {
    setInputs(inputs.filter(i => i.inventory_item_id !== itemId));
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record = {
        operation_date: format(data.operation_date, "yyyy-MM-dd"),
        field_id: data.field_id,
        operation_type_id: data.operation_type_id,
        tractor_id: isMechanical && data.tractor_id ? data.tractor_id : null,
        implement_id: isMechanical && data.implement_id ? data.implement_id : null,
        start_hours: isMechanical && data.start_hours ? parseFloat(data.start_hours) : null,
        end_hours: isMechanical && data.end_hours ? parseFloat(data.end_hours) : null,
        workers_count: !isMechanical && data.workers_count ? parseInt(data.workers_count) : null,
        hectares_done: parseFloat(data.hectares_done),
        notes: data.notes || null,
      };

      // Insert operation
      const { data: operation, error: opError } = await supabase
        .from("operations")
        .insert(record)
        .select("id")
        .single();
      
      if (opError) throw opError;

      // Insert inputs and deduct from inventory
      if (inputs.length > 0) {
        const inputRecords = inputs.map(input => ({
          operation_id: operation.id,
          inventory_item_id: input.inventory_item_id,
          quantity_used: input.quantity_used,
        }));

        const { error: inputError } = await supabase
          .from("operation_inputs")
          .insert(inputRecords);
        
        if (inputError) throw inputError;

        // Deduct from inventory
        for (const input of inputs) {
          const item = inventoryItems?.find(i => i.id === input.inventory_item_id);
          if (item) {
            const newQuantity = item.current_quantity - input.quantity_used;
            const { error: updateError } = await supabase
              .from("inventory_items")
              .update({ current_quantity: newQuantity })
              .eq("id", input.inventory_item_id);
            
            if (updateError) throw updateError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      toast({
        title: "Operación registrada",
        description: "La operación de campo ha sido registrada y el inventario actualizado.",
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ operationId, data }: { operationId: string; data: typeof form }) => {
      const record = {
        operation_date: format(data.operation_date, "yyyy-MM-dd"),
        field_id: data.field_id,
        operation_type_id: data.operation_type_id,
        tractor_id: isMechanical && data.tractor_id ? data.tractor_id : null,
        implement_id: isMechanical && data.implement_id ? data.implement_id : null,
        start_hours: isMechanical && data.start_hours ? parseFloat(data.start_hours) : null,
        end_hours: isMechanical && data.end_hours ? parseFloat(data.end_hours) : null,
        workers_count: !isMechanical && data.workers_count ? parseInt(data.workers_count) : null,
        hectares_done: parseFloat(data.hectares_done),
        notes: data.notes || null,
      };

      const { error: updateError } = await supabase
        .from("operations")
        .update(record)
        .eq("id", operationId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      toast({
        title: "Operación actualizada",
        description: "La operación ha sido actualizada correctamente.",
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (operationId: string) => {
      // First restore inventory quantities from operation_inputs
      const { data: inputs, error: inputsError } = await supabase
        .from("operation_inputs")
        .select("inventory_item_id, quantity_used")
        .eq("operation_id", operationId);
      
      if (inputsError) throw inputsError;

      // Restore inventory
      if (inputs && inputs.length > 0) {
        for (const input of inputs) {
          const item = inventoryItems?.find(i => i.id === input.inventory_item_id);
          if (item) {
            const newQuantity = item.current_quantity + input.quantity_used;
            const { error: updateError } = await supabase
              .from("inventory_items")
              .update({ current_quantity: newQuantity })
              .eq("id", input.inventory_item_id);
            
            if (updateError) throw updateError;
          }
        }
      }

      // Delete operation_inputs
      const { error: deleteInputsError } = await supabase
        .from("operation_inputs")
        .delete()
        .eq("operation_id", operationId);
      
      if (deleteInputsError) throw deleteInputsError;

      // Delete operation
      const { error: deleteError } = await supabase
        .from("operations")
        .delete()
        .eq("id", operationId);
      
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      toast({
        title: "Operación eliminada",
        description: "La operación ha sido eliminada y el inventario restaurado.",
      });
      setDeleteOperationId(null);
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
    setEditingOperation(null);
    setForm({
      operation_date: new Date(),
      field_id: "",
      operation_type_id: "",
      tractor_id: "",
      implement_id: "",
      start_hours: "",
      end_hours: "",
      workers_count: "",
      hectares_done: "",
      notes: "",
    });
    setInputs([]);
    setNewInput({ inventory_item_id: "", quantity_used: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.field_id || !form.operation_type_id || !form.hectares_done) {
      toast({
        title: "Error de Validación",
        description: "Complete todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }
    if (isMechanical && (!form.tractor_id || !form.implement_id)) {
      toast({
        title: "Error de Validación",
        description: "Las operaciones mecánicas requieren tractor e implemento.",
        variant: "destructive",
      });
      return;
    }
    if (!isMechanical && !form.workers_count) {
      toast({
        title: "Error de Validación",
        description: "Las operaciones manuales requieren cantidad de obreros.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingOperation) {
      updateMutation.mutate({ operationId: editingOperation.id, data: form });
    } else {
      mutation.mutate(form);
    }
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems?.find(i => i.id === itemId);
    return item ? `${item.commercial_name} (${item.use_unit})` : itemId;
  };

  const calculateHours = (op: Operation) => {
    if (op.start_hours != null && op.end_hours != null) {
      return (op.end_hours - op.start_hours).toFixed(1);
    }
    return "-";
  };

  return (
    <div className="space-y-6">
      {/* Top 5 Operations by Hectares */}
      <Card className="w-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Top 5 Operaciones por Hectáreas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {top5Operations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay operaciones en este período</p>
          ) : (
            <Table className="w-auto">
              <TableBody>
                {top5Operations.map((op) => (
                  <TableRow key={op.name}>
                    <TableCell className="font-medium py-2 whitespace-nowrap">
                      Hectáreas {op.name}:
                    </TableCell>
                    <TableCell className="text-right font-mono py-2 whitespace-nowrap">
                      {op.hectares.toFixed(1)} ha
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Filters and Add Button */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM d, yyyy") : "Fecha inicio"}
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
          <span className="text-muted-foreground">a</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM d, yyyy") : "Fecha fin"}
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

        <div className="ml-auto flex items-center gap-2">
          <ColumnSelector
            columns={allColumns}
            visibility={visibility}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Operación
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOperation ? "Editar Operación de Campo" : "Registrar Operación de Campo"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fecha *</Label>
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
                          {form.operation_date ? format(form.operation_date, "MMM d, yyyy") : "Seleccionar fecha"}
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
                    <Label>Campo *</Label>
                    <Select
                      value={form.field_id}
                      onValueChange={(value) => setForm({ ...form, field_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar campo" />
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
                  <Label>Tipo de Operación *</Label>
                  <Select
                    value={form.operation_type_id}
                    onValueChange={(value) => setForm({ ...form, operation_type_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar operación" />
                    </SelectTrigger>
                    <SelectContent>
                      {operationTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} {type.is_mechanical ? "(Mecánica)" : "(Manual)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isMechanical ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tractor *</Label>
                        <Select
                          value={form.tractor_id}
                          onValueChange={(value) => setForm({ ...form, tractor_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tractor" />
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
                        <Label>Implemento *</Label>
                        <Select
                          value={form.implement_id}
                          onValueChange={(value) => setForm({ ...form, implement_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar implemento" />
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
                    
                    {/* Tractor Hours - positioned directly below tractor/implement */}
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-3">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Horómetro Inicio
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.start_hours}
                          onChange={(e) => setForm({ ...form, start_hours: e.target.value })}
                          placeholder="ej. 1250.5"
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Horómetro Fin
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.end_hours}
                          onChange={(e) => setForm({ ...form, end_hours: e.target.value })}
                          placeholder="ej. 1258.0"
                        />
                      </div>
                      {form.start_hours && form.end_hours && (
                        <div className="col-span-2 text-sm text-muted-foreground">
                          Horas trabajadas: <span className="font-semibold text-foreground">
                            {(parseFloat(form.end_hours) - parseFloat(form.start_hours)).toFixed(1)} hrs
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <Label>Número de Obreros *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.workers_count}
                      onChange={(e) => setForm({ ...form, workers_count: e.target.value })}
                      placeholder="Ingrese cantidad de obreros"
                    />
                  </div>
                )}

                <div>
                  <Label>Hectáreas Realizadas *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.hectares_done}
                    onChange={(e) => setForm({ ...form, hectares_done: e.target.value })}
                    placeholder="Ingrese hectáreas"
                  />
                </div>

                {/* Inputs Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-semibold">Insumos Utilizados (Opcional)</Label>
                  </div>
                  
                  <div className="flex gap-2">
                    <Select
                      value={newInput.inventory_item_id}
                      onValueChange={(value) => setNewInput({ ...newInput, inventory_item_id: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar insumo" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.commercial_name} ({item.current_quantity} {item.use_unit} disponibles)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Cant."
                      className="w-24"
                      value={newInput.quantity_used}
                      onChange={(e) => setNewInput({ ...newInput, quantity_used: e.target.value })}
                    />
                    <Button type="button" variant="secondary" onClick={addInput}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {inputs.length > 0 && (
                    <div className="space-y-2">
                      {inputs.map((input) => {
                        const item = inventoryItems?.find(i => i.id === input.inventory_item_id);
                        return (
                          <div key={input.inventory_item_id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                            <span className="text-sm">
                              {item?.commercial_name} - {input.quantity_used} {item?.use_unit}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeInput(input.inventory_item_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Notas</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Notas opcionales"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={mutation.isPending || updateMutation.isPending}>
                    {(mutation.isPending || updateMutation.isPending) 
                      ? "Guardando..." 
                      : editingOperation 
                        ? "Actualizar Operación" 
                        : "Registrar Operación"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Operations Table */}
      {isLoading ? (
        <div className="text-center py-8">Cargando operaciones...</div>
      ) : filteredOperations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron operaciones para el período seleccionado.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible("date") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center">
                    Fecha
                    {getSortIcon("date")}
                  </div>
                </TableHead>
              )}
              {isVisible("field") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("field")}
                >
                  <div className="flex items-center">
                    Campo
                    {getSortIcon("field")}
                  </div>
                </TableHead>
              )}
              {isVisible("farm") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("farm")}
                >
                  <div className="flex items-center">
                    Finca
                    {getSortIcon("farm")}
                  </div>
                </TableHead>
              )}
              {isVisible("operation") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("operation")}
                >
                  <div className="flex items-center">
                    Operación
                    {getSortIcon("operation")}
                  </div>
                </TableHead>
              )}
              {isVisible("tractor") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("tractor")}
                >
                  <div className="flex items-center">
                    Tractor/Obreros
                    {getSortIcon("tractor")}
                  </div>
                </TableHead>
              )}
              {isVisible("implement") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("implement")}
                >
                  <div className="flex items-center">
                    Implemento
                    {getSortIcon("implement")}
                  </div>
                </TableHead>
              )}
              {isVisible("hours") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("hours")}
                >
                  <div className="flex items-center">
                    Horas
                    {getSortIcon("hours")}
                  </div>
                </TableHead>
              )}
              {isVisible("hectares") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("hectares")}
                >
                  <div className="flex items-center">
                    Hectáreas
                    {getSortIcon("hectares")}
                  </div>
                </TableHead>
              )}
              {isVisible("inputs") && <TableHead>Insumos</TableHead>}
              {isVisible("notes") && <TableHead>Notas</TableHead>}
              {canEdit && <TableHead className="w-[70px] text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOperations.map((op) => (
              <TableRow key={op.id}>
                {isVisible("date") && <TableCell>{format(new Date(op.operation_date), "MMM d, yyyy")}</TableCell>}
                {isVisible("field") && <TableCell className="font-medium">{op.fields.name}</TableCell>}
                {isVisible("farm") && <TableCell>{op.fields.farms.name}</TableCell>}
                {isVisible("operation") && (
                  <TableCell>
                    <Badge variant={op.operation_types.is_mechanical ? "default" : "secondary"}>
                      {op.operation_types.name}
                    </Badge>
                  </TableCell>
                )}
                {isVisible("tractor") && (
                  <TableCell>
                    {op.operation_types.is_mechanical
                      ? op.fuel_equipment?.name || "-"
                      : `${op.workers_count} obreros`}
                  </TableCell>
                )}
                {isVisible("implement") && <TableCell>{op.implements?.name || "-"}</TableCell>}
                {isVisible("hours") && (
                  <TableCell className="font-mono">
                    {calculateHours(op)} {calculateHours(op) !== "-" && "hrs"}
                  </TableCell>
                )}
                {isVisible("hectares") && <TableCell className="font-medium">{op.hectares_done} ha</TableCell>}
                {isVisible("inputs") && (
                  <TableCell>
                    {op.operation_inputs && op.operation_inputs.length > 0 ? (
                      <div className="space-y-1">
                        {op.operation_inputs.map((input) => (
                          <div key={input.id} className="text-xs">
                            {input.inventory_items.commercial_name}: {input.quantity_used} {input.inventory_items.use_unit}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                {isVisible("notes") && <TableCell className="text-muted-foreground">{op.notes || "-"}</TableCell>}
                {canEdit && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 px-2">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingOperation(op);
                          setForm({
                            operation_date: new Date(op.operation_date),
                            field_id: op.field_id,
                            operation_type_id: op.operation_type_id,
                            tractor_id: op.tractor_id || "",
                            implement_id: op.implement_id || "",
                            start_hours: op.start_hours?.toString() || "",
                            end_hours: op.end_hours?.toString() || "",
                            workers_count: op.workers_count?.toString() || "",
                            hectares_done: op.hectares_done.toString(),
                            notes: op.notes || "",
                          });
                          setIsDialogOpen(true);
                        }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteOperationId(op.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOperationId} onOpenChange={(open) => !open && setDeleteOperationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar operación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la operación y restaurará las cantidades de inventario utilizadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOperationId && deleteMutation.mutate(deleteOperationId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
