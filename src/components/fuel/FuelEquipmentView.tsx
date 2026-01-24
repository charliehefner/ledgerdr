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
import { Plus, Pencil, Tractor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface FuelEquipment {
  id: string;
  name: string;
  equipment_type: string;
  current_hour_meter: number;
  is_active: boolean;
}

export function FuelEquipmentView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<FuelEquipment | null>(null);
  const [form, setForm] = useState({
    name: "",
    equipment_type: "tractor",
    current_hour_meter: "0",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["fuelEquipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as FuelEquipment[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        name: data.name,
        equipment_type: data.equipment_type,
        current_hour_meter: parseFloat(data.current_hour_meter),
      };

      if (editingEquipment) {
        const { error } = await supabase
          .from("fuel_equipment")
          .update(payload)
          .eq("id", editingEquipment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fuel_equipment").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelEquipment"] });
      toast({
        title: editingEquipment ? "Equipment updated" : "Equipment added",
        description: `${form.name} has been ${editingEquipment ? "updated" : "added"}.`,
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

  const handleEdit = (equip: FuelEquipment) => {
    setEditingEquipment(equip);
    setForm({
      name: equip.name,
      equipment_type: equip.equipment_type,
      current_hour_meter: equip.current_hour_meter.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEquipment(null);
    setForm({
      name: "",
      equipment_type: "tractor",
      current_hour_meter: "0",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({
        title: "Validation Error",
        description: "Please enter an equipment name.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading equipment...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Equipment</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEquipment ? "Edit Equipment" : "Add New Equipment"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Equipment Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., John Deere 6120M"
                />
              </div>
              <div>
                <Label htmlFor="equipment_type">Type</Label>
                <Select
                  value={form.equipment_type}
                  onValueChange={(value) =>
                    setForm({ ...form, equipment_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tractor">Tractor</SelectItem>
                    <SelectItem value="generator">Generator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hour_meter">Current Hour Meter</Label>
                <Input
                  id="hour_meter"
                  type="number"
                  step="0.1"
                  value={form.current_hour_meter}
                  onChange={(e) =>
                    setForm({ ...form, current_hour_meter: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {equipment.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tractor className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No equipment registered.</p>
          <p className="text-sm">Add tractors or generators to track fuel usage.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Current Hour Meter</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map((equip) => (
              <TableRow key={equip.id}>
                <TableCell className="font-medium">{equip.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={equip.equipment_type === "tractor" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {equip.equipment_type}
                  </Badge>
                </TableCell>
                <TableCell>{equip.current_hour_meter.toLocaleString()} hrs</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(equip)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
