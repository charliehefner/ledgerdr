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
import { Plus, Pencil, Fuel } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface FuelTank {
  id: string;
  name: string;
  capacity_gallons: number;
  fuel_type: string;
  use_type: string;
  current_level_gallons: number;
  is_active: boolean;
}

export function FuelTanksView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);
  const [form, setForm] = useState({
    name: "",
    capacity_gallons: "",
    fuel_type: "diesel",
    use_type: "agriculture",
    current_level_gallons: "0",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tanks = [], isLoading } = useQuery({
    queryKey: ["fuelTanks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as FuelTank[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        name: data.name,
        capacity_gallons: parseFloat(data.capacity_gallons),
        fuel_type: data.fuel_type,
        use_type: data.use_type,
        current_level_gallons: parseFloat(data.current_level_gallons),
      };

      if (editingTank) {
        const { error } = await supabase
          .from("fuel_tanks")
          .update(payload)
          .eq("id", editingTank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fuel_tanks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      toast({
        title: editingTank ? "Tank updated" : "Tank added",
        description: `${form.name} has been ${editingTank ? "updated" : "added"}.`,
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

  const handleEdit = (tank: FuelTank) => {
    setEditingTank(tank);
    setForm({
      name: tank.name,
      capacity_gallons: tank.capacity_gallons.toString(),
      fuel_type: tank.fuel_type,
      use_type: tank.use_type,
      current_level_gallons: tank.current_level_gallons.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTank(null);
    setForm({
      name: "",
      capacity_gallons: "",
      fuel_type: "diesel",
      use_type: "agriculture",
      current_level_gallons: "0",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.capacity_gallons) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading tanks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Fuel Tanks</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tank
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTank ? "Edit Tank" : "Add New Tank"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Tank Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Main Agriculture Tank"
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity (Gallons) *</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={form.capacity_gallons}
                  onChange={(e) =>
                    setForm({ ...form, capacity_gallons: e.target.value })
                  }
                  placeholder="e.g., 1000"
                />
              </div>
              <div>
                <Label htmlFor="fuel_type">Fuel Type</Label>
                <Select
                  value={form.fuel_type}
                  onValueChange={(value) =>
                    setForm({ ...form, fuel_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="gasoline">Gasoline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="use_type">Use Type</Label>
                <Select
                  value={form.use_type}
                  onValueChange={(value) =>
                    setForm({ ...form, use_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agriculture">Agriculture</SelectItem>
                    <SelectItem value="industry">Industry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="current_level">Current Level (Gallons)</Label>
                <Input
                  id="current_level"
                  type="number"
                  value={form.current_level_gallons}
                  onChange={(e) =>
                    setForm({ ...form, current_level_gallons: e.target.value })
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

      {tanks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Fuel className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No fuel tanks configured.</p>
          <p className="text-sm">Add tanks to start tracking fuel.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Fuel Type</TableHead>
              <TableHead>Use Type</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Current Level</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tanks.map((tank) => {
              const fillPercent =
                (tank.current_level_gallons / tank.capacity_gallons) * 100;
              return (
                <TableRow key={tank.id}>
                  <TableCell className="font-medium">{tank.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {tank.fuel_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        tank.use_type === "agriculture" ? "default" : "secondary"
                      }
                      className="capitalize"
                    >
                      {tank.use_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{tank.capacity_gallons.toLocaleString()} gal</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={fillPercent} className="w-20 h-2" />
                      <span className="text-sm">
                        {tank.current_level_gallons.toLocaleString()} gal (
                        {fillPercent.toFixed(0)}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tank)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
