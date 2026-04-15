import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
  FileSpreadsheet, FileText, Download, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
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
import { format, startOfMonth, endOfMonth } from "date-fns";
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
import { useEntityFilter } from "@/hooks/useEntityFilter";

export function OperationsLogView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [deleteOperationId, setDeleteOperationId] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<{ data: typeof form; currentInputs: OperationInput[] } | null>(null);
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
  const { applyEntityFilter, selectedEntityId, isAllEntities } = useEntityFilter();

  const {
    visibility,
    toggleColumn,
    resetToDefaults,
    isVisible,
    allColumns,
  } = useColumnVisibility("operations-log", operationsColumns);

  // Fetch fields with farm names
  const { data: fields } = useQuery({
    queryKey: ["fields", selectedEntityId],
    queryFn: async () => {
      let q: any = supabase.from("fields").select("*, farms!inner(name, entity_id)").eq("is_active", true).order("name");
      if (!isAllEntities && selectedEntityId) {
        q = q.eq("farms.entity_id", selectedEntityId);
      }
      const { data, error } = await q;
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

  // Fetch tractor operators
  const { data: tractorOperators = [] } = useQuery({
    queryKey: ["tractor-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tractor_operators")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  // Fetch latest maintenance for each tractor
  const { data: tractorMaintenanceData = new Map<string, number>() } = useQuery({
    queryKey: ["tractors-maintenance-operations"],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("tractor_maintenance")
        .select("tractor_id, hour_meter_reading")
        .order("maintenance_date", { ascending: false });
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

  // Resolve field IDs for farm filter (needed for server-side filtering)
  const farmFieldIds = useMemo(() => {
    if (!filterFarm || !fields) return null;
    return fields.filter(f => f.farm_id === filterFarm).map(f => f.id);
  }, [filterFarm, fields]);

  // Fetch operations with server-side date + column filters
  const { data: operations, isLoading } = useQuery({
    queryKey: ["operations", selectedEntityId, startDate?.toISOString(), endDate?.toISOString(), filterField, filterTractor, filterOperationType, filterFarm, farmFieldIds],
    queryFn: async () => {
      let q: any = supabase
        .from("operations")
        .select(`
          *,
          fields:fields!operations_field_id_fkey(name, farm_id, farms:farms!fields_farm_id_fkey(name)),
          operation_types:operation_types!operations_operation_type_id_fkey(name, is_mechanical),
          fuel_equipment:fuel_equipment!operations_tractor_id_fkey(name),
          implements:implements!operations_implement_id_fkey(name),
          operation_inputs:operation_inputs!operation_inputs_operation_id_fkey(id, inventory_item_id, quantity_used, inventory_items:inventory_items!operation_inputs_inventory_item_id_fkey(commercial_name, use_unit))
        `)
        .order("operation_date", { ascending: false });
      q = applyEntityFilter(q);

      // Server-side date range filter
      if (startDate) {
        q = q.gte("operation_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        q = q.lte("operation_date", format(endDate, "yyyy-MM-dd"));
      }

      // Server-side direct column filters
      if (filterField) {
        q = q.eq("field_id", filterField);
      }
      if (filterTractor) {
        q = q.eq("tractor_id", filterTractor);
      }
      if (filterOperationType) {
        q = q.eq("operation_type_id", filterOperationType);
      }
      // Farm filter via field IDs
      if (filterFarm && farmFieldIds && farmFieldIds.length > 0) {
        q = q.in("field_id", farmFieldIds);
      } else if (filterFarm && farmFieldIds && farmFieldIds.length === 0) {
        // Farm selected but no fields match — return empty
        return [] as Operation[];
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Operation[];
    },
    placeholderData: keepPreviousData,
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

  // Sort operations (filtering is now server-side)
  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    let result = [...operations];

    // Apply sorting (client-side since some sort columns need joined data)
    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
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
  }, [operations, sortColumn, sortDirection]);

  // Client-side pagination for sorted results
  const [opsPage, setOpsPage] = useState(0);
  const [opsPageSize, setOpsPageSize] = useState(20);
  const OPS_PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
  const opsTotalItems = filteredOperations.length;
  const opsTotalPages = Math.max(1, Math.ceil(opsTotalItems / opsPageSize));
  const safeOpsPage = Math.min(opsPage, opsTotalPages - 1);
  const paginatedOperations = useMemo(() => {
    const start = safeOpsPage * opsPageSize;
    return filteredOperations.slice(start, start + opsPageSize);
  }, [filteredOperations, safeOpsPage, opsPageSize]);
  const opsHasNextPage = safeOpsPage < opsTotalPages - 1;
  const opsHasPrevPage = safeOpsPage > 0;

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
        title: t("operations.toast.validationError"),
        description: t("operations.toast.selectItemAndQty"),
        variant: "destructive",
      });
      return;
    }
    
    // Check if item already added
    if (inputs.some(i => i.inventory_item_id === newInput.inventory_item_id)) {
      toast({
        title: t("operations.toast.duplicateItem"),
        description: t("operations.toast.duplicateItemDesc"),
        variant: "destructive",
      });
      return;
    }

    const item = inventoryItems?.find(i => i.id === newInput.inventory_item_id);
    const qty = parseFloat(newInput.quantity_used);
    
    if (item && qty > item.current_quantity) {
      toast({
        title: t("operations.toast.insufficientStock"),
        description: t("operations.toast.onlyAvailable").replace("{qty}", String(item.current_quantity)).replace("{unit}", item.use_unit),
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
        entity_id: selectedEntityId,
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

      // Send Telegram notification via category routing (fire-and-forget)
      try {
        const fieldName = fields?.find(f => f.id === data.field_id)?.name || "—";
        const tractorName = tractors?.find(t => t.id === data.tractor_id)?.name || "—";
        const opTypeName = operationTypes?.find(o => o.id === data.operation_type_id)?.name || "—";
        const driverName = data.driver || "—";

        const msg = `🚜 <b>New Operation</b>\n📍 Field: ${fieldName}\n🔧 Operation: ${opTypeName}\n🚗 Tractor: ${tractorName}\n👤 Driver: ${driverName}`;

        supabase.functions.invoke("send-telegram", {
          body: { category: "operations", message: msg },
        }).catch(e => console.warn("Telegram notification failed:", e));
      } catch (e) {
        console.warn("Telegram notification failed:", e);
      }

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

      // Atomically insert inputs and deduct from inventory via RPC
      if (currentInputs.length > 0) {
        const { error: inputError } = await supabase.rpc("save_operation_inputs", {
          p_operation_id: operation.id,
          p_inputs: currentInputs.map(i => ({
            inventory_item_id: i.inventory_item_id,
            quantity_used: i.quantity_used,
          })),
          p_restore_original: false,
        });
        if (inputError) throw inputError;
      }

      return { followUpMessage };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["cronograma-entries"] });
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["tractors-for-horometer"] });
      toast({
        title: t("operations.toast.operationRecorded"),
        description: t("operations.toast.operationRecordedDesc"),
      });
      if (result?.followUpMessage) {
        setTimeout(() => {
          toast({
            title: t("operations.toast.followUpScheduled"),
            description: result.followUpMessage,
          });
        }, 500);
      }
      handleCloseDialog();
    },
    onError: (error) => {
      console.error("[Operations] Create mutation error:", error);
      toast({
        title: t("operations.toast.errorRecording"),
        description: error.message || t("operations.toast.unknownError"),
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

      // Atomically restore old inputs, insert new ones, and reconcile inventory
      const { error: inputError } = await supabase.rpc("save_operation_inputs", {
        p_operation_id: operationId,
        p_inputs: currentInputs.map(i => ({
          inventory_item_id: i.inventory_item_id,
          quantity_used: i.quantity_used,
        })),
        p_restore_original: true,
      });
      if (inputError) throw inputError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["tractors-for-horometer"] });
      toast({
        title: t("operations.toast.operationUpdated"),
        description: t("operations.toast.operationUpdatedDesc"),
      });
      handleCloseDialog();
    },
    onError: (error) => {
      console.error("[Operations] Update mutation error:", error);
      toast({
        title: t("operations.toast.errorUpdating"),
        description: error.message || t("operations.toast.unknownError"),
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (operationId: string) => {
      // Atomically restore inventory and clear inputs
      const { error: inputError } = await supabase.rpc("save_operation_inputs", {
        p_operation_id: operationId,
        p_inputs: [],
        p_restore_original: true,
      });
      if (inputError) throw inputError;

      const { error: deleteError } = await supabase
        .from("operations")
        .delete()
        .eq("id", operationId);
      
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["tractors-for-horometer"] });
      toast({
        title: t("operations.toast.operationDeleted"),
        description: t("operations.toast.operationDeletedDesc"),
      });
      setDeleteOperationId(null);
    },
    onError: (error) => {
      console.error("[Operations] Delete mutation error:", error);
      toast({
        title: t("operations.toast.errorDeleting"),
        description: error.message || t("operations.toast.unknownError"),
        variant: "destructive",
      });
    },
  });

  const resetOperationFormState = () => {
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

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    // Defer reset until after Radix portal close to avoid removeChild race
    requestAnimationFrame(() => resetOperationFormState());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.field_id || !form.operation_type_id) {
      toast({
        title: t("operations.toast.validationError"),
        description: t("operations.toast.fieldAndTypeRequired"),
        variant: "destructive",
      });
      return;
    }

    // Validate no negative hectares if provided
    if (form.hectares_done) {
      const hectares = parseFloat(form.hectares_done);
      if (isNaN(hectares) || hectares < 0) {
        toast({
          title: t("operations.toast.validationError"),
          description: t("operations.toast.negativeHectares"),
          variant: "destructive",
        });
        return;
      }
    }

    if (isMechanical && (!form.tractor_id || !form.implement_id)) {
      toast({
        title: t("operations.toast.validationError"),
        description: t("operations.toast.mechanicalRequires"),
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
          title: t("operations.toast.validationError"),
          description: t("operations.toast.hourMeterStartLess"),
          variant: "destructive",
        });
        return;
      }

      // Hard-block: check for hour meter gap > 100h
      const gapWarning = checkHourMeterGap(form.tractor_id, startHours, form.operation_date, operations, editingOperation?.id);
      if (gapWarning) {
        // Calculate numeric gap to decide block vs warn
        const tractorOps = operations
          ?.filter(op => op.tractor_id === form.tractor_id && op.end_hours != null)
          .filter(op => editingOperation ? op.id !== editingOperation.id : true)
          .filter(op => parseDateLocal(op.operation_date) <= form.operation_date)
          .sort((a, b) => parseDateLocal(b.operation_date).getTime() - parseDateLocal(a.operation_date).getTime());
        const lastEndHours = tractorOps?.[0]?.end_hours ?? null;
        const gap = lastEndHours != null ? startHours - lastEndHours : 0;

        if (gap > 100) {
          toast({
            title: t("operations.toast.hourMeterBlocked"),
            description: t("operations.toast.hourMeterBlockedDesc").replace("{gap}", gap.toFixed(1)),
            variant: "destructive",
            duration: 10000,
          });
          return;
        }

        // Small gap: just warn
        toast({
          title: t("operations.toast.hourMeterAlert"),
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
          title: t("operations.toast.maintenanceOverdue"),
          description: t("operations.toast.maintenanceOverdueDesc").replace("{tractor}", tractorName).replace("{hours}", String(maintenanceStatus.hoursOverdue)),
          variant: "destructive",
          duration: 10000,
        });
      }
    }

    if (!isMechanical && !form.workers_count) {
      toast({
        title: t("operations.toast.validationError"),
        description: t("operations.toast.manualRequiresWorkers"),
        variant: "destructive",
      });
      return;
    }

    // Validate workers count is positive
    if (!isMechanical && form.workers_count) {
      const workers = parseInt(form.workers_count);
      if (isNaN(workers) || workers <= 0) {
        toast({
          title: t("operations.toast.validationError"),
          description: t("operations.toast.positiveWorkers"),
          variant: "destructive",
        });
        return;
      }
    }

    // If user typed an input but didn't press "+", include it on save
    const normalizedInputs = [...inputs];
    if (newInput.inventory_item_id || newInput.quantity_used) {
      if (!newInput.inventory_item_id || !newInput.quantity_used) {
        toast({
          title: t("operations.toast.validationError"),
          description: t("operations.toast.completePendingInput"),
          variant: "destructive",
        });
        return;
      }

      const pendingQty = parseFloat(newInput.quantity_used);
      if (isNaN(pendingQty) || pendingQty <= 0) {
        toast({
          title: t("operations.toast.validationError"),
          description: t("operations.toast.inputQtyPositive"),
          variant: "destructive",
        });
        return;
      }

      const pendingItem = inventoryItems?.find(i => i.id === newInput.inventory_item_id);
      if (!pendingItem) {
        toast({
          title: t("operations.toast.validationError"),
          description: t("operations.toast.inputNotAvailable"),
          variant: "destructive",
        });
        return;
      }

      const existingIndex = normalizedInputs.findIndex(i => i.inventory_item_id === newInput.inventory_item_id);
      const existingQty = existingIndex >= 0 ? normalizedInputs[existingIndex].quantity_used : 0;
      const maxAllowed = pendingItem.current_quantity + existingQty;

      if (pendingQty > maxAllowed) {
        toast({
          title: t("operations.toast.insufficientStock"),
          description: t("operations.toast.onlyAvailableForSave").replace("{qty}", String(maxAllowed)).replace("{unit}", pendingItem.use_unit),
          variant: "destructive",
        });
        return;
      }

      if (existingIndex >= 0) {
        normalizedInputs[existingIndex] = {
          ...normalizedInputs[existingIndex],
          quantity_used: pendingQty,
        };
      } else {
        normalizedInputs.push({
          inventory_item_id: newInput.inventory_item_id,
          quantity_used: pendingQty,
        });
      }
    }
    
    if (editingOperation) {
      const originalInputs = editingOperation.operation_inputs?.map(input => ({
        inventory_item_id: input.inventory_item_id,
        quantity_used: input.quantity_used,
      })) || [];
      updateMutation.mutate({ operationId: editingOperation.id, data: form, originalInputs, currentInputs: normalizedInputs });
    } else {
      // Duplicate detection: check existing operations for same field/type/date/inputs
      const dateStr = formatDateLocal(form.operation_date);
      const matchingOps = operations?.filter(
        op => op.field_id === form.field_id
          && op.operation_type_id === form.operation_type_id
          && op.operation_date === dateStr
      ) || [];

      if (matchingOps.length > 0) {
        const currentInputIds = normalizedInputs.map(i => i.inventory_item_id).sort().join(",");
        const hasDuplicate = matchingOps.some(op => {
          const existingIds = (op.operation_inputs || []).map(i => i.inventory_item_id).sort().join(",");
          return existingIds === currentInputIds;
        });

        if (hasDuplicate) {
          setPendingDuplicate({ data: { ...form }, currentInputs: normalizedInputs });
          return;
        }
      }

      mutation.mutate({ data: form, currentInputs: normalizedInputs });
    }
  };

  const confirmDuplicateSave = () => {
    if (pendingDuplicate) {
      mutation.mutate(pendingDuplicate);
      setPendingDuplicate(null);
    }
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems?.find(i => i.id === itemId);
    return item ? `${item.commercial_name} (${item.use_unit})` : itemId;
  };

  return (
    <div className="space-y-6">
      {/* Top 5 Operations and Filters Row */}
      <div className="flex flex-wrap items-start gap-6 overflow-visible">
        {/* Top 5 Operations by Hectares */}
        <Card className="w-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t("operations.top5Title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {top5Operations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("operations.top5NoData")}</p>
            ) : (
              <Table className="w-auto">
                <TableBody>
                  {top5Operations.map((op) => (
                    <TableRow key={op.name}>
                      <TableCell className="font-medium py-2 whitespace-nowrap">
                        {t("operations.hectaresPrefix")} {op.name}:
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
        <Card className="w-fit min-w-0 flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("operations.filters")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {startDate ? format(startDate, "MMM d, yyyy") : t("operations.startDate")}
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
          <span className="text-muted-foreground">{t("operations.dateTo")}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM d, yyyy") : t("operations.endDate")}
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
                  {t("operations.exportReport")}
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
          <Button onClick={() => { resetOperationFormState(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            {t("operations.recordOperation")}
          </Button>
          {isDialogOpen && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  requestAnimationFrame(() => resetOperationFormState());
                }
              }}
            >
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
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.field_id}
                      onChange={(e) => setForm({ ...form, field_id: e.target.value })}
                    >
                      <option value="">{t("operations.form.selectField")}</option>
                      {fields?.filter(f => f.farms?.name).map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name} ({field.farms?.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label>{t("operations.form.operationType")} *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.operation_type_id}
                    onChange={(e) => setForm({ ...form, operation_type_id: e.target.value })}
                  >
                    <option value="">{t("operations.form.selectOperation")}</option>
                    {operationTypes?.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.is_mechanical ? t("operations.form.mechanical") : t("operations.form.manual")})
                      </option>
                    ))}
                  </select>
                </div>

                {isMechanical ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t("operations.form.tractor")} *</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={form.tractor_id}
                          onChange={(e) => {
                            const tractorId = e.target.value;
                            const tractor = tractors?.find(t => t.id === tractorId);
                            setForm(prev => ({
                              ...prev,
                              tractor_id: tractorId,
                              start_hours: (!editingOperation && tractor?.current_hour_meter)
                                ? tractor.current_hour_meter.toString()
                                : prev.start_hours,
                            }));
                          }}
                        >
                          <option value="">{t("operations.form.selectTractor")}</option>
                          {tractors?.map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>{t("operations.form.implement")} *</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={form.implement_id}
                          onChange={(e) => setForm({ ...form, implement_id: e.target.value })}
                        >
                          <option value="">{t("operations.form.selectImplement")}</option>
                          {implements_?.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Driver field - dropdown from tractor_operators */}
                    <div>
                      <Label>{t("operations.form.operator")}</Label>
                      <Input
                        list="tractor-operators-list"
                        value={form.driver}
                        onChange={(e) => setForm({ ...form, driver: e.target.value })}
                        placeholder={t("operations.form.operatorPlaceholder")}
                      />
                      <datalist id="tractor-operators-list">
                        {tractorOperators.map((op) => (
                          <option key={op.id} value={op.name} />
                        ))}
                      </datalist>
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
                    <select
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={newInput.inventory_item_id}
                      onChange={(e) => setNewInput({ ...newInput, inventory_item_id: e.target.value })}
                    >
                      <option value="">{t("operations.form.selectInput")}</option>
                      {inventoryItems?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.commercial_name} ({item.current_quantity} {item.use_unit} {t("operations.form.available")})
                        </option>
                      ))}
                    </select>
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
                              {item?.commercial_name} - {Number(input.quantity_used).toFixed(2)} {item?.use_unit}
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
          )}
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
                    {t("operations.th.date")}
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
                    {t("operations.th.field")}
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
                    {t("operations.th.farm")}
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
                    {t("operations.th.operation")}
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
                    {t("operations.th.tractorWorkers")}
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
                    {t("operations.th.operator")}
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
                    {t("operations.th.implement")}
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
                    {t("operations.th.hours")}
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
                    {t("operations.th.hectares")}
                    {getSortIcon("hectares")}
                  </div>
                </TableHead>
              )}
              {isVisible("inputs") && <TableHead>{t("operations.th.inputs")}</TableHead>}
              {isVisible("notes") && <TableHead>{t("operations.th.notes")}</TableHead>}
              {canEdit && <TableHead className="w-[70px] text-right sticky right-0 bg-background shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">{t("operations.th.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOperations.map((op) => {
              const missingClosingData = isMissingClosingData(op);
              
              return (
                <TableRow key={op.id} className={missingClosingData ? "bg-warning/10" : ""}>
                  {isVisible("date") && (
                    <TableCell className="flex items-center gap-2">
                      {missingClosingData && (
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" aria-label={t("operations.missingClosingData")} />
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
                        : `${op.workers_count ?? 0} ${t("operations.workers")}`}
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
                              {input.inventory_items?.commercial_name || "Unknown"}: {Number(input.quantity_used).toFixed(2)} {input.inventory_items?.use_unit || ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  {isVisible("notes") && <TableCell className="text-muted-foreground max-w-[200px] truncate" title={op.notes || ""}>{op.notes || "-"}</TableCell>}
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
                            {t("common.delete")}
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

      {/* Operations Pagination */}
      {opsTotalItems > 0 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t("operations.show") || "Show"}</span>
            <Select
              value={String(opsPageSize)}
              onValueChange={(v) => { setOpsPageSize(Number(v)); setOpsPage(0); }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPS_PAGE_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>
              {t("operations.ofTotal")?.replace("{count}", String(opsTotalItems)) || `of ${opsTotalItems} operations`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!opsHasPrevPage} onClick={() => setOpsPage(0)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!opsHasPrevPage} onClick={() => setOpsPage(p => Math.max(p - 1, 0))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {safeOpsPage + 1} / {opsTotalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!opsHasNextPage} onClick={() => setOpsPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!opsHasNextPage} onClick={() => setOpsPage(opsTotalPages - 1)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
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

      {/* Duplicate Operation Confirmation Dialog */}
      <AlertDialog open={!!pendingDuplicate} onOpenChange={(open) => !open && setPendingDuplicate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t("operations.duplicateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("operations.duplicateDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDuplicateSave}>
              {t("operations.saveAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
