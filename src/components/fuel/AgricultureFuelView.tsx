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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Fuel, Tractor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface FuelTank {
  id: string;
  name: string;
  current_level_gallons: number;
}

interface FuelEquipment {
  id: string;
  name: string;
  current_hour_meter: number;
}

interface FuelTransaction {
  id: string;
  tank_id: string;
  equipment_id: string;
  transaction_date: string;
  gallons: number;
  pump_start_reading: number;
  pump_end_reading: number;
  hour_meter_reading: number;
  notes: string | null;
  fuel_tanks: { name: string };
  fuel_equipment: { name: string };
}

export function AgricultureFuelView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    tank_id: "",
    equipment_id: "",
    pump_start_reading: "",
    pump_end_reading: "",
    hour_meter_reading: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch agriculture tanks
  const { data: tanks = [] } = useQuery({
    queryKey: ["fuelTanks", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, current_level_gallons")
        .eq("use_type", "agriculture")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelTank[];
    },
  });

  // Fetch tractors
  const { data: tractors = [] } = useQuery({
    queryKey: ["fuelEquipment", "tractor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelEquipment[];
    },
  });

  // Fetch recent transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select(`
          *,
          fuel_tanks!inner(name, use_type),
          fuel_equipment!inner(name, equipment_type)
        `)
        .eq("fuel_tanks.use_type", "agriculture")
        .eq("transaction_type", "dispense")
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as FuelTransaction[];
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const pumpStart = parseFloat(data.pump_start_reading);
      const pumpEnd = parseFloat(data.pump_end_reading);
      const gallons = pumpEnd - pumpStart;
      const hourMeter = parseFloat(data.hour_meter_reading);

      if (gallons <= 0) {
        throw new Error("End reading must be greater than start reading");
      }

      // Get equipment's previous hour meter
      const { data: equipment } = await supabase
        .from("fuel_equipment")
        .select("current_hour_meter")
        .eq("id", data.equipment_id)
        .single();

      // Insert transaction
      const { error: txError } = await supabase.from("fuel_transactions").insert({
        tank_id: data.tank_id,
        equipment_id: data.equipment_id,
        transaction_type: "dispense",
        gallons,
        pump_start_reading: pumpStart,
        pump_end_reading: pumpEnd,
        hour_meter_reading: hourMeter,
        previous_hour_meter: equipment?.current_hour_meter || 0,
        notes: data.notes || null,
      });
      if (txError) throw txError;

      // Update tank level
      const { data: tank } = await supabase
        .from("fuel_tanks")
        .select("current_level_gallons")
        .eq("id", data.tank_id)
        .single();

      if (tank) {
        const { error: tankError } = await supabase
          .from("fuel_tanks")
          .update({ current_level_gallons: Math.max(0, tank.current_level_gallons - gallons) })
          .eq("id", data.tank_id);
        if (tankError) throw tankError;
      }

      // Update equipment hour meter
      const { error: equipError } = await supabase
        .from("fuel_equipment")
        .update({ current_hour_meter: hourMeter })
        .eq("id", data.equipment_id);
      if (equipError) throw equipError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      queryClient.invalidateQueries({ queryKey: ["fuelEquipment"] });
      toast({
        title: "Fueling recorded",
        description: "The fuel dispensing has been recorded.",
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
      tank_id: "",
      equipment_id: "",
      pump_start_reading: "",
      pump_end_reading: "",
      hour_meter_reading: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tank_id || !form.equipment_id || !form.pump_start_reading || !form.pump_end_reading || !form.hour_meter_reading) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    dispenseMutation.mutate(form);
  };

  const calculatedGallons =
    form.pump_start_reading && form.pump_end_reading
      ? Math.max(0, parseFloat(form.pump_end_reading) - parseFloat(form.pump_start_reading))
      : 0;

  const selectedTractor = tractors.find((t) => t.id === form.equipment_id);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {tanks.map((tank) => (
          <Card key={tank.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{tank.name}</CardTitle>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tank.current_level_gallons.toLocaleString()} gal
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Record Fueling */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Recent Fueling</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Record Fueling
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Tractor Fueling</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Tank *</Label>
                <Select
                  value={form.tank_id}
                  onValueChange={(value) => setForm({ ...form, tank_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tank" />
                  </SelectTrigger>
                  <SelectContent>
                    {tanks.map((tank) => (
                      <SelectItem key={tank.id} value={tank.id}>
                        {tank.name} ({tank.current_level_gallons} gal available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tractor *</Label>
                <Select
                  value={form.equipment_id}
                  onValueChange={(value) => setForm({ ...form, equipment_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {tractors.map((tractor) => (
                      <SelectItem key={tractor.id} value={tractor.id}>
                        {tractor.name} ({tractor.current_hour_meter} hrs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTractor && (
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  <Tractor className="inline h-4 w-4 mr-1" />
                  Last hour meter: {selectedTractor.current_hour_meter} hrs
                </div>
              )}

              <div>
                <Label>Current Hour Meter Reading *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.hour_meter_reading}
                  onChange={(e) =>
                    setForm({ ...form, hour_meter_reading: e.target.value })
                  }
                  placeholder="e.g., 1234.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pump Start Reading *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.pump_start_reading}
                    onChange={(e) =>
                      setForm({ ...form, pump_start_reading: e.target.value })
                    }
                    placeholder="e.g., 5000"
                  />
                </div>
                <div>
                  <Label>Pump End Reading *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.pump_end_reading}
                    onChange={(e) =>
                      setForm({ ...form, pump_end_reading: e.target.value })
                    }
                    placeholder="e.g., 5045"
                  />
                </div>
              </div>

              {calculatedGallons > 0 && (
                <div className="text-sm font-medium text-primary bg-primary/10 p-2 rounded">
                  Gallons to dispense: {calculatedGallons.toFixed(1)}
                </div>
              )}

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
                <Button type="submit" disabled={dispenseMutation.isPending}>
                  {dispenseMutation.isPending ? "Recording..." : "Record"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tractor className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No fueling records yet.</p>
          <p className="text-sm">Record a tractor fueling to get started.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Tank</TableHead>
              <TableHead>Tractor</TableHead>
              <TableHead>Hour Meter</TableHead>
              <TableHead>Pump Start</TableHead>
              <TableHead>Pump End</TableHead>
              <TableHead>Gallons</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  {format(new Date(tx.transaction_date), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>{tx.fuel_tanks.name}</TableCell>
                <TableCell>{tx.fuel_equipment.name}</TableCell>
                <TableCell>{tx.hour_meter_reading} hrs</TableCell>
                <TableCell>{tx.pump_start_reading}</TableCell>
                <TableCell>{tx.pump_end_reading}</TableCell>
                <TableCell className="font-medium">{tx.gallons.toFixed(1)} gal</TableCell>
                <TableCell className="text-muted-foreground">{tx.notes || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
