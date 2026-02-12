import { supabase } from "@/integrations/supabase/client";
import { formatDateLocal } from "@/lib/dateUtils";
import { addDays, getDay } from "date-fns";

interface FollowUpRule {
  id: string;
  trigger_operation_type_id: string;
  followup_text: string;
  days_offset: number;
  default_driver_id: string | null;
  is_active: boolean;
}

interface ScheduleResult {
  success: boolean;
  message: string;
  scheduledDate?: string;
  timeSlot?: string;
  workerName?: string;
}

/**
 * Get the Saturday (week_ending_date) for a given date.
 * Week runs Mon-Sat, so Saturday is the end.
 */
function getSaturdayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const saturday = new Date(date);
  saturday.setDate(date.getDate() + daysUntilSaturday);
  return saturday;
}

/**
 * Convert a Date to day_of_week (1=Mon, 2=Tue, ..., 6=Sat)
 */
function toDayOfWeek(date: Date): number {
  const jsDay = getDay(date); // 0=Sun, 1=Mon, ..., 6=Sat
  if (jsDay === 0) return 7; // Sunday → 7 (overflow, won't be in schedule)
  return jsDay; // Mon=1, Tue=2, ..., Sat=6
}

const DAY_LABELS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Attempts to schedule a follow-up entry in the cronograma.
 * Finds the first available AM/PM slot for the given driver,
 * searching up to MAX_OVERFLOW_DAYS beyond the target date.
 */
export async function scheduleFollowUp(
  operationId: string,
  operationDate: string,
  fieldName: string,
  operationTypeId: string
): Promise<ScheduleResult | null> {
  const MAX_OVERFLOW_DAYS = 3;

  // 1. Check for matching follow-up rules
  const { data: rules, error: rulesError } = await supabase
    .from("operation_followups")
    .select("*")
    .eq("trigger_operation_type_id", operationTypeId)
    .eq("is_active", true);

  if (rulesError || !rules || rules.length === 0) return null;

  const results: ScheduleResult[] = [];

  for (const rule of rules as FollowUpRule[]) {
    // 2. Check for duplicate (already scheduled from this operation)
    const { data: existing } = await supabase
      .from("cronograma_entries")
      .select("id")
      .eq("source_operation_id", operationId)
      .limit(1);

    if (existing && existing.length > 0) {
      continue; // Already scheduled, skip
    }

    // 3. Resolve driver name
    let workerName = "Sin asignar";
    let workerId: string | null = null;
    if (rule.default_driver_id) {
      const { data: employee } = await supabase
        .from("employees")
        .select("id, name")
        .eq("id", rule.default_driver_id)
        .maybeSingle();
      if (employee) {
        workerName = employee.name;
        workerId = employee.id;
      }
    }

    // 4. Calculate target date
    const opDate = new Date(operationDate + "T12:00:00");
    const targetDate = addDays(opDate, rule.days_offset);

    // 5. Build follow-up text
    const followupText = rule.followup_text.replace("{field}", fieldName);

    // 6. Try to find an available slot (target day + up to MAX_OVERFLOW_DAYS)
    let placed = false;
    for (let offset = 0; offset <= MAX_OVERFLOW_DAYS; offset++) {
      const tryDate = addDays(targetDate, offset);
      const dayOfWeek = toDayOfWeek(tryDate);

      // Skip Sundays
      if (dayOfWeek === 7) continue;
      // Skip days beyond Saturday (shouldn't happen but defensive)
      if (dayOfWeek > 6) continue;

      const weekSaturday = getSaturdayOfWeek(tryDate);
      const weekEndingDate = formatDateLocal(weekSaturday);

      // Check if week is closed
      const { data: weekStatus } = await supabase
        .from("cronograma_weeks")
        .select("is_closed")
        .eq("week_ending_date", weekEndingDate)
        .maybeSingle();

      if (weekStatus?.is_closed) {
        if (offset === 0) {
          results.push({
            success: false,
            message: `Semana cerrada para ${followupText}. No se pudo programar.`,
          });
        }
        continue;
      }

      // Check existing entries for this worker on this day
      const { data: dayEntries } = await supabase
        .from("cronograma_entries")
        .select("time_slot")
        .eq("week_ending_date", weekEndingDate)
        .eq("worker_name", workerName)
        .eq("day_of_week", dayOfWeek)
        .not("task", "is", null);

      const occupiedSlots = new Set((dayEntries || []).map(e => e.time_slot));

      for (const slot of ["morning", "afternoon"] as const) {
        if (!occupiedSlots.has(slot)) {
          // Found an available slot — insert
          const { error: insertError } = await supabase
            .from("cronograma_entries")
            .insert({
              week_ending_date: weekEndingDate,
              worker_type: "employee" as const,
              worker_id: workerId,
              worker_name: workerName,
              day_of_week: dayOfWeek,
              time_slot: slot,
              task: followupText,
              is_vacation: false,
              is_holiday: false,
              source_operation_id: operationId,
            });

          if (insertError) {
            results.push({
              success: false,
              message: `Error al programar ${followupText}: ${insertError.message}`,
            });
          } else {
            const slotLabel = slot === "morning" ? "AM" : "PM";
            const dayLabel = DAY_LABELS[dayOfWeek] || "";
            const dateStr = formatDateLocal(tryDate);
            results.push({
              success: true,
              message: `Seguimiento programado: ${followupText} el ${dayLabel} ${dateStr} (${slotLabel}) para ${workerName}`,
              scheduledDate: dateStr,
              timeSlot: slotLabel,
              workerName,
            });
          }
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      results.push({
        success: false,
        message: `No se encontró espacio disponible para "${followupText}" en los próximos ${MAX_OVERFLOW_DAYS} días.`,
      });
    }
  }

  return results.length > 0 ? results[0] : null;
}
