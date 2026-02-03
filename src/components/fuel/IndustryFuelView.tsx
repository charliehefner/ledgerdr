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
import { Plus, Fuel, Zap } from "lucide-react";
import { parseDateLocal } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
  transaction_type: string;
  transaction_date: string;
  gallons: number;
  hour_meter_reading: number;
  previous_hour_meter: number;
  gallons_per_hour: number | null;
  notes: string | null;
  fuel_tanks: { name: string };
  fuel_equipment: { name: string } | null;
}

export function IndustryFuelView() {
  const [isRefillDialogOpen, setIsRefillDialogOpen] = useState(false);
  const [isReadingDialogOpen, setIsReadingDialogOpen] = useState(false);
  const [refillForm, setRefillForm] = useState({
    tank_id: "",
    gallons: "",
    notes: "",
  });
  const [readingForm, setReadingForm] = useState({
    equipment_id: "",
    hour_meter_reading: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch industry tanks
  const { data: tanks = [] } = useQuery({
    queryKey: ["fuelTanks", "industry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, current_level_gallons")
        .eq("use_type", "industry")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelTank[];
    },
  });

  // Fetch generators
  const { data: generators = [] } = useQuery({
    queryKey: ["fuelEquipment", "generator"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter")
        .eq("equipment_type", "generator")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FuelEquipment[];
    },
  });

  // Fetch recent transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions", "industry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select(`
          *,
          fuel_tanks!inner(name, use_type),
          fuel_equipment(name)
        `)
        .eq("fuel_tanks.use_type", "industry")
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as FuelTransaction[];
    },
  });

  // Get last transaction for each generator to calculate efficiency
  const getGeneratorStats = (generatorId: string) => {
    const genTransactions = transactions.filter(
      (tx) => tx.equipment_id === generatorId && tx.gallons_per_hour
    );
    if (genTransactions.length === 0) return null;
    const lastEfficiency = genTransactions[0].gallons_per_hour;
    return { lastEfficiency };
  };

  const refillMutation = useMutation({
    mutationFn: async (data: typeof refillForm) => {
      const gallons = parseFloat(data.gallons);

      // Insert refill transaction
      const { error: txError } = await supabase.from("fuel_transactions").insert({
        tank_id: data.tank_id,
        transaction_type: "refill",
        gallons,
        notes: data.notes || null,
      });
      if (txError) throw txError;

      // Update tank level
      const { data: tank } = await supabase
        .from("fuel_tanks")
        .select("current_level_gallons, capacity_gallons")
        .eq("id", data.tank_id)
        .single();

      if (tank) {
        const newLevel = Math.min(
          tank.capacity_gallons,
          tank.current_level_gallons + gallons
        );
        const { error: tankError } = await supabase
          .from("fuel_tanks")
          .update({ current_level_gallons: newLevel })
          .eq("id", data.tank_id);
        if (tankError) throw tankError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuelTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["fuelTanks"] });
      toast({
        title: "Tank refilled",
        description: "The tank refill has been recorded.",
      });
      setIsRefillDialogOpen(false);
      setRefillForm({ tank_id: "", gallons: "", notes: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const readingMutation = useMutation({
    mutationFn: async (data: typeof readingForm) => {
      const hourMeter = parseFloat(data.hour_meter_reading);

      // Get equipment's previous hour meter and find associated tank
      const { data: equipment } = await supabase
        .from("fuel_equipment")
        .select("current_hour_meter")
        .eq("id", data.equipment_id)
        .single();

      // Find the industry tank to link to (use first one for now)
      const { data: industryTank } = await supabase
        .from("fuel_tanks")
        .select("id, current_level_gallons")
        .eq("use_type", "industry")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!industryTank) {
        throw new Error("No industry tank found. Please add an industry tank first.");
      }

      const previousHourMeter = equipment?.current_hour_meter || 0;
      const hoursUsed = hourMeter - previousHourMeter;

      // Calculate gallons used since last reading by checking tank difference
      // This assumes the tank was refilled since the last reading
      const gallonsUsed = industryTank.current_level_gallons;
      const gallonsPerHour = hoursUsed > 0 ? gallonsUsed / hoursUsed : null;

      // Insert reading transaction (dispense type for consumption tracking)
      const { error: txError } = await supabase.from("fuel_transactions").insert({
        tank_id: industryTank.id,
        equipment_id: data.equipment_id,
        transaction_type: "dispense",
        gallons: gallonsUsed,
        hour_meter_reading: hourMeter,
        previous_hour_meter: previousHourMeter,
        gallons_per_hour: gallonsPerHour,
        notes: data.notes || null,
      });
      if (txError) throw txError;

      // Reset tank level (assuming it's being refilled)
      const { error: tankError } = await supabase
        .from("fuel_tanks")
        .update({ current_level_gallons: 0 })
        .eq("id", industryTank.id);
      if (tankError) throw tankError;

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
        title: "Reading recorded",
        description: "Generator hour meter and consumption has been recorded.",
      });
      setIsReadingDialogOpen(false);
      setReadingForm({ equipment_id: "", hour_meter_reading: "", notes: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedGenerator = generators.find((g) => g.id === readingForm.equipment_id);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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
        {generators.map((gen) => {
          const stats = getGeneratorStats(gen.id);
          return (
            <Card key={gen.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{gen.name}</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gen.current_hour_meter} hrs</div>
                {stats?.lastEfficiency && (
                  <p className="text-xs text-muted-foreground">
                    Last: {stats.lastEfficiency.toFixed(2)} gal/hr
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Generator Usage Log</h2>
        <div className="flex gap-2">
          <Dialog open={isRefillDialogOpen} onOpenChange={setIsRefillDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Fuel className="mr-2 h-4 w-4" />
                Record Tank Refill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Tank Refill</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!refillForm.tank_id || !refillForm.gallons) {
                    toast({
                      title: "Validation Error",
                      description: "Please fill in all required fields.",
                      variant: "destructive",
                    });
                    return;
                  }
                  refillMutation.mutate(refillForm);
                }}
                className="space-y-4"
              >
                <div>
                  <Label>Tank *</Label>
                  <Select
                    value={refillForm.tank_id}
                    onValueChange={(value) =>
                      setRefillForm({ ...refillForm, tank_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tank" />
                    </SelectTrigger>
                    <SelectContent>
                      {tanks.map((tank) => (
                        <SelectItem key={tank.id} value={tank.id}>
                          {tank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gallons Added *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={refillForm.gallons}
                    onChange={(e) =>
                      setRefillForm({ ...refillForm, gallons: e.target.value })
                    }
                    placeholder="e.g., 50"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={refillForm.notes}
                    onChange={(e) =>
                      setRefillForm({ ...refillForm, notes: e.target.value })
                    }
                    placeholder="Optional notes"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRefillDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={refillMutation.isPending}>
                    {refillMutation.isPending ? "Recording..." : "Record Refill"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isReadingDialogOpen} onOpenChange={setIsReadingDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Hour Meter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Generator Hour Meter</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!readingForm.equipment_id || !readingForm.hour_meter_reading) {
                    toast({
                      title: "Validation Error",
                      description: "Please fill in all required fields.",
                      variant: "destructive",
                    });
                    return;
                  }
                  readingMutation.mutate(readingForm);
                }}
                className="space-y-4"
              >
                <div>
                  <Label>Generator *</Label>
                  <Select
                    value={readingForm.equipment_id}
                    onValueChange={(value) =>
                      setReadingForm({ ...readingForm, equipment_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select generator" />
                    </SelectTrigger>
                    <SelectContent>
                      {generators.map((gen) => (
                        <SelectItem key={gen.id} value={gen.id}>
                          {gen.name} ({gen.current_hour_meter} hrs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedGenerator && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    <Zap className="inline h-4 w-4 mr-1" />
                    Last reading: {selectedGenerator.current_hour_meter} hrs
                  </div>
                )}

                <div>
                  <Label>Current Hour Meter *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={readingForm.hour_meter_reading}
                    onChange={(e) =>
                      setReadingForm({ ...readingForm, hour_meter_reading: e.target.value })
                    }
                    placeholder="e.g., 1500"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={readingForm.notes}
                    onChange={(e) =>
                      setReadingForm({ ...readingForm, notes: e.target.value })
                    }
                    placeholder="Optional notes"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsReadingDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={readingMutation.isPending}>
                    {readingMutation.isPending ? "Recording..." : "Record Reading"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No generator usage records yet.</p>
          <p className="text-sm">Record tank refills and hour meter readings to track consumption.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tank</TableHead>
              <TableHead>Generator</TableHead>
              <TableHead>Hour Meter</TableHead>
              <TableHead>Gallons</TableHead>
              <TableHead>Efficiency</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  {format(parseDateLocal(tx.transaction_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant={tx.transaction_type === "refill" ? "default" : "secondary"}>
                    {tx.transaction_type === "refill" ? "Refill" : "Usage"}
                  </Badge>
                </TableCell>
                <TableCell>{tx.fuel_tanks.name}</TableCell>
                <TableCell>{tx.fuel_equipment?.name || "-"}</TableCell>
                <TableCell>
                  {tx.hour_meter_reading ? `${tx.hour_meter_reading} hrs` : "-"}
                </TableCell>
                <TableCell className="font-medium">{tx.gallons.toFixed(1)} gal</TableCell>
                <TableCell>
                  {tx.gallons_per_hour ? (
                    <span className="text-primary font-medium">
                      {tx.gallons_per_hour.toFixed(2)} gal/hr
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{tx.notes || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
