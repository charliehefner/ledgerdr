import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";

interface InfoTooltipProps {
  translationKey: string;
}

export function InfoTooltip({ translationKey }: InfoTooltipProps) {
  const { t } = useLanguage();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help inline-block" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-sm">
          <p>{t(translationKey)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
