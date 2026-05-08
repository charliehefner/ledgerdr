import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MissingRow {
  line_id: string;
  account_code: string;
  missing_dimension: string;
}

/**
 * Calls validate_journal_line_dimensions(p_journal_id) and shows a non-blocking
 * warning toast if any required dimensions are missing on lines of the journal.
 */
export async function warnIfDimensionsMissing(journalId: string, language: "es" | "en" = "es") {
  if (!journalId) return;
  const { data, error } = await supabase.rpc("validate_journal_line_dimensions" as any, {
    p_journal_id: journalId,
  });
  if (error) {
    console.warn("[validate_journal_line_dimensions]", error);
    return;
  }
  const rows = (data ?? []) as MissingRow[];
  if (!rows.length) return;
  const accounts = Array.from(new Set(rows.map((r) => `${r.account_code} (${r.missing_dimension})`))).slice(0, 6);
  const more = rows.length > 6 ? (language === "en" ? ` +${rows.length - 6} more` : ` +${rows.length - 6} más`) : "";
  toast({
    title: language === "en" ? "Missing required dimensions" : "Faltan dimensiones requeridas",
    description: accounts.join(", ") + more,
    variant: "default",
  });
}
