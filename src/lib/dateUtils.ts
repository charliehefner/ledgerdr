/**
 * Format a Date object to YYYY-MM-DD string in LOCAL timezone.
 * This prevents the timezone shift that occurs with toISOString().
 * 
 * Example: new Date("2024-01-03") at midnight AST
 * - toISOString() → "2024-01-02T20:00:00.000Z" → split gives "2024-01-02" ❌
 * - formatDateLocal() → "2024-01-03" ✅
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date object in LOCAL timezone.
 * This prevents the date from being interpreted as UTC midnight.
 * 
 * Example: "2024-01-03"
 * - new Date("2024-01-03") → interpreted as UTC midnight → displays as Jan 2 in AST ❌
 * - parseDateLocal("2024-01-03") → local midnight → displays as Jan 3 ✅
 */
export function parseDateLocal(dateString: string | null | undefined): Date {
  if (!dateString) return new Date(NaN); // returns Invalid Date — callers should guard
  // Handle full ISO timestamps (e.g., "2024-01-03T12:00:00.000Z" or "2024-01-03 12:00:00+00")
  // by extracting just the date portion
  const datePart = dateString.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

/**
 * Standard date format used throughout the app: "10 APR 2026"
 * Use with date-fns format() then .toUpperCase(), or use the helper below.
 */
export const APP_DATE_FORMAT = "dd MMM yyyy";

/**
 * Standard datetime format: "10 APR 2026 14:30"
 */
export const APP_DATETIME_FORMAT = "dd MMM yyyy HH:mm";

/**
 * Format a date to the app standard: "10 APR 2026"
 */
export function formatAppDate(date: Date | string): string {
  const { format } = require("date-fns");
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, APP_DATE_FORMAT).toUpperCase();
}

/**
 * Format a datetime to the app standard: "10 APR 2026 14:30"
 */
export function formatAppDateTime(date: Date | string): string {
  const { format } = require("date-fns");
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, APP_DATETIME_FORMAT).toUpperCase();
}
