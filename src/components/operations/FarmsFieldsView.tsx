import { useState } from "react";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Pencil, MapPin, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Farm {
  id: string;
  name: string;
  is_active: boolean;
}

interface Field {
  id: string;
  name: string;
  farm_id: string;
  hectares: number | null;
  is_active: boolean;
  farms: { name: string };
}

export function FarmsFieldsView() {
  const [isFarmDialogOpen, setIsFarmDialogOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [farmForm, setFarmForm] = useState({ name: "" });
  const [fieldForm, setFieldForm] = useState({
    name: "",
    farm_id: "",
    hectares: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch farms
  const { data: farms, isLoading: farmsLoading } = useQuery({
    queryKey: ["farms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Farm[];
    },
  });

  // Fetch fields
  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ["fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("*, farms(name)")
        .order("name");
      if (error) throw error;
      return data as Field[];
    },
  });

  // Farm mutation
  const farmMutation = useMutation({
    mutationFn: async (data: typeof farmForm) => {
      if (editingFarm) {
        const { error } = await supabase
          .from("farms")
          .update({ name: data.name })
          .eq("id", editingFarm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("farms").insert({ name: data.name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      toast({
        title: editingFarm ? "Farm updated" : "Farm added",
        description: `${farmForm.name} has been saved.`,
      });
      handleCloseFarmDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Field mutation
  const fieldMutation = useMutation({
    mutationFn: async (data: typeof fieldForm) => {
      const record = {
        name: data.name,
        farm_id: data.farm_id,
        hectares: data.hectares ? parseFloat(data.hectares) : null,
      };

      if (editingField) {
        const { error } = await supabase
          .from("fields")
          .update(record)
          .eq("id", editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fields").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      toast({
        title: editingField ? "Field updated" : "Field added",
        description: `${fieldForm.name} has been saved.`,
      });
      handleCloseFieldDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditFarm = (farm: Farm) => {
    setEditingFarm(farm);
    setFarmForm({ name: farm.name });
    setIsFarmDialogOpen(true);
  };

  const handleEditField = (field: Field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      farm_id: field.farm_id,
      hectares: field.hectares?.toString() || "",
    });
    setIsFieldDialogOpen(true);
  };

  const handleCloseFarmDialog = () => {
    setIsFarmDialogOpen(false);
    setEditingFarm(null);
    setFarmForm({ name: "" });
  };

  const handleCloseFieldDialog = () => {
    setIsFieldDialogOpen(false);
    setEditingField(null);
    setFieldForm({ name: "", farm_id: "", hectares: "" });
  };

  const handleFarmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmForm.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a farm name.",
        variant: "destructive",
      });
      return;
    }
    farmMutation.mutate(farmForm);
  };

  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.name || !fieldForm.farm_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    fieldMutation.mutate(fieldForm);
  };

  // Group fields by farm
  const fieldsByFarm = farms?.reduce((acc, farm) => {
    acc[farm.id] = fields?.filter((f) => f.farm_id === farm.id) || [];
    return acc;
  }, {} as Record<string, Field[]>);

  if (farmsLoading || fieldsLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Add buttons */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Dialog open={isFarmDialogOpen} onOpenChange={setIsFarmDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Farm
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFarm ? "Edit Farm" : "Add New Farm"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFarmSubmit} className="space-y-4">
              <div>
                <Label>Farm Name *</Label>
                <Input
                  value={farmForm.name}
                  onChange={(e) => setFarmForm({ name: e.target.value })}
                  placeholder="e.g., North Farm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseFarmDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={farmMutation.isPending}>
                  {farmMutation.isPending ? "Saving..." : editingFarm ? "Update" : "Add Farm"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingField ? "Edit Field" : "Add New Field"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFieldSubmit} className="space-y-4">
              <div>
                <Label>Farm *</Label>
                <Select
                  value={fieldForm.farm_id}
                  onValueChange={(value) => setFieldForm({ ...fieldForm, farm_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select farm" />
                  </SelectTrigger>
                  <SelectContent>
                    {farms?.map((farm) => (
                      <SelectItem key={farm.id} value={farm.id}>
                        {farm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Field Name *</Label>
                <Input
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="e.g., Field A-1"
                />
              </div>
              <div>
                <Label>Hectares</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={fieldForm.hectares}
                  onChange={(e) => setFieldForm({ ...fieldForm, hectares: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseFieldDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={fieldMutation.isPending}>
                  {fieldMutation.isPending ? "Saving..." : editingField ? "Update" : "Add Field"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Farms & Fields Accordion */}
      {!farms || farms.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Sin fincas"
          description="No hay fincas agregadas. Haga clic en 'Add Farm' para comenzar."
        />
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {farms.map((farm) => (
            <AccordionItem key={farm.id} value={farm.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">{farm.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {fieldsByFarm?.[farm.id]?.length || 0} fields
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditFarm(farm);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {fieldsByFarm?.[farm.id]?.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2 pl-7">
                    No fields in this farm yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Hectares</TableHead>
                        <TableHead className="w-[60px]">Edit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fieldsByFarm?.[farm.id]?.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Layers className="h-3 w-3 text-muted-foreground" />
                              {field.name}
                            </div>
                          </TableCell>
                          <TableCell>{field.hectares ? `${field.hectares} ha` : "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditField(field)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Total: {farms?.length || 0} farms, {fields?.length || 0} fields
      </div>
    </div>
  );
}
