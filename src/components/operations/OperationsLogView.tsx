import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateLocal, parseDateLocal } from "@/lib/dateUtils";
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
import { 
  Plus, CalendarIcon, Users, MapPin, Activity, Trash2, Package, 
  MoreHorizontal, Pencil, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, 
  FileSpreadsheet, FileText, Download, ChevronDown 
} from "lucide-react";
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
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useLanguage } from "@/contexts/LanguageContext";

// Import extracted modules
import { 
  Field, OperationType, TractorEquipment, MaintenanceRecord, 
  Implement, InventoryItem, OperationInput, Operation, 
  SortDirection, SortColumn 
} from "./types";
import { operationsColumns } from "./constants";
import { 
  calculateHoursValue, calculateHoursDisplay, 
  checkMaintenanceOverdue, checkHourMeterGap, isMissingClosingData 
} from "./utils";
import { useOperationsExport } from "./useOperationsExport";
import { scheduleFollowUp } from "@/lib/scheduleFollowUp";

export function OperationsLogView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [deleteOperationId, setDeleteOperationId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { user } = useAuth();
  const { t } = useLanguage();
  const canEdit = user?.role === "admin" || user?.role === "management" || user?.role === "supervisor";
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  
  // Filter states
  const [filterFarm, setFilterFarm] = useState<string>("");
  const [filterField, setFilterField] = useState<string>("");
  const [filterTractor, setFilterTractor] = useState<string>("");
  const [filterOperationType, setFilterOperationType] = useState<string>("");
  
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
    driver: "",
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
        .select("id, name, current_hour_meter, maintenance_interval_hours")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as TractorEquipment[];
    },
  });

  // Fetch latest maintenance for each tractor
  const { data: tractorMaintenanceData = new Map<string, number>() } = useQuery({
    queryKey: ["tractors-maintenance-operations"],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("tractor_maintenance")
        .select("tractor_id, hour_meter_reading")
        .order("hour_meter_reading", { ascending: false });
      if (error) throw error;
      
      const latestByTractor = new Map<string, number>();
      (data as MaintenanceRecord[]).forEach((m) => {
        if (!latestByTractor.has(m.tractor_id)) {
          latestByTractor.set(m.tractor_id, m.hour_meter_reading);
        }
      });
      
      return latestByTractor;
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
          fields(name, farm_id, farms(name)),
          operation_types(name, is_mechanical),
          fuel_equipment(name),
          implements(name),
          operation_inputs(id, inventory_item_id, quantity_used, inventory_items(commercial_name, use_unit))
        `)
        .order("operation_date", { ascending: false });
      if (error) throw error;
      return data as Operation[];
    },
  });

  const selectedOperationType = operationTypes?.find(t => t.id === form.operation_type_id);
  const isMechanical = selectedOperationType?.is_mechanical ?? true;

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

  // Get unique farms for filter
  const farms = useMemo(() => {
    const farmSet = new Map<string, string>();
    fields?.forEach(f => {
      if (f.farm_id && f.farms?.name) {
        farmSet.set(f.farm_id, f.farms.name);
      }
    });
    return Array.from(farmSet, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [fields]);

  // Filter and sort operations
  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    let result = operations.filter((op) => {
      const opDate = parseDateLocal(op.operation_date);
      
      // Date filter
      if (startDate && endDate) {
        if (!isWithinInterval(opDate, {
          start: startOfDay(startDate),
          end: endOfDay(endDate),
        })) return false;
      }
      
      // Farm filter
      if (filterFarm && op.fields?.farm_id !== filterFarm) return false;
      
      // Field filter
      if (filterField && op.field_id !== filterField) return false;
      
      // Tractor filter
      if (filterTractor && op.tractor_id !== filterTractor) return false;
      
      // Operation Type filter
      if (filterOperationType && op.operation_type_id !== filterOperationType) return false;
      
      return true;
    });

    // Apply sorting
    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        switch (sortColumn) {
          case "date":
            comparison = parseDateLocal(a.operation_date).getTime() - parseDateLocal(b.operation_date).getTime();
            break;
          case "field":
            comparison = (a.fields?.name || "").localeCompare(b.fields?.name || "");
            break;
          case "farm":
            comparison = (a.fields?.farms?.name || "").localeCompare(b.fields?.farms?.name || "");
            break;
          case "operation":
            comparison = (a.operation_types?.name || "").localeCompare(b.operation_types?.name || "");
            break;
          case "tractor":
            const aVal = a.operation_types?.is_mechanical ? (a.fuel_equipment?.name || "") : String(a.workers_count || 0);
            const bVal = b.operation_types?.is_mechanical ? (b.fuel_equipment?.name || "") : String(b.workers_count || 0);
            comparison = aVal.localeCompare(bVal);
            break;
          case "driver":
            comparison = (a.driver || "").localeCompare(b.driver || "");
            break;
          case "implement":
            comparison = (a.implements?.name || "").localeCompare(b.implements?.name || "");
            break;
          case "hours":
            comparison = calculateHoursValue(a) - calculateHoursValue(b);
            break;
          case "hectares":
            comparison = (a.hectares_done ?? 0) - (b.hectares_done ?? 0);
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [operations, startDate, endDate, sortColumn, sortDirection, filterFarm, filterField, filterTractor, filterOperationType]);

  // Top 5 operations by hectares
  const top5Operations = useMemo(() => {
    const operationHectares: Record<string, { name: string; hectares: number }> = {};
    
    filteredOperations.forEach((op) => {
      const opName = op.operation_types?.name || "Unknown";
      if (!operationHectares[opName]) {
        operationHectares[opName] = { name: opName, hectares: 0 };
      }
      operationHectares[opName].hectares += op.hectares_done || 0;
    });
    
    return Object.values(operationHectares)
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 5);
  }, [filteredOperations]);

  // Use exported functions hook
  const { exportToExcel, exportToPDF } = useOperationsExport({
    filteredOperations,
    isVisible,
    startDate,
    endDate,
  });

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
    mutationFn: async ({ data, currentInputs }: { data: typeof form; currentInputs: OperationInput[] }): Promise<{ followUpMessage?: string }> => {
      const record = {
        operation_date: formatDateLocal(data.operation_date),
        field_id: data.field_id,
        operation_type_id: data.operation_type_id,
        tractor_id: isMechanical && data.tractor_id ? data.tractor_id : null,
        implement_id: isMechanical && data.implement_id ? data.implement_id : null,
        start_hours: isMechanical && data.start_hours ? parseFloat(data.start_hours) : null,
        end_hours: isMechanical && data.end_hours ? parseFloat(data.end_hours) : null,
        workers_count: !isMechanical && data.workers_count ? parseInt(data.workers_count) : null,
        hectares_done: data.hectares_done ? parseFloat(data.hectares_done) : null,
        notes: data.notes || null,
        driver: isMechanical && data.driver ? data.driver : null,
      };

      const { data: operation, error: opError } = await supabase
        .from("operations")
        .insert(record)
        .select("id")
        .single();
      
      if (opError) throw opError;

      // Schedule follow-up if matching rule exists
      let followUpMessage: string | undefined;
      try {
        const field = fields?.find(f => f.id === data.field_id);
        const fieldName = field?.name || "";
        const result = await scheduleFollowUp(
          operation.id,
          formatDateLocal(data.operation_date),
          fieldName,
          data.operation_type_id
        );
        if (result) {
          followUpMessage = result.message;
        }
      } catch (e) {
        console.warn("Follow-up scheduling failed:", e);
      }

      // Insert inputs and deduct from inventory
      if (currentInputs.length > 0) {
        const inputRecords = currentInputs.map(input => ({
          operation_id: operation.id,
          inventory_item_id: input.inventory_item_id,
          quantity_used: input.quantity_used,
        }));

        const { error: inputError } = await supabase
          .from("operation_inputs")
          .insert(inputRecords);
        
        if (inputError) throw inputError;

        // Deduct from inventory
        for (const input of currentInputs) {
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

      return { followUpMessage };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["cronograma-entries"] });
      toast({
        title: "Operación registrada",
        description: "La operación de campo ha sido registrada y el inventario actualizado.",
      });
      if (result?.followUpMessage) {
        setTimeout(() => {
          toast({
            title: "📅 Seguimiento programado",
            description: result.followUpMessage,
          });
        }, 500);
      }
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
    mutationFn: async ({ operationId, data, originalInputs, currentInputs }: { operationId: string; data: typeof form; originalInputs: OperationInput[]; currentInputs: OperationInput[] }) => {
      const record = {
        operation_date: formatDateLocal(data.operation_date),
        field_id: data.field_id,
        operation_type_id: data.operation_type_id,
        tractor_id: isMechanical && data.tractor_id ? data.tractor_id : null,
        implement_id: isMechanical && data.implement_id ? data.implement_id : null,
        start_hours: isMechanical && data.start_hours ? parseFloat(data.start_hours) : null,
        end_hours: isMechanical && data.end_hours ? parseFloat(data.end_hours) : null,
        workers_count: !isMechanical && data.workers_count ? parseInt(data.workers_count) : null,
        hectares_done: data.hectares_done ? parseFloat(data.hectares_done) : null,
        notes: data.notes || null,
        driver: isMechanical && data.driver ? data.driver : null,
      };

      const { error: updateError } = await supabase
        .from("operations")
        .update(record)
        .eq("id", operationId);
      
      if (updateError) throw updateError;

      // Restore inventory for original inputs
      for (const input of originalInputs) {
        const item = inventoryItems?.find(i => i.id === input.inventory_item_id);
        if (item) {
          const newQuantity = item.current_quantity + input.quantity_used;
          const { error: restoreError } = await supabase
            .from("inventory_items")
            .update({ current_quantity: newQuantity })
            .eq("id", input.inventory_item_id);
          
          if (restoreError) throw restoreError;
        }
      }

      // Delete old operation_inputs
      const { error: deleteInputsError } = await supabase
        .from("operation_inputs")
        .delete()
        .eq("operation_id", operationId);
      
      if (deleteInputsError) throw deleteInputsError;

      // Insert new inputs and deduct from inventory
      if (currentInputs.length > 0) {
        const inputRecords = currentInputs.map(input => ({
          operation_id: operationId,
          inventory_item_id: input.inventory_item_id,
          quantity_used: input.quantity_used,
        }));

        const { error: inputError } = await supabase
          .from("operation_inputs")
          .insert(inputRecords);
        
        if (inputError) throw inputError;

        // Deduct from inventory (use fresh data after restore)
        for (const input of currentInputs) {
          const { data: currentItem, error: fetchError } = await supabase
            .from("inventory_items")
            .select("current_quantity")
            .eq("id", input.inventory_item_id)
            .maybeSingle();
          
          if (fetchError) throw fetchError;
          if (!currentItem) throw new Error(`Inventory item ${input.inventory_item_id} not found`);
          
          const newQuantity = currentItem.current_quantity - input.quantity_used;
          const { error: deductError } = await supabase
            .from("inventory_items")
            .update({ current_quantity: newQuantity })
            .eq("id", input.inventory_item_id);
          
          if (deductError) throw deductError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      toast({
        title: "Operación actualizada",
        description: "La operación ha sido actualizada y el inventario ajustado.",
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

      const { error: deleteInputsError } = await supabase
        .from("operation_inputs")
        .delete()
        .eq("operation_id", operationId);
      
      if (deleteInputsError) throw deleteInputsError;

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
      driver: "",
    });
    setInputs([]);
    setNewInput({ inventory_item_id: "", quantity_used: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.field_id || !form.operation_type_id) {
      toast({
        title: "Error de Validación",
        description: "Campo y tipo de operación son requeridos.",
        variant: "destructive",
      });
      return;
    }

    // Validate no negative hectares if provided
    if (form.hectares_done) {
      const hectares = parseFloat(form.hectares_done);
      if (isNaN(hectares) || hectares < 0) {
        toast({
          title: "Error de Validación",
          description: "Las hectáreas trabajadas no pueden ser negativas.",
          variant: "destructive",
        });
        return;
      }
    }

    if (isMechanical && (!form.tractor_id || !form.implement_id)) {
      toast({
        title: "Error de Validación",
        description: "Las operaciones mecánicas requieren tractor e implemento.",
        variant: "destructive",
      });
      return;
    }

    // Validate start hours < end hours for mechanical operations (only if both provided)
    if (isMechanical && form.start_hours && form.end_hours) {
      const startHours = parseFloat(form.start_hours);
      const endHours = parseFloat(form.end_hours);
      
      if (startHours >= endHours) {
        toast({
          title: "Error de Validación",
          description: "El horómetro inicio debe ser menor que el horómetro fin.",
          variant: "destructive",
        });
        return;
      }

      // Check for hour meter gap
      const gapWarning = checkHourMeterGap(form.tractor_id, startHours, form.operation_date, operations);
      if (gapWarning) {
        toast({
          title: "⚠️ Alerta de Horómetro",
          description: gapWarning,
          variant: "default",
          duration: 8000,
        });
      }
    }

    // Check if tractor maintenance is overdue (for mechanical operations)
    if (isMechanical && form.tractor_id) {
      const maintenanceStatus = checkMaintenanceOverdue(form.tractor_id, tractors, tractorMaintenanceData);
      if (maintenanceStatus?.isOverdue) {
        const tractorName = tractors?.find(t => t.id === form.tractor_id)?.name || "Tractor";
        toast({
          title: "🔧 ¡Mantenimiento Vencido!",
          description: `${tractorName} tiene el mantenimiento vencido por ${maintenanceStatus.hoursOverdue} horas. Se recomienda realizar mantenimiento antes de continuar.`,
          variant: "destructive",
          duration: 10000,
        });
      }
    }

    if (!isMechanical && !form.workers_count) {
      toast({
        title: "Error de Validación",
        description: "Las operaciones manuales requieren cantidad de obreros.",
        variant: "destructive",
      });
      return;
    }

    // Validate workers count is positive
    if (!isMechanical && form.workers_count) {
      const workers = parseInt(form.workers_count);
      if (isNaN(workers) || workers <= 0) {
        toast({
          title: "Error de Validación",
          description: "La cantidad de obreros debe ser un número positivo.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (editingOperation) {
      const originalInputs = editingOperation.operation_inputs?.map(input => ({
        inventory_item_id: input.inventory_item_id,
        quantity_used: input.quantity_used,
      })) || [];
      updateMutation.mutate({ operationId: editingOperation.id, data: form, originalInputs, currentInputs: inputs });
    } else {
      mutation.mutate({ data: form, currentInputs: inputs });
    }
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems?.find(i => i.id === itemId);
    return item ? `${item.commercial_name} (${item.use_unit})` : itemId;
  };

  return (
    <div className="space-y-6">
      {/* Top 5 Operations and Filters Row */}
      <div className="flex flex-wrap items-start gap-6">
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

        {/* Filter Dropdowns */}
        <Card className="w-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("operations.filters")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <Select value={filterFarm || "__all__"} onValueChange={(v) => setFilterFarm(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue>
                    {filterFarm ? farms.find(f => f.id === filterFarm)?.name : t("operations.filter.farms")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("operations.filter.allFarms")}</SelectItem>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterField || "__all__"} onValueChange={(v) => setFilterField(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue>
                    {filterField ? fields?.find(f => f.id === filterField)?.name : t("operations.filter.fields")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("operations.filter.allFields")}</SelectItem>
                  {fields
                    ?.filter(f => !filterFarm || f.farm_id === filterFarm)
                    .map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={filterTractor || "__all__"} onValueChange={(v) => setFilterTractor(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue>
                    {filterTractor ? tractors?.find(t => t.id === filterTractor)?.name : t("operations.filter.tractors")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("operations.filter.allTractors")}</SelectItem>
                  {tractors?.map((tractor) => (
                    <SelectItem key={tractor.id} value={tractor.id}>
                      {tractor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterOperationType || "__all__"} onValueChange={(v) => setFilterOperationType(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue>
                    {filterOperationType ? operationTypes?.find(t => t.id === filterOperationType)?.name : t("operations.filter.operationTypes")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("operations.filter.allOperationTypes")}</SelectItem>
                  {operationTypes?.map((opType) => (
                    <SelectItem key={opType.id} value={opType.id}>
                      {opType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          {filteredOperations.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="excel">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Reporte
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <ColumnSelector
            columns={allColumns}
            visibility={visibility}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
          />
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("operations.recordOperation")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOperation ? t("operations.editOperation") : t("operations.recordFieldOperation")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("operations.form.date")} *</Label>
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
                          {form.operation_date ? format(form.operation_date, "MMM d, yyyy") : t("operations.form.selectDate")}
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
                    <Label>{t("operations.form.field")} *</Label>
                    <Select
                      value={form.field_id}
                      onValueChange={(value) => setForm({ ...form, field_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("operations.form.selectField")} />
                      </SelectTrigger>
                      <SelectContent>
                        {fields?.filter(f => f.farms?.name).map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name} ({field.farms?.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{t("operations.form.operationType")} *</Label>
                  <Select
                    value={form.operation_type_id}
                    onValueChange={(value) => setForm({ ...form, operation_type_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("operations.form.selectOperation")} />
                    </SelectTrigger>
                    <SelectContent>
                      {operationTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.is_mechanical ? t("operations.form.mechanical") : t("operations.form.manual")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isMechanical ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t("operations.form.tractor")} *</Label>
                        <Select
                          value={form.tractor_id}
                          onValueChange={(value) => setForm({ ...form, tractor_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("operations.form.selectTractor")} />
                          </SelectTrigger>
                          <SelectContent>
                            {tractors?.map((tr) => (
                              <SelectItem key={tr.id} value={tr.id}>
                                {tr.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t("operations.form.implement")} *</Label>
                        <Select
                          value={form.implement_id}
                          onValueChange={(value) => setForm({ ...form, implement_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("operations.form.selectImplement")} />
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
                    
                    {/* Driver field */}
                    <div>
                      <Label>{t("operations.form.operator")}</Label>
                      <Input
                        value={form.driver}
                        onChange={(e) => setForm({ ...form, driver: e.target.value })}
                        placeholder={t("operations.form.operatorPlaceholder")}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>{t("operations.form.startHours")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.start_hours}
                          onChange={(e) => setForm({ ...form, start_hours: e.target.value })}
                          placeholder="0.0"
                        />
                      </div>
                      <div>
                        <Label>{t("operations.form.endHours")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.end_hours}
                          onChange={(e) => setForm({ ...form, end_hours: e.target.value })}
                          placeholder="0.0"
                        />
                      </div>
                      <div>
                        <Label>{t("operations.form.hectaresDone")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.hectares_done}
                          onChange={(e) => setForm({ ...form, hectares_done: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t("operations.form.workersCount")} *</Label>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="1"
                          value={form.workers_count}
                          onChange={(e) => setForm({ ...form, workers_count: e.target.value })}
                          placeholder="1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>{t("operations.form.hectaresDone")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.hectares_done}
                        onChange={(e) => setForm({ ...form, hectares_done: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                {/* Inputs Section */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t("operations.form.inputsUsed")}
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={newInput.inventory_item_id}
                      onValueChange={(value) => setNewInput({ ...newInput, inventory_item_id: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("operations.form.selectInput")} />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.commercial_name} ({item.current_quantity} {item.use_unit} {t("operations.form.available")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("operations.form.qty")}
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
                  <Label>{t("operations.form.notes")}</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder={t("operations.form.optionalNotes")}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    {t("operations.form.cancel")}
                  </Button>
                  <Button type="submit" disabled={mutation.isPending || updateMutation.isPending}>
                    {(mutation.isPending || updateMutation.isPending) 
                      ? t("operations.form.saving")
                      : editingOperation 
                        ? t("operations.form.updateOperation")
                        : t("operations.recordOperation")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Operations Table */}
      {isLoading ? (
        <div className="text-center py-8">{t("operations.loading")}</div>
      ) : filteredOperations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("operations.noOperations")}
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
              {isVisible("driver") && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("driver")}
                >
                  <div className="flex items-center">
                    Operador
                    {getSortIcon("driver")}
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
              {canEdit && <TableHead className="w-[70px] text-right sticky right-0 bg-background shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOperations.map((op) => {
              const missingClosingData = isMissingClosingData(op);
              
              return (
                <TableRow key={op.id} className={missingClosingData ? "bg-warning/10" : ""}>
                  {isVisible("date") && (
                    <TableCell className="flex items-center gap-2">
                      {missingClosingData && (
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" aria-label="Falta datos de cierre" />
                      )}
                      {format(parseDateLocal(op.operation_date), "MMM d, yyyy")}
                    </TableCell>
                  )}
                  {isVisible("field") && <TableCell className="font-medium">{op.fields?.name || "-"}</TableCell>}
                  {isVisible("farm") && <TableCell>{op.fields?.farms?.name || "-"}</TableCell>}
                  {isVisible("operation") && (
                    <TableCell>
                      <Badge variant={op.operation_types?.is_mechanical ? "default" : "secondary"}>
                        {op.operation_types?.name || "-"}
                      </Badge>
                    </TableCell>
                  )}
                  {isVisible("tractor") && (
                    <TableCell>
                      {op.operation_types?.is_mechanical
                        ? op.fuel_equipment?.name || "-"
                        : `${op.workers_count ?? 0} obreros`}
                    </TableCell>
                  )}
                  {isVisible("driver") && <TableCell>{op.driver || "-"}</TableCell>}
                  {isVisible("implement") && <TableCell>{op.implements?.name || "-"}</TableCell>}
                  {isVisible("hours") && (
                    <TableCell className={cn("font-mono", op.operation_types?.is_mechanical && op.end_hours == null && "text-warning")}>
                      {calculateHoursDisplay(op)} {calculateHoursDisplay(op) !== "-" && "hrs"}
                    </TableCell>
                  )}
                  {isVisible("hectares") && (
                    <TableCell className={cn("font-medium", (op.hectares_done == null || op.hectares_done === 0) && "text-warning")}>
                      {op.hectares_done != null ? `${op.hectares_done} ha` : "-"}
                    </TableCell>
                  )}
                  {isVisible("inputs") && (
                    <TableCell>
                      {op.operation_inputs && op.operation_inputs.length > 0 ? (
                        <div className="space-y-1">
                      {op.operation_inputs.map((input) => (
                            <div key={input.id} className="text-xs">
                              {input.inventory_items?.commercial_name || "Unknown"}: {input.quantity_used} {input.inventory_items?.use_unit || ""}
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
                    <TableCell className={cn(
                      "text-right sticky right-0 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                      missingClosingData ? "bg-warning/10" : "bg-background"
                    )}>
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
                              operation_date: parseDateLocal(op.operation_date),
                              field_id: op.field_id,
                              operation_type_id: op.operation_type_id,
                              tractor_id: op.tractor_id || "",
                              implement_id: op.implement_id || "",
                              start_hours: op.start_hours?.toString() || "",
                              end_hours: op.end_hours?.toString() || "",
                              workers_count: op.workers_count?.toString() || "",
                              hectares_done: op.hectares_done?.toString() || "",
                              notes: op.notes || "",
                              driver: op.driver || "",
                            });
                            if (op.operation_inputs && op.operation_inputs.length > 0) {
                              setInputs(op.operation_inputs.map(input => ({
                                inventory_item_id: input.inventory_item_id,
                                quantity_used: input.quantity_used,
                              })));
                            } else {
                              setInputs([]);
                            }
                            setIsDialogOpen(true);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {missingClosingData ? t("common.completeClosing") : t("common.edit")}
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
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOperationId} onOpenChange={(open) => !open && setDeleteOperationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("operations.deleteOperation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("operations.deleteOperationDesc")} {t("common.cannotUndo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOperationId && deleteMutation.mutate(deleteOperationId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
