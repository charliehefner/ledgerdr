import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addYears, isBefore, differenceInDays, format } from "date-fns";
import { parseDateLocal, fmtDate } from "@/lib/dateUtils";
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
    const nextDue = addYears(parseDateLocal(baseDate), 1);
    const daysUntil = differenceInDays(nextDue, today);

    if (daysUntil < 0) {
      alerts.push({
        severity: "urgent",
        title: `Vacaciones vencidas — ${emp.name}`,
        detail: `Vencido hace ${Math.abs(daysUntil)} días (desde ${fmtDate(nextDue)})`,
      });
    } else if (daysUntil <= thresholdDays) {
      alerts.push({
        severity: "warning",
        title: `Vacaciones próximas — ${emp.name}`,
        detail: `Vence en ${daysUntil} días (${fmtDate(nextDue)})`,
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
        .order("maintenance_date", { ascending: false });
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
    if (closedWeeks.has(entry.week_ending_date)) continue;

    const weekEnd = parseDateLocal(entry.week_ending_date);
    const scheduledDate = addDays(weekEnd, entry.day_of_week - 5);

    const daysUntil = differenceInDays(scheduledDate, today);

    if (daysUntil < 0) {
      const daysOverdue = Math.abs(daysUntil);
      alerts.push({
        severity: "urgent",
        title: `Seguimiento vencido — ${entry.task || "Sin descripción"}`,
        detail: `${entry.worker_name} · ${fmtDate(scheduledDate)} (${entry.time_slot}) · ${daysOverdue} día${daysOverdue !== 1 ? "s" : ""} de atraso`,
      });
    } else if (daysUntil <= 5) {
      alerts.push({
        severity: "warning",
        title: `Seguimiento próximo — ${entry.task || "Sin descripción"}`,
        detail: `${entry.worker_name} · ${fmtDate(scheduledDate)} (${entry.time_slot}) · en ${daysUntil} día${daysUntil !== 1 ? "s" : ""}`,
      });
    }
  }

  alerts.sort((a, b) => (a.severity === "urgent" ? -1 : 1));
  return { alerts, isLoading };
}

// ─── GPS-OPERATIONS CROSS-VALIDATION ALERTS ───────────────
export function useOperationsGpsAlerts(configs: AlertConfig[] | undefined) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterday = addDays(today, -1);
  const yesterdayStr = format(yesterday, "yyyy-MM-dd");
  const thirtyDaysAgo = format(addDays(today, -30), "yyyy-MM-dd");

  // Alert 1: Hectares exceed field — operations from last 30 days
  const opsQuery = useQuery({
    queryKey: ["alert-ops-hectares", thirtyDaysAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select("id, operation_date, hectares_done, tractor_id, field_id, fields:fields!operations_field_id_fkey(name, hectares), operation_types:operation_types!operations_operation_type_id_fkey(name, is_mechanical)")
        .gte("operation_date", thirtyDaysAgo)
        .order("operation_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!configs,
  });

  // GPS-linked tractors
  const tractorsQuery = useQuery({
    queryKey: ["alert-gps-tractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_equipment")
        .select("id, name, gpsgate_user_id")
        .eq("equipment_type", "tractor")
        .eq("is_active", true)
        .not("gpsgate_user_id", "is", null);
      if (error) throw error;
      return data as { id: string; name: string; gpsgate_user_id: number }[];
    },
    enabled: !!configs,
  });

  // Live positions for alerts 2 & 3
  const liveQuery = useQuery({
    queryKey: ["alert-gps-live-positions"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) return [];

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/gpsgate-proxy?action=live-positions`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
        }
      );
      if (!res.ok) return [];
      return (await res.json()) as {
        tractorId: string;
        tractorName: string;
        speed: number;
        engineOn: boolean;
        lastUpdate: string;
      }[];
    },
    enabled: !!configs && !!tractorsQuery.data?.length,
    staleTime: 5 * 60 * 1000,
  });

  // Implements for Alert 4 working width
  const implementsQuery = useQuery({
    queryKey: ["alert-implements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implements")
        .select("id, name, working_width_m")
        .eq("is_active", true);
      if (error) throw error;
      return data as { id: string; name: string; working_width_m: number | null }[];
    },
    enabled: !!configs,
  });

  // Track history for Alerts 3 & 4 — fetch for recent mechanical ops with GPS tractors
  const gpsTractorIds = new Set((tractorsQuery.data ?? []).map((t) => t.id));

  const recentMechGpsOps = (opsQuery.data ?? []).filter((op: any) => {
    if (!op.tractor_id || !op.operation_types?.is_mechanical) return false;
    if (!gpsTractorIds.has(op.tractor_id)) return false;
    const opDate = op.operation_date;
    return opDate === todayStr || opDate === yesterdayStr;
  });

  // Subset with hectares for Alert 4
  const recentGpsOpsWithHa = recentMechGpsOps.filter((op: any) => op.hectares_done && op.hectares_done > 0);

  // Fetch tracks for each unique tractor/date combo (used by Alerts 3 & 4)
  const trackKeys = recentMechGpsOps.map((op: any) => `${op.tractor_id}|${op.operation_date}`);
  const uniqueTrackKeys = [...new Set(trackKeys)];

  const tracksQuery = useQuery({
    queryKey: ["alert-gps-tracks", uniqueTrackKeys],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) return {};

      const results: Record<string, { tracks: any[]; operations: any[] }> = {};
      // Serialize requests to avoid GPSGate rate limiting (429)
      for (const key of uniqueTrackKeys) {
        const [tractorId, date] = key.split("|");
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/gpsgate-proxy?action=tracks&tractorId=${tractorId}&dateFrom=${date}&dateTo=${date}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                apikey: anonKey,
              },
            }
          );
          if (res.ok) {
            results[key] = await res.json();
          }
        } catch {
          // skip failed track fetches
        }
      }
      return results;
    },
    enabled: !!configs && uniqueTrackKeys.length > 0 && !!tractorsQuery.data?.length,
    staleTime: 10 * 60 * 1000,
  });

  // Field boundaries for Alert 4
  const fieldsWithBoundaryQuery = useQuery({
    queryKey: ["alert-field-boundaries"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_fields_with_boundaries");
      if (error) throw error;
      return data as { id: string; name: string; hectares: number; boundary: any }[];
    },
    enabled: !!configs && recentGpsOpsWithHa.length > 0,
  });

  const isLoading =
    opsQuery.isLoading || tractorsQuery.isLoading || liveQuery.isLoading ||
    implementsQuery.isLoading || tracksQuery.isLoading || fieldsWithBoundaryQuery.isLoading;

  const alerts: AlertItem[] = [];
  if (!configs || !opsQuery.data) return { alerts, isLoading };

  // ── Alert 1: Hectares exceed field size ──
  const hectaresConfig = getConfig(configs, "hectares_exceed_field");
  if (hectaresConfig?.is_active) {
    for (const op of opsQuery.data) {
      const fieldHa = op.fields?.hectares;
      if (fieldHa && fieldHa > 0 && op.hectares_done && op.hectares_done > fieldHa) {
        alerts.push({
          severity: "warning",
          title: `${op.fields.name}: ${op.hectares_done} ha registradas pero el campo tiene ${fieldHa} ha`,
          detail: `${op.operation_types?.name || "Operación"} — ${fmtDate(parseDateLocal(op.operation_date))}`,
        });
      }
    }
  }

  // ── Alert 2: Unrecorded tractor activity ──
  const unrecordedConfig = getConfig(configs, "gps_unrecorded_activity");
  if (unrecordedConfig?.is_active && liveQuery.data && tractorsQuery.data) {
    const currentHour = today.getHours();

    for (const pos of liveQuery.data) {
      if (!pos.lastUpdate) continue;
      const lastUpdateDate = new Date(pos.lastUpdate);
      const lastUpdateStr = format(lastUpdateDate, "yyyy-MM-dd");
      const hadActivity = pos.speed > 0 || pos.engineOn;
      if (!hadActivity) continue;

      // Check yesterday
      if (lastUpdateStr === yesterdayStr) {
        const hasOp = opsQuery.data.some(
          (op: any) => op.tractor_id === pos.tractorId && op.operation_date === yesterdayStr
        );
        if (!hasOp) {
          alerts.push({
            severity: "urgent",
            title: `${pos.tractorName} tuvo actividad GPS ayer pero no tiene operación registrada`,
            detail: fmtDate(yesterday),
          });
        }
      }

      // Check today (only after 19:00)
      if (lastUpdateStr === todayStr && currentHour >= 19) {
        const hasOp = opsQuery.data.some(
          (op: any) => op.tractor_id === pos.tractorId && op.operation_date === todayStr
        );
        if (!hasOp) {
          alerts.push({
            severity: "warning",
            title: `${pos.tractorName} tuvo actividad GPS hoy pero no tiene operación registrada`,
            detail: fmtDate(today),
          });
        }
      }
    }
  }

  // ── Alert 3: Operation without GPS movement (uses track history) ──
  const noMovementConfig = getConfig(configs, "gps_no_movement");
  if (noMovementConfig?.is_active && tracksQuery.data && !tracksQuery.isFetching && tractorsQuery.data) {
    // Deduplicate by tractor+date — one alert per tractor per day
    const checkedKeys = new Set<string>();
    for (const op of recentMechGpsOps) {
      const key = `${op.tractor_id}|${op.operation_date}`;
      if (checkedKeys.has(key)) continue;
      checkedKeys.add(key);

      const trackData = tracksQuery.data[key];

      // Only flag if we explicitly fetched this key and got no tracks
      // (undefined means the fetch hasn't happened yet — don't flag)
      if (trackData === undefined) continue;

      const hasMovement = trackData?.tracks?.some((t: any) => t.speed > 0);
      if (!hasMovement) {
        const tractor = tractorsQuery.data.find((t: any) => t.id === op.tractor_id);
        // Collect field names for this tractor/date
        const fieldNames = recentMechGpsOps
          .filter((o: any) => o.tractor_id === op.tractor_id && o.operation_date === op.operation_date)
          .map((o: any) => o.fields?.name)
          .filter(Boolean);
        const uniqueFields = [...new Set(fieldNames)].join(", ");
        alerts.push({
          severity: "warning",
          title: `${tractor?.name || "Tractor"} registra operación el ${format(parseDateLocal(op.operation_date), "dd/MM")} pero GPS no muestra movimiento`,
          detail: uniqueFields || "Sin campo",
        });
      }
    }
  }

  // ── Alert 4: Hectares mismatch vs GPS estimate ──
  const mismatchConfig = getConfig(configs, "gps_hectares_mismatch");
  if (mismatchConfig?.is_active && tracksQuery.data && fieldsWithBoundaryQuery.data && implementsQuery.data) {
    const tolerance = (mismatchConfig.threshold_value ?? 30) / 100;
    const fieldMap = new Map(fieldsWithBoundaryQuery.data.map((f) => [f.id, f]));
    const implementMap = new Map(implementsQuery.data.map((i) => [i.id, i]));

    for (const op of recentGpsOpsWithHa) {
      const key = `${op.tractor_id}|${op.operation_date}`;
      const trackData = tracksQuery.data[key];
      if (!trackData?.tracks?.length) continue;

      const field = fieldMap.get(op.field_id);
      if (!field?.boundary) continue;

      const implement = op.implement_id ? implementMap.get(op.implement_id) : null;
      const workingWidth = implement?.working_width_m;
      if (!workingWidth || workingWidth <= 0) continue;

      // Calculate total distance from track points
      let totalDistanceM = 0;
      const pts = trackData.tracks;
      for (let i = 1; i < pts.length; i++) {
        totalDistanceM += haversineDistance(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
      }

      const gpsHectares = (totalDistanceM * workingWidth) / 10000;
      if (gpsHectares <= 0) continue;

      const diff = Math.abs(op.hectares_done - gpsHectares) / gpsHectares;
      if (diff > tolerance) {
        alerts.push({
          severity: "warning",
          title: `${op.fields?.name || "Campo"} ${op.operation_types?.name || ""}: ${op.hectares_done} ha registradas vs ~${gpsHectares.toFixed(1)} ha estimadas por GPS`,
          detail: `${fmtDate(parseDateLocal(op.operation_date))} · Diferencia: ${(diff * 100).toFixed(0)}%`,
        });
      }
    }
  }

  alerts.sort((a, b) => (a.severity === "urgent" ? -1 : 1));
  return { alerts, isLoading };
}

// ─── AP/AR OVERDUE ALERTS ─────────────────────────────────
export function useApArOverdueAlerts(configs: AlertConfig[] | undefined, entityId: string | null) {
  const agingQuery = useQuery({
    queryKey: ["alert-ap-ar-aging", entityId],
    queryFn: async () => {
      let query = supabase.from("v_ap_ar_aging").select("*");
      if (entityId) query = query.eq("entity_id", entityId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const isLoading = agingQuery.isLoading;
  const alerts: AlertItem[] = [];
  if (!configs || !agingQuery.data) return { alerts, isLoading };

  const overdueConfig = getConfig(configs, "ap_ar_overdue");
  if (!overdueConfig?.is_active) return { alerts, isLoading };

  const thresholdDays = overdueConfig.threshold_value ?? 0;
  const overdue = agingQuery.data.filter((r) => (r.days_overdue ?? 0) > thresholdDays);
  if (!overdue.length) return { alerts, isLoading };

  // Group by aging bucket
  const buckets: Record<string, { count: number; total: number }> = {};
  for (const r of overdue) {
    const bucket = r.aging_bucket ?? "Unknown";
    if (!buckets[bucket]) buckets[bucket] = { count: 0, total: 0 };
    buckets[bucket].count++;
    buckets[bucket].total += (r as any).balance_remaining ?? ((r.total_amount ?? 0) - ((r as any).amount_paid ?? 0));
  }

  // 1-30
  const b130 = buckets["1-30"];
  if (b130) {
    alerts.push({
      severity: "warning",
      title: `${b130.count} cuentas por cobrar/pagar 1–30 días vencidas`,
      detail: `Total: RD$${b130.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
    });
  }

  // 31-60
  const b3160 = buckets["31-60"];
  if (b3160) {
    alerts.push({
      severity: "warning",
      title: `${b3160.count} cuentas por cobrar/pagar 31–60 días vencidas`,
      detail: `Total: RD$${b3160.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
    });
  }

  // 61-90 and 90+
  const over60Count = (buckets["61-90"]?.count ?? 0) + (buckets["90+"]?.count ?? 0);
  const over60Total = (buckets["61-90"]?.total ?? 0) + (buckets["90+"]?.total ?? 0);
  if (over60Count > 0) {
    alerts.push({
      severity: "urgent",
      title: `${over60Count} cuentas por cobrar/pagar 60+ días vencidas`,
      detail: `Total: RD$${over60Total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
    });
  }

  alerts.sort((a, b) => (a.severity === "urgent" ? -1 : 1));
  return { alerts, isLoading };
}

// ─── PAYROLL PERIOD APPROACHING ALERTS ────────────────────
export function usePayrollApproachingAlerts(configs: AlertConfig[] | undefined) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const periodsQuery = useQuery({
    queryKey: ["alert-payroll-periods-approaching"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("id, end_date, start_date, status")
        .eq("status", "open");
      if (error) throw error;
      return data;
    },
    enabled: !!configs,
  });

  const snapshotsQuery = useQuery({
    queryKey: ["alert-payroll-snapshots-count"],
    queryFn: async () => {
      if (!periodsQuery.data?.length) return {};
      const counts: Record<string, number> = {};
      for (const p of periodsQuery.data) {
        const { count, error } = await supabase
          .from("payroll_snapshots")
          .select("id", { count: "exact", head: true })
          .eq("period_id", p.id);
        if (!error) counts[p.id] = count ?? 0;
      }
      return counts;
    },
    enabled: !!configs && !!periodsQuery.data?.length,
  });

  const isLoading = periodsQuery.isLoading || snapshotsQuery.isLoading;
  const alerts: AlertItem[] = [];
  if (!configs || !periodsQuery.data || !snapshotsQuery.data) return { alerts, isLoading };

  const payrollConfig = getConfig(configs, "payroll_period_approaching");
  if (!payrollConfig?.is_active) return { alerts, isLoading };

  const thresholdDays = payrollConfig.threshold_value ?? 3;

  for (const period of periodsQuery.data) {
    const endDate = parseDateLocal(period.end_date);
    const daysUntil = differenceInDays(endDate, today);
    const periodLabel = `${format(parseDateLocal(period.start_date), "dd/MM")}–${fmtDate(endDate)}`;

    if (daysUntil <= thresholdDays && daysUntil >= -7) {
      const snapCount = snapshotsQuery.data[period.id] ?? 0;
      if (snapCount === 0) {
        alerts.push({
          severity: daysUntil < 0 ? "urgent" : "warning",
          title: daysUntil < 0
            ? `Período de nómina ${periodLabel} venció hace ${Math.abs(daysUntil)} día(s) — sin procesar`
            : `Período de nómina ${periodLabel} vence el ${fmtDate(endDate)} — sin procesar`,
          detail: "Ir a Nómina para revisar y procesar",
        });
      }
    }
  }

  return { alerts, isLoading };
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
