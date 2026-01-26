/**
 * Simple utility function to get Spanish description from bilingual objects.
 * Replaces the previous LanguageContext for a simpler, more performant approach.
 */
export function getDescription(item: { english_description: string; spanish_description: string }): string {
  return item.spanish_description;
}
