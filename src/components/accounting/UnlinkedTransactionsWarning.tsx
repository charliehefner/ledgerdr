import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUnlinkedTransactionCount } from "@/hooks/useUnlinkedTransactionCount";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  startDate?: string;
  endDate?: string;
}

export function UnlinkedTransactionsWarning({ startDate, endDate }: Props) {
  const { data: count } = useUnlinkedTransactionCount(startDate, endDate);
  const { language } = useLanguage();

  if (!count || count <= 0) return null;

  const message =
    language === "en"
      ? `${count} transaction(s) in this period have no journal entry. Financial reports may be incomplete. Generate journals to resolve.`
      : `${count} transacción(es) en este período no tienen asiento contable. Los reportes financieros pueden estar incompletos. Genere los asientos para resolver.`;

  return (
    <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800 dark:text-yellow-200">
        {message}
      </AlertDescription>
    </Alert>
  );
}
