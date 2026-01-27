/**
 * Format a number as currency (USD by default)
 * Uses es-DO locale for Spanish formatting
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "es-DO"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string to a readable format
 * Uses es-DO locale for Spanish formatting
 * 
 * IMPORTANT: Parses YYYY-MM-DD strings as local dates to prevent
 * timezone-related off-by-one-day errors.
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  // Parse date as local to avoid UTC timezone shift
  // "2024-01-03" should display as Jan 3, not Jan 2
  const parts = dateString.split('T')[0].split('-');
  const date = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
  return date.toLocaleDateString("es-DO", options);
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(num: number, locale: string = "es-DO"): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Get relative time string in Spanish (e.g., "Hace 2 días")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return "Hoy";
  if (diffInDays === 1) return "Ayer";
  if (diffInDays < 7) return `Hace ${diffInDays} días`;
  if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semanas`;
  if (diffInDays < 365) return `Hace ${Math.floor(diffInDays / 30)} meses`;
  return `Hace ${Math.floor(diffInDays / 365)} años`;
}
