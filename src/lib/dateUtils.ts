import { format } from "date-fns";

/**
 * Format a Date object to YYYY-MM-DD string in LOCAL timezone.
 * This prevents the timezone shift that occurs with toISOString().
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
 */
export function parseDateLocal(dateString: string | null | undefined): Date {
  if (!dateString) return new Date(NaN);
  const datePart = dateString.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

/**
 * Standard date format: "10 APR 2026"
 */
export const APP_DATE_FORMAT = "dd MMM yyyy";

/**
 * Standard datetime format: "10 APR 2026 14:30"
 */
export const APP_DATETIME_FORMAT = "dd MMM yyyy HH:mm";

/**
 * Format a date to the app standard: "10 APR 2026"
 */
export function fmtDate(date: Date): string {
  return format(date, APP_DATE_FORMAT).toUpperCase();
}

/**
 * Format a datetime to the app standard: "10 APR 2026 14:30"
 */
export function fmtDateTime(date: Date): string {
  return format(date, APP_DATETIME_FORMAT).toUpperCase();
}
