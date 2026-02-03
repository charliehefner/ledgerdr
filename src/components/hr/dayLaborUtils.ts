import { getDay } from "date-fns";

/**
 * Get the Friday of the week for a given date
 */
export function getFridayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const friday = new Date(date);
  friday.setDate(date.getDate() + daysUntilFriday);
  return friday;
}

/**
 * Get the Sunday (start) of the week for a given date (Sunday-Saturday week)
 */
export function getSundayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dayOfWeek);
  return sunday;
}

/**
 * Get the Saturday (end) of the week for a given date (Sunday-Saturday week)
 */
export function getSaturdayOfWeek(date: Date): Date {
  const dayOfWeek = getDay(date);
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const saturday = new Date(date);
  saturday.setDate(date.getDate() + daysUntilSaturday);
  return saturday;
}

/**
 * Calculate weekly total from entries
 */
export function calculateWeeklyTotal(entries: { amount: number }[]): number {
  return entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
}

/**
 * Format currency in Dominican Peso format
 */
export function formatDOP(amount: number): string {
  return `RD$ ${amount.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
}

/**
 * Group entries by worker name and calculate subtotals
 */
export function groupEntriesByWorker<T extends { worker_name: string; work_date: string; amount: number }>(
  entries: T[]
): { name: string; entries: T[]; subtotal: number }[] {
  const grouped: Record<string, { entries: T[]; subtotal: number }> = {};

  // Sort entries by worker name first, then by date
  const sortedEntries = [...entries].sort((a, b) => {
    const nameCompare = a.worker_name.localeCompare(b.worker_name);
    if (nameCompare !== 0) return nameCompare;
    return a.work_date.localeCompare(b.work_date);
  });

  sortedEntries.forEach((entry) => {
    const name = entry.worker_name || "Sin Nombre";
    if (!grouped[name]) {
      grouped[name] = { entries: [], subtotal: 0 };
    }
    grouped[name].entries.push(entry);
    grouped[name].subtotal += Number(entry.amount);
  });

  // Sort worker names alphabetically
  const sortedNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  return sortedNames.map((name) => ({ name, ...grouped[name] }));
}
