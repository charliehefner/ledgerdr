import type { Language } from "@/contexts/LanguageContext";

/**
 * Get description from bilingual objects based on language preference.
 * Used for database objects like accounts, projects, and CBS codes.
 */
export function getDescription(
  item: { english_description: string; spanish_description: string },
  language: Language = "es"
): string {
  return language === "en" ? item.english_description : item.spanish_description;
}
