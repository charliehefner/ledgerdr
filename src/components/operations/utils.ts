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

/**
 * GPS Track Point for metrics calculation
 */
export interface GPSTrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
}

/**
 * Result of GPS field metrics computation
 */
export interface FieldMetrics {
  travelMinutes: number;
  fieldMinutes: number;
  downtimeMinutes: number;
  avgSpeedKmh: number;
}

/**
 * Ray-casting point-in-polygon test
 */
export function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a point is inside a GeoJSON Polygon or MultiPolygon geometry
 */
function isInsideGeometry(lat: number, lng: number, geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return geometry.coordinates.some((ring: number[][]) => pointInPolygon(lat, lng, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon: number[][][]) =>
      polygon.some((ring: number[][]) => pointInPolygon(lat, lng, ring))
    );
  }
  return false;
}

/**
 * Haversine distance between two points in meters
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute GPS-derived field metrics from track points and field boundary.
 * 
 * - travelMinutes: time from first significant movement (>250m from origin) to first point inside field
 * - fieldMinutes: time from first to last in-field point
 * - downtimeMinutes: sum of intervals where in-field speed < 0.5 km/h
 * - avgSpeedKmh: mean speed of in-field points where speed >= 0.5 km/h
 */
export function computeFieldMetrics(
  points: GPSTrackPoint[],
  fieldBoundary: any
): FieldMetrics {
  if (!points.length || !fieldBoundary) {
    return { travelMinutes: 0, fieldMinutes: 0, downtimeMinutes: 0, avgSpeedKmh: 0 };
  }

  // Sort by timestamp
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const SPEED_THRESHOLD = 0.5; // km/h
  const MOVE_THRESHOLD_M = 250; // meters from origin to count as "started moving"

  // Find start-of-day index: first point that is >250m from the very first point
  const origin = sorted[0];
  let dayStartIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (haversineMeters(origin.lat, origin.lng, sorted[i].lat, sorted[i].lng) > MOVE_THRESHOLD_M) {
      dayStartIdx = i;
      break;
    }
  }

  let firstInFieldIdx = -1;
  let lastInFieldIdx = -1;
  let downtimeMs = 0;
  const movingSpeeds: number[] = [];

  // Tag each point as in-field or not
  const inField: boolean[] = sorted.map((pt) =>
    isInsideGeometry(pt.lat, pt.lng, fieldBoundary)
  );

  for (let i = 0; i < sorted.length; i++) {
    if (inField[i]) {
      if (firstInFieldIdx === -1) firstInFieldIdx = i;
      lastInFieldIdx = i;

      const speed = sorted[i].speed ?? 0;
      if (speed >= SPEED_THRESHOLD) {
        movingSpeeds.push(speed);
      }
    }
  }

  // Calculate downtime: consecutive in-field points where speed < threshold
  for (let i = 0; i < sorted.length - 1; i++) {
    if (inField[i] && inField[i + 1]) {
      const speed = sorted[i].speed ?? 0;
      if (speed < SPEED_THRESHOLD) {
        const dt =
          new Date(sorted[i + 1].timestamp).getTime() -
          new Date(sorted[i].timestamp).getTime();
        downtimeMs += dt;
      }
    }
  }

  // Travel time: first significant movement -> first in-field point
  let travelMs = 0;
  if (firstInFieldIdx > dayStartIdx) {
    travelMs =
      new Date(sorted[firstInFieldIdx].timestamp).getTime() -
      new Date(sorted[dayStartIdx].timestamp).getTime();
  }

  // Field time: first in-field -> last in-field
  let fieldMs = 0;
  if (firstInFieldIdx >= 0 && lastInFieldIdx >= 0) {
    fieldMs =
      new Date(sorted[lastInFieldIdx].timestamp).getTime() -
      new Date(sorted[firstInFieldIdx].timestamp).getTime();
  }

  const avgSpeed =
    movingSpeeds.length > 0
      ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length
      : 0;

  return {
    travelMinutes: Math.round(travelMs / 60000),
    fieldMinutes: Math.round(fieldMs / 60000),
    downtimeMinutes: Math.round(downtimeMs / 60000),
    avgSpeedKmh: Math.round(avgSpeed * 10) / 10,
  };
}
