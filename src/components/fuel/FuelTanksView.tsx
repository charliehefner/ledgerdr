import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Fuel, ArrowLeftRight, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEntityFilter } from "@/hooks/useEntityFilter";
import { Progress } from "@/components/ui/progress";

interface FuelTank {
  id: string;
  name: string;
  capacity_gallons: number;
  fuel_type: string;
  use_type: string;
  current_level_gallons: number;
  is_active: boolean;
  last_pump_end_reading: number | null;
}

export function FuelTanksView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);
  const [form, setForm] = useState({
    name: "",
    capacity_gallons: "",
    fuel_type: "diesel",
    use_type: "agriculture",
    current_level_gallons: "0",
  });
  const [transferForm, setTransferForm] = useState({
    source_tank_id: "",
    destination_tank_id: "",
    gallons: "",
    notes: "",
  });

  const [isGaugeResetOpen, setIsGaugeResetOpen] = useState(false);
  const [gaugeResetTank, setGaugeResetTank] = useState<FuelTank | null>(null);
  const [gaugeResetForm, setGaugeResetForm] = useState({ newReading: "0", notes: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { applyEntityFilter, selectedEntityId } = useEntityFilter();
  const isAdmin = user?.role === "admin" || user?.role === "management";

  const { data: tanks = [], isLoading } = useQuery({
    queryKey: ["fuelTanks", selectedEntityId],
    queryFn: async () => {
      let q: any = supabase.from("fuel_tanks").select("*").order("name");
      q = applyEntityFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data as FuelTank[];
    },
  });

  const activeTanks = tanks.filter((t) => t.is_active);

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

  const transferMutation = useMutation({
    mutationFn: async (data: typeof transferForm) => {
      const gallons = parseFloat(data.gallons);
      const sourceTank = activeTanks.find((t) => t.id === data.source_tank_id);
      const destTank = activeTanks.find((t) => t.id === data.destination_tank_id);

      if (!sourceTank || !destTank) throw new Error("Invalid tanks selected");
      if (gallons <= 0) throw new Error("Gallons must be greater than zero");
      if (gallons > sourceTank.current_level_gallons) {
        throw new Error(`Source tank only has ${sourceTank.current_level_gallons.toFixed(1)} gallons available`);
      }

      // Insert transfer transaction
      const { error: txError } = await supabase.from("fuel_transactions").insert({
        tank_id: data.source_tank_id,
        destination_tank_id: data.destination_tank_id,
        transaction_type: "transfer",
        gallons,
        notes: data.notes || `Transfer: ${sourceTank.name} → ${destTank.name}`,
      });
      if (txError) throw txError;

      // Tank levels are automatically adjusted by DB trigger trg_adjust_tank_level

      // Adjust destination pump gauge: adding fuel increases the reading
      const { data: freshDest } = await supabase
        .from("fuel_tanks")
        .select("last_pump_end_reading")
        .eq("id", data.destination_tank_id)
        .maybeSingle();
      if (freshDest) {
        const oldPumpReading = freshDest.last_pump_end_reading ?? 0;
        const newPumpReading = oldPumpReading + gallons;
        const { error } = await supabase
          .from("fuel_tanks")
          .update({ last_pump_end_reading: newPumpReading })
          .eq("id", data.destination_tank_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      toast({
        title: "Transfer completed",
        description: `${transferForm.gallons} gallons transferred successfully.`,
      });
      handleCloseTransferDialog();
    },
    onError: (error) => {
      toast({
        title: "Transfer failed",
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

  const handleCloseTransferDialog = () => {
    setIsTransferDialogOpen(false);
    setTransferForm({
      source_tank_id: "",
      destination_tank_id: "",
      gallons: "",
      notes: "",
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

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.source_tank_id || !transferForm.destination_tank_id || !transferForm.gallons) {
      toast({
        title: "Validation Error",
        description: "Please select both tanks and enter gallons.",
        variant: "destructive",
      });
      return;
    }
    if (transferForm.source_tank_id === transferForm.destination_tank_id) {
      toast({
        title: "Validation Error",
        description: "Source and destination tanks must be different.",
        variant: "destructive",
      });
      return;
    }
    transferMutation.mutate(transferForm);
  };

  const gaugeResetMutation = useMutation({
    mutationFn: async () => {
      if (!gaugeResetTank) throw new Error("No tank selected");
      const newReading = parseFloat(gaugeResetForm.newReading);
      if (isNaN(newReading) || newReading < 0) throw new Error("Invalid reading value");
      const { error } = await supabase
        .from("fuel_tanks")
        .update({ last_pump_end_reading: newReading })
        .eq("id", gaugeResetTank.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      toast({ title: "Gauge reset", description: `${gaugeResetTank?.name} gauge set to ${gaugeResetForm.newReading}.` });
      setIsGaugeResetOpen(false);
      setGaugeResetTank(null);
      setGaugeResetForm({ newReading: "0", notes: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleGaugeReset = (tank: FuelTank) => {
    setGaugeResetTank(tank);
    setGaugeResetForm({ newReading: "0", notes: "" });
    setIsGaugeResetOpen(true);
  };

  const sourceTank = activeTanks.find((t) => t.id === transferForm.source_tank_id);
  const destTanksFiltered = activeTanks.filter((t) => t.id !== transferForm.source_tank_id);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading tanks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Fuel Tanks</h2>
        <div className="flex gap-2">
          {activeTanks.length >= 2 && (
            <Button variant="outline" onClick={() => setIsTransferDialogOpen(true)}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transfer Between Tanks
            </Button>
          )}
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
      </div>

      {/* Transfer Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Transfer Between Tanks
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div>
              <Label>Source Tank *</Label>
              <Select
                value={transferForm.source_tank_id}
                onValueChange={(value) =>
                  setTransferForm({ ...transferForm, source_tank_id: value, destination_tank_id: transferForm.destination_tank_id === value ? "" : transferForm.destination_tank_id })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source tank" />
                </SelectTrigger>
                <SelectContent>
                  {activeTanks.map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      {tank.name} ({tank.current_level_gallons.toLocaleString()} gal available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destination Tank *</Label>
              <Select
                value={transferForm.destination_tank_id}
                onValueChange={(value) =>
                  setTransferForm({ ...transferForm, destination_tank_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination tank" />
                </SelectTrigger>
                <SelectContent>
                  {destTanksFiltered.map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      {tank.name} — {tank.use_type} ({tank.current_level_gallons.toLocaleString()} gal)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gallons to Transfer *</Label>
              <Input
                type="number"
                step="0.1"
                value={transferForm.gallons}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, gallons: e.target.value })
                }
                placeholder="e.g., 100"
              />
              {sourceTank && transferForm.gallons && parseFloat(transferForm.gallons) > sourceTank.current_level_gallons && (
                <p className="text-sm text-destructive mt-1">
                  Exceeds available level ({sourceTank.current_level_gallons.toFixed(1)} gal)
                </p>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={transferForm.notes}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, notes: e.target.value })
                }
                placeholder="Optional reason for transfer"
                rows={2}
              />
            </div>
            {sourceTank && transferForm.destination_tank_id && transferForm.gallons && (
              <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                <p><strong>Summary:</strong></p>
                <p>{sourceTank.name} → {activeTanks.find(t => t.id === transferForm.destination_tank_id)?.name}</p>
                <p>{parseFloat(transferForm.gallons).toFixed(1)} gallons</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseTransferDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={transferMutation.isPending}>
                {transferMutation.isPending ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
              const fillPercent = tank.capacity_gallons > 0
                ? (tank.current_level_gallons / tank.capacity_gallons) * 100
                : 0;
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tank)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reset pump gauge"
                          onClick={() => handleGaugeReset(tank)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Gauge Reset Dialog */}
      <Dialog open={isGaugeResetOpen} onOpenChange={setIsGaugeResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset Pump Gauge
            </DialogTitle>
          </DialogHeader>
          {gaugeResetTank && (
            <div className="space-y-4">
              <div>
                <Label>Tank</Label>
                <Input value={gaugeResetTank.name} disabled />
              </div>
              <div>
                <Label>Current Gauge Reading</Label>
                <Input value={(gaugeResetTank.last_pump_end_reading ?? 0).toFixed(1)} disabled />
              </div>
              <div>
                <Label>New Gauge Reading</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={gaugeResetForm.newReading}
                  onChange={(e) => setGaugeResetForm({ ...gaugeResetForm, newReading: e.target.value })}
                />
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea
                  value={gaugeResetForm.notes}
                  onChange={(e) => setGaugeResetForm({ ...gaugeResetForm, notes: e.target.value })}
                  placeholder="e.g., Supervisor reset gauge after refueling"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsGaugeResetOpen(false)}>Cancel</Button>
                <Button onClick={() => gaugeResetMutation.mutate()} disabled={gaugeResetMutation.isPending}>
                  {gaugeResetMutation.isPending ? "Resetting..." : "Reset Gauge"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
