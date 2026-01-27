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
export function parseDateLocal(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
