import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tractor,
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Gauge,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { parseDateLocal, fmtDate } from "@/lib/dateUtils";

type SortField = "transaction_date" | "tank" | "gallons" | "hours" | "consumption" | null;
type SortDirection = "asc" | "desc";

interface FuelTransaction {
  id: string;
  tank_id: string;
  equipment_id: string;
  transaction_date: string;
  gallons: number;
  hour_meter_reading: number;
  previous_hour_meter: number;
  notes: string | null;
  fuel_tanks: { name: string };
  fuel_equipment: { name: string };
}

interface ClosedInterval {
  startTxId: string;        // fueling N (start of interval)
  startDate: string;
  closedDate: string;
  startHours: number;
  endHours: number;
  hours: number;
  gallons: number;          // gallons added at the closing fueling N+1
  galPerHour: number;
}

export function TractorHistoryView() {
  const [selectedTractor, setSelectedTractor] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedTractor, setExpandedTractor] = useState<string | null>(null);

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
      return data;
    },
  });

  // Fetch all agriculture transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions", "agriculture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_transactions")
        .select(`
          *,
          fuel_tanks!tank_id!inner(name, use_type),
          fuel_equipment!inner(name, equipment_type)
        `)
        .eq("fuel_tanks.use_type", "agriculture")
        .eq("transaction_type", "dispense")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as FuelTransaction[];
    },
  });

  // Build per-tractor closed-interval map from the FULL (unfiltered) history.
  // Interval is closed only when the next fueling exists.
  // gal/hr at fueling N = (gallons added at N+1) / (hour_meter[N+1] - hour_meter[N])
  const { closedByStartTxId, closedByTractor } = useMemo(() => {
    const byStart = new Map<string, ClosedInterval>();
    const byTractor = new Map<string, ClosedInterval[]>();

    // Group by tractor
    const groups = new Map<string, FuelTransaction[]>();
    transactions.forEach((tx) => {
      if (!groups.has(tx.equipment_id)) groups.set(tx.equipment_id, []);
      groups.get(tx.equipment_id)!.push(tx);
    });

    groups.forEach((txs, tractorId) => {
      // Sort ascending by hour_meter_reading, then date
      const sorted = [...txs].sort((a, b) => {
        const hmA = a.hour_meter_reading ?? 0;
        const hmB = b.hour_meter_reading ?? 0;
        if (hmA !== hmB) return hmA - hmB;
        return parseDateLocal(a.transaction_date).getTime() - parseDateLocal(b.transaction_date).getTime();
      });

      const intervals: ClosedInterval[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        const hours = Math.round(((next.hour_meter_reading ?? 0) - (cur.hour_meter_reading ?? 0)) * 10) / 10;
        const gallons = Math.round((Number(next.gallons) || 0) * 10000) / 10000;
        if (hours <= 0) continue;
        const galPerHour = Math.round((gallons / hours) * 100) / 100;
        const interval: ClosedInterval = {
          startTxId: cur.id,
          startDate: cur.transaction_date,
          closedDate: next.transaction_date,
          startHours: cur.hour_meter_reading ?? 0,
          endHours: next.hour_meter_reading ?? 0,
          hours,
          gallons,
          galPerHour,
        };
        intervals.push(interval);
        byStart.set(cur.id, interval);
      }
      // newest first for the panel
      byTractor.set(tractorId, intervals.slice().reverse());
    });

    return { closedByStartTxId: byStart, closedByTractor: byTractor };
  }, [transactions]);

  // Filter by tractor and date
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (selectedTractor !== "all") {
      filtered = filtered.filter((tx) => tx.equipment_id === selectedTractor);
    }

    if (startDate || endDate) {
      filtered = filtered.filter((tx) => {
        const txDate = parseDateLocal(tx.transaction_date);
        if (startDate && endDate) {
          return isWithinInterval(txDate, {
            start: startOfDay(startDate),
            end: endOfDay(endDate),
          });
        }
        if (startDate) return txDate >= startOfDay(startDate);
        if (endDate) return txDate <= endOfDay(endDate);
        return true;
      });
    }

    return filtered;
  }, [transactions, selectedTractor, startDate, endDate]);

  // Per-row stats — gal/hr now sourced from closed-interval map (or null if interval still open)
  const transactionsWithStats = useMemo(() => {
    return filteredTransactions.map((tx) => {
      const interval = closedByStartTxId.get(tx.id);
      const hoursWorked = interval?.hours ?? 0;
      const gallons = Number(tx.gallons) || 0;
      const consumptionRate = interval?.galPerHour ?? null;
      return { ...tx, hoursWorked, consumptionRate, gallons };
    });
  }, [filteredTransactions, closedByStartTxId]);

  // Sorting
  const sortedTransactions = useMemo(() => {
    if (!sortField) return transactionsWithStats;

    return [...transactionsWithStats].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "transaction_date":
          comparison = parseDateLocal(a.transaction_date).getTime() - parseDateLocal(b.transaction_date).getTime();
          break;
        case "tank":
          comparison = (a.fuel_tanks?.name ?? "").localeCompare(b.fuel_tanks?.name ?? "");
          break;
        case "gallons":
          comparison = a.gallons - b.gallons;
          break;
        case "hours":
          comparison = a.hoursWorked - b.hoursWorked;
          break;
        case "consumption":
          comparison = (a.consumptionRate || 0) - (b.consumptionRate || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactionsWithStats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "desc") setSortDirection("asc");
      else setSortField(null);
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />;
    return sortDirection === "desc" ? <ArrowDown className="ml-1 h-4 w-4" /> : <ArrowUp className="ml-1 h-4 w-4" />;
  };

  // Per-tractor summary built from closed intervals (NOT raw rows)
  const tractorSummaries = useMemo(() => {
    // Restrict to tractors that appear in (filtered) transactions, so date/tractor filters
    // narrow which cards show, but the underlying numbers still use the full closed history.
    const visibleTractorIds = new Set(filteredTransactions.map((tx) => tx.equipment_id));

    return Array.from(visibleTractorIds).map((tractorId) => {
      const intervals = closedByTractor.get(tractorId) ?? [];
      const totalGallons = intervals.reduce((s, i) => s + i.gallons, 0);
      const totalHours = intervals.reduce((s, i) => s + i.hours, 0);
      const avgConsumption = totalHours > 0
        ? Math.round((totalGallons / totalHours) * 100) / 100
        : 0;
      const name =
        transactions.find((t) => t.equipment_id === tractorId)?.fuel_equipment?.name ?? "Unknown";
      return {
        tractorId,
        name,
        totalGallons: Math.round(totalGallons * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        avgConsumption,
        intervalsCount: intervals.length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [closedByTractor, filteredTransactions, transactions]);

  const totalGallons = sortedTransactions.reduce((sum, tx) => sum + tx.gallons, 0);
  const totalHours = sortedTransactions.reduce((sum, tx) => sum + tx.hoursWorked, 0);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {tractorSummaries.map((summary) => {
            const isOpen = expandedTractor === summary.tractorId;
            const recent = (closedByTractor.get(summary.tractorId) ?? []).slice(0, 5);
            return (
              <Card key={summary.tractorId}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) =>
                    setExpandedTractor(open ? summary.tractorId : null)
                  }
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{summary.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Tractor className="h-4 w-4 text-muted-foreground" />
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.totalGallons.toFixed(1)} gal</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{summary.totalHours.toFixed(1)} hrs</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {summary.avgConsumption.toFixed(2)} gal/hr
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Promedio sobre {summary.intervalsCount} intervalo{summary.intervalsCount === 1 ? "" : "s"} cerrado{summary.intervalsCount === 1 ? "" : "s"}
                    </p>

                    <CollapsibleContent className="pt-3">
                      <div className="border-t pt-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">
                          Últimos 5 intervalos / Last 5 intervals
                        </p>
                        {recent.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Se necesitan al menos 2 cargas para calcular consumo.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="h-7 px-2 text-[10px]">Inicio</TableHead>
                                <TableHead className="h-7 px-2 text-[10px]">Cerrado</TableHead>
                                <TableHead className="h-7 px-2 text-right text-[10px]">Hrs</TableHead>
                                <TableHead className="h-7 px-2 text-right text-[10px]">Gal</TableHead>
                                <TableHead className="h-7 px-2 text-right text-[10px]">Gal/Hr</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {recent.map((iv) => (
                                <TableRow key={iv.startTxId}>
                                  <TableCell className="px-2 py-1 text-xs">
                                    {fmtDate(parseDateLocal(iv.startDate))}
                                  </TableCell>
                                  <TableCell className="px-2 py-1 text-xs">
                                    {fmtDate(parseDateLocal(iv.closedDate))}
                                  </TableCell>
                                  <TableCell className="px-2 py-1 text-right text-xs font-mono">
                                    {iv.hours.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="px-2 py-1 text-right text-xs font-mono">
                                    {iv.gallons.toFixed(1)}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "px-2 py-1 text-right text-xs font-mono font-semibold",
                                      iv.galPerHour > 5 ? "text-destructive" : "text-primary"
                                    )}
                                  >
                                    {iv.galPerHour.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedTractor} onValueChange={setSelectedTractor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All tractors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tractors</SelectItem>
              {tractors.map((tractor) => (
                <SelectItem key={tractor.id} value={tractor.id}>
                  {tractor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? fmtDate(startDate) : "Start Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? fmtDate(endDate) : "End Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary */}
        {sortedTransactions.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {sortedTransactions.length} records | Total: <span className="font-semibold text-foreground">{totalGallons.toFixed(1)} gallons</span> over <span className="font-semibold text-foreground">{totalHours.toFixed(1)} hours (closed intervals)</span>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : sortedTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tractor className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No transactions found for selected filters.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("transaction_date")}>
                    Date {getSortIcon("transaction_date")}
                  </Button>
                </TableHead>
                <TableHead>Tractor</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("tank")}>
                    Tank {getSortIcon("tank")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("gallons")}>
                    Gallons {getSortIcon("gallons")}
                  </Button>
                </TableHead>
                <TableHead>Start Hours</TableHead>
                <TableHead>End Hours</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("hours")}>
                    Interval Hrs {getSortIcon("hours")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 hover:bg-transparent" onClick={() => handleSort("consumption")}>
                    Gal/Hr {getSortIcon("consumption")}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(parseDateLocal(tx.transaction_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{tx.fuel_equipment?.name || "-"}</TableCell>
                  <TableCell>{tx.fuel_tanks?.name || "-"}</TableCell>
                  <TableCell className="font-medium">{tx.gallons.toFixed(1)} gal</TableCell>
                  <TableCell>{(tx.previous_hour_meter ?? 0).toFixed(1)}</TableCell>
                  <TableCell>{(tx.hour_meter_reading ?? 0).toFixed(1)}</TableCell>
                  <TableCell>
                    {tx.consumptionRate != null ? `${tx.hoursWorked.toFixed(1)} hrs` : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-medium",
                      tx.consumptionRate && tx.consumptionRate > 5 ? "text-destructive" : "text-primary"
                    )}
                  >
                    {tx.consumptionRate != null ? (
                      tx.consumptionRate.toFixed(2)
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-muted-foreground">—</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Esperando próxima carga para cerrar el intervalo.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </TooltipProvider>
  );
}
