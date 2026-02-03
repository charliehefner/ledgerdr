import { Operation, TractorEquipment } from "./types";
import { parseDateLocal } from "@/lib/dateUtils";

/**
 * Calculate hours worked for an operation
 */
export function calculateHoursValue(op: Operation): number {
  if (op.start_hours != null && op.end_hours != null) {
    return op.end_hours - op.start_hours;
  }
  return 0;
}

/**
 * Format hours for display
 */
export function calculateHoursDisplay(op: Operation): string {
  if (op.start_hours != null && op.end_hours != null) {
    return (op.end_hours - op.start_hours).toFixed(1);
  }
  return "-";
}

/**
 * Check if tractor maintenance is overdue
 */
export function checkMaintenanceOverdue(
  tractorId: string,
  tractors: TractorEquipment[] | undefined,
  tractorMaintenanceData: Map<string, number>
): { isOverdue: boolean; hoursOverdue: number } | null {
  const tractor = tractors?.find(t => t.id === tractorId);
  if (!tractor) return null;
  
  const lastMaintHours = tractorMaintenanceData.get(tractorId) ?? 0;
  const hoursSinceMaint = tractor.current_hour_meter - lastMaintHours;
  const hoursUntil = tractor.maintenance_interval_hours - hoursSinceMaint;
  
  if (hoursUntil < 0) {
    return { isOverdue: true, hoursOverdue: Math.abs(Math.round(hoursUntil)) };
  }
  return null;
}

/**
 * Check for hour meter gap with previous operation on same tractor
 */
export function checkHourMeterGap(
  tractorId: string,
  startHours: number,
  operationDate: Date,
  operations: Operation[] | undefined
): string | null {
  if (!operations || !tractorId) return null;
  
  // Find the most recent operation on this tractor before the current date
  const tractorOps = operations
    .filter(op => op.tractor_id === tractorId && op.end_hours != null)
    .filter(op => {
      const opDate = parseDateLocal(op.operation_date);
      return opDate < operationDate;
    })
    .sort((a, b) => parseDateLocal(b.operation_date).getTime() - parseDateLocal(a.operation_date).getTime());
  
  if (tractorOps.length > 0) {
    const lastOp = tractorOps[0];
    const lastEndHours = lastOp.end_hours!;
    const gap = startHours - lastEndHours;
    
    if (gap > 0.1) {
      return `Hay un vacío de ${gap.toFixed(1)} horas desde la última operación de este tractor (${lastEndHours.toFixed(1)} -> ${startHours}).`;
    }
  }
  return null;
}

/**
 * Check if operation is missing closing data
 */
export function isMissingClosingData(op: Operation): boolean {
  // For mechanical: requires end_hours (hectares_done is optional, 0 is valid)
  // For non-mechanical: no strict closure requirements
  return op.operation_types.is_mechanical ? (op.end_hours == null) : false;
}
