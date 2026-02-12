import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addYears, isBefore, differenceInDays, format } from "date-fns";
import type { AlertSeverity } from "./AlertCard";

export interface AlertItem {
  severity: AlertSeverity;
  title: string;
  detail: string;
}

interface AlertConfig {
  alert_type: string;
  is_active: boolean;
  threshold_value: number | null;
}

export function useAlertConfigurations() {
  return useQuery({
    queryKey: ["alert-configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_configurations")
        .select("*");
      if (error) throw error;
      return data as AlertConfig[];
    },
  });
}

function getConfig(configs: AlertConfig[], type: string) {
  return configs.find((c) => c.alert_type === type);
}

// ─── HR ALERTS ────────────────────────────────────────────
export function useHrAlerts(configs: AlertConfig[] | undefined) {
  const employeesQuery = useQuery({
    queryKey: ["alert-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, date_of_hire, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const vacationsQuery = useQuery({
    queryKey: ["alert-vacations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("employee_id, end_date")
        .order("end_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const isLoading = employeesQuery.isLoading || vacationsQuery.isLoading;

  const alerts: AlertItem[] = [];
  if (!configs || !employeesQuery.data || !vacationsQuery.data) return { alerts, isLoading };

  const vacConfig = getConfig(configs, "vacation_upcoming");
  if (!vacConfig?.is_active) return { alerts, isLoading };

  const thresholdDays = vacConfig.threshold_value ?? 30;
  const today = new Date();

  // Group vacations by employee, keep latest end_date
  const latestVacation = new Map<string, string>();
  for (const v of vacationsQuery.data) {
    const existing = latestVacation.get(v.employee_id);
    if (!existing || v.end_date > existing) {
      latestVacation.set(v.employee_id, v.end_date);
    }
  }

  for (const emp of employeesQuery.data) {
    const lastEnd = latestVacation.get(emp.id);
    const baseDate = lastEnd || emp.date_of_hire;
    const nextDue = addYears(new Date(baseDate), 1);
    const daysUntil = differenceInDays(nextDue, today);

    if (daysUntil < 0) {
      alerts.push({
        severity: "urgent",
        title: `Vacaciones vencidas — ${emp.name}`,
        detail: `Vencido hace ${Math.abs(daysUntil)} días (desde ${format(nextDue, "dd/MM/yyyy")})`,
      });
    } else if (daysUntil <= thresholdDays) {
      alerts.push({
        severity: "warning",
        title: `Vacaciones próximas — ${emp.name}`,
        detail: `Vence en ${daysUntil} días (${format(nextDue, "dd/MM/yyyy")})`,
      });
    }
  }

  // Sort: urgent first
  alerts.sort((a, b) => (a.severity === "urgent" ? -1 : 1));
  return { alerts, isLoading };
}

// ─── FUEL ALERTS ──────────────────────────────────────────
export function useFuelAlerts(configs: AlertConfig[] | undefined) {
  const tanksQuery = useQuery({
    queryKey: ["alert-fuel-tanks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, name, capacity_gallons, current_level_gallons, fuel_type, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const isLoading = tanksQuery.isLoading;
  const alerts: AlertItem[] = [];
  if (!configs || !tanksQuery.data) return { alerts, isLoading };

  const fuelConfig = getConfig(configs, "fuel_tank_low");
  if (!fuelConfig?.is_active) return { alerts, isLoading };

  const thresholdPct = fuelConfig.threshold_value ?? 10;

  for (const tank of tanksQuery.data) {
    if (tank.capacity_gallons <= 0) continue;
    const pct = (tank.current_level_gallons / tank.capacity_gallons) * 100;
    if (pct <= thresholdPct) {
      alerts.push({
        severity: pct <= thresholdPct / 2 ? "urgent" : "warning",
        title: `${tank.name} al ${pct.toFixed(0)}% de capacidad`,
        detail: `${tank.current_level_gallons.toFixed(0)} / ${tank.capacity_gallons.toFixed(0)} galones (${tank.fuel_type})`,
      });
    }
  }

  return { alerts, isLoading };
}

// ─── EQUIPMENT ALERTS ─────────────────────────────────────
export function useEquipmentAlerts(configs: AlertConfig[] | undefined) {
  const equipmentQuery = useQuery({
    queryKey: ["alert-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, current_hour_meter, maintenance_interval_hours, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const maintenanceQuery = useQuery({
    queryKey: ["alert-maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tractor_maintenance")
        .select("tractor_id, hour_meter_reading")
        .order("hour_meter_reading", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const isLoading = equipmentQuery.isLoading || maintenanceQuery.isLoading;
  const alerts: AlertItem[] = [];
  if (!configs || !equipmentQuery.data || !maintenanceQuery.data) return { alerts, isLoading };

  const maintConfig = getConfig(configs, "maintenance_due");
  if (!maintConfig?.is_active) return { alerts, isLoading };

  const thresholdHours = maintConfig.threshold_value ?? 20;

  // Latest maintenance per tractor
  const latestMaint = new Map<string, number>();
  for (const m of maintenanceQuery.data) {
    if (!latestMaint.has(m.tractor_id)) {
      latestMaint.set(m.tractor_id, m.hour_meter_reading);
    }
  }

  for (const eq of equipmentQuery.data) {
    const lastMaintHours = latestMaint.get(eq.id) ?? 0;
    const hoursSince = eq.current_hour_meter - lastMaintHours;
    const hoursRemaining = eq.maintenance_interval_hours - hoursSince;

    if (hoursRemaining < 0) {
      alerts.push({
        severity: "urgent",
        title: `Mantenimiento vencido — ${eq.name}`,
        detail: `Vencido por ${Math.abs(Math.round(hoursRemaining))} horas`,
      });
    } else if (hoursRemaining <= thresholdHours) {
      alerts.push({
        severity: "warning",
        title: `Mantenimiento próximo — ${eq.name}`,
        detail: `Faltan ${Math.round(hoursRemaining)} horas para mantenimiento`,
      });
    }
  }

  alerts.sort((a, b) => (a.severity === "urgent" ? -1 : 1));
  return { alerts, isLoading };
}

// ─── INVENTORY ALERTS ─────────────────────────────────────
export function useInventoryAlerts(configs: AlertConfig[] | undefined) {
  const itemsQuery = useQuery({
    queryKey: ["alert-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, commercial_name, current_quantity, minimum_stock, is_active, use_unit")
        .eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!configs,
  });

  const isLoading = itemsQuery.isLoading;
  const alerts: AlertItem[] = [];
  if (!configs || !itemsQuery.data) return { alerts, isLoading };

  const invConfig = getConfig(configs, "inventory_low");
  if (!invConfig?.is_active) return { alerts, isLoading };

  for (const item of itemsQuery.data) {
    if (item.minimum_stock != null && item.current_quantity <= item.minimum_stock) {
      alerts.push({
        severity: item.current_quantity <= 0 ? "urgent" : "warning",
        title: `Stock bajo — ${item.commercial_name}`,
        detail: `${item.current_quantity} ${item.use_unit} (mínimo: ${item.minimum_stock})`,
      });
    }
  }

  return { alerts, isLoading };
}

// ─── OPERATIONS ALERTS (Seguimientos vencidos) ────────────
export function useOperationsAlerts(configs: AlertConfig[] | undefined) {
  const entriesQuery = useQuery({
    queryKey: ["alert-overdue-followups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_entries")
        .select("id, worker_name, task, week_ending_date, day_of_week, time_slot, source_operation_id")
        .not("source_operation_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const weeksQuery = useQuery({
    queryKey: ["alert-cronograma-weeks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_weeks")
        .select("week_ending_date, is_closed");
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const isLoading = entriesQuery.isLoading || weeksQuery.isLoading;
  const alerts: AlertItem[] = [];

  if (!configs || !entriesQuery.data || !weeksQuery.data) return { alerts, isLoading };

  const followupConfig = getConfig(configs, "overdue_followups");
  if (!followupConfig?.is_active) return { alerts, isLoading };

  const closedWeeks = new Set(
    weeksQuery.data.filter((w) => w.is_closed).map((w) => w.week_ending_date)
  );

  const today = new Date();

  for (const entry of entriesQuery.data) {
    // Week is closed → assume work was completed
    if (closedWeeks.has(entry.week_ending_date)) continue;

    // Compute the actual scheduled date from week_ending_date (Saturday) and day_of_week (0=Mon..5=Sat)
    const weekEnd = new Date(entry.week_ending_date);
    const scheduledDate = addDays(weekEnd, entry.day_of_week - 5); // Sat=0 offset, Mon=-5

    const daysUntil = differenceInDays(scheduledDate, today);

    if (daysUntil < 0) {
      // Past due → red/urgent
      const daysOverdue = Math.abs(daysUntil);
      alerts.push({
        severity: "urgent",
        title: `Seguimiento vencido — ${entry.task || "Sin descripción"}`,
        detail: `${entry.worker_name} · ${format(scheduledDate, "dd/MM/yyyy")} (${entry.time_slot}) · ${daysOverdue} día${daysOverdue !== 1 ? "s" : ""} de atraso`,
      });
    } else if (daysUntil <= 5) {
      // Within 5 days → yellow/warning
      alerts.push({
        severity: "warning",
        title: `Seguimiento próximo — ${entry.task || "Sin descripción"}`,
        detail: `${entry.worker_name} · ${format(scheduledDate, "dd/MM/yyyy")} (${entry.time_slot}) · en ${daysUntil} día${daysUntil !== 1 ? "s" : ""}`,
      });
    }
  }

  alerts.sort((a, b) => (a.severity === "urgent" ? -1 : 1));
  return { alerts, isLoading };
}
