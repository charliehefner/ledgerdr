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
import { Plus, CalendarIcon, Tractor, Users, MapPin, Activity, Trash2, Package } from "lucide-react";
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

export function OperationsLogView() {
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
  const [inputs, setInputs] = useState<OperationInput[]>([]);
  const [newInput, setNewInput] = useState({ inventory_item_id: "", quantity_used: "" });

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

  const addInput = () => {
    if (!newInput.inventory_item_id || !newInput.quantity_used) {
      toast({
        title: "Validation Error",
        description: "Please select an item and enter quantity.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if item already added
    if (inputs.some(i => i.inventory_item_id === newInput.inventory_item_id)) {
      toast({
        title: "Duplicate Item",
        description: "This item is already added. Update quantity instead.",
        variant: "destructive",
      });
      return;
    }

    const item = inventoryItems?.find(i => i.id === newInput.inventory_item_id);
    const qty = parseFloat(newInput.quantity_used);
    
    if (item && qty > item.current_quantity) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${item.current_quantity} ${item.use_unit} available.`,
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
        title: "Operation recorded",
        description: "The field operation has been logged and inventory updated.",
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
    setInputs([]);
    setNewInput({ inventory_item_id: "", quantity_used: "" });
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

  const getItemName = (itemId: string) => {
    const item = inventoryItems?.find(i => i.id === itemId);
    return item ? `${item.commercial_name} (${item.use_unit})` : itemId;
  };

  return (
    <div className="space-y-6">
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

                {/* Inputs Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-semibold">Inputs Used (Optional)</Label>
                  </div>
                  
                  <div className="flex gap-2">
                    <Select
                      value={newInput.inventory_item_id}
                      onValueChange={(value) => setNewInput({ ...newInput, inventory_item_id: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select inventory item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.commercial_name} ({item.current_quantity} {item.use_unit} available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Qty"
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
              <TableHead>Inputs</TableHead>
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
                <TableCell className="text-muted-foreground">{op.notes || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
