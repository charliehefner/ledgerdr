import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Tractor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TractorEquipment {
  id: string;
  name: string;
  equipment_type: string;
  current_hour_meter: number;
  is_active: boolean;
}

export function TractorsView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTractor, setEditingTractor] = useState<TractorEquipment | null>(null);
  const [form, setForm] = useState({
    name: "",
    current_hour_meter: "0",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tractors, isLoading } = useQuery({
    queryKey: ["tractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("*")
        .eq("equipment_type", "tractor")
        .order("name");
      if (error) throw error;
      return data as TractorEquipment[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record = {
        name: data.name,
        equipment_type: "tractor",
        current_hour_meter: parseFloat(data.current_hour_meter) || 0,
      };

      if (editingTractor) {
        const { error } = await supabase
          .from("fuel_equipment")
          .update(record)
          .eq("id", editingTractor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fuel_equipment").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractors"] });
      queryClient.invalidateQueries({ queryKey: ["fuelEquipment"] });
      toast({
        title: editingTractor ? "Tractor updated" : "Tractor added",
        description: `${form.name} has been ${editingTractor ? "updated" : "added"} successfully.`,
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

  const handleEdit = (tractor: TractorEquipment) => {
    setEditingTractor(tractor);
    setForm({
      name: tractor.name,
      current_hour_meter: tractor.current_hour_meter.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTractor(null);
    setForm({ name: "", current_hour_meter: "0" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a tractor name.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading tractors...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Tractor className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Tractors</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Tractor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTractor ? "Edit Tractor" : "Add New Tractor"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Tractor Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., John Deere 6215R"
                />
              </div>

              <div>
                <Label>Current Hour Meter</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.current_hour_meter}
                  onChange={(e) =>
                    setForm({ ...form, current_hour_meter: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editingTractor ? "Update" : "Add Tractor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!tractors || tractors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No tractors added yet. Click "Add Tractor" to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Hour Meter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tractors.map((tractor) => (
              <TableRow key={tractor.id}>
                <TableCell className="font-medium">{tractor.name}</TableCell>
                <TableCell>{tractor.current_hour_meter} hrs</TableCell>
                <TableCell>
                  <Badge variant={tractor.is_active ? "default" : "secondary"}>
                    {tractor.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(tractor)}
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
