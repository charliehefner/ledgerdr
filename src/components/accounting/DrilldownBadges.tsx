import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  resolveDrilldown,
  SOURCE_TYPE_LABEL_ES,
  SOURCE_TYPE_LABEL_EN,
  type DrilldownSourceType,
} from "@/lib/drilldown";

interface Props {
  journalId: string;
  compact?: boolean;
}

export function DrilldownBadges({ journalId, compact = false }: Props) {
  const { language } = useLanguage();
  const labels = language === "en" ? SOURCE_TYPE_LABEL_EN : SOURCE_TYPE_LABEL_ES;

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["drilldown", journalId],
    queryFn: () => resolveDrilldown(journalId),
    enabled: !!journalId,
    staleTime: 30_000,
  });

  if (isLoading || !links.length) return null;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1.5">
        {!compact && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            {language === "en" ? "Sources" : "Fuentes"}:
          </span>
        )}
        {links.map((l) => {
          const typeLabel = labels[l.source_type as DrilldownSourceType] ?? l.source_type;
          const display = l.source_label || typeLabel;
          const badge = (
            <Badge
              variant={l.state_badge === "voided" ? "destructive" : "secondary"}
              className="gap-1 cursor-pointer hover:opacity-80 transition-opacity font-mono text-[10px]"
            >
              <span className="opacity-70">{typeLabel}:</span>
              <span>{display}</span>
              {l.state_badge === "voided" && (
                <span className="ml-1 uppercase">
                  {language === "en" ? "void" : "anulado"}
                </span>
              )}
              <ExternalLink className="h-2.5 w-2.5" />
            </Badge>
          );
          return (
            <Tooltip key={l.link_id}>
              <TooltipTrigger asChild>
                {l.route ? (
                  <Link to={l.route}>{badge}</Link>
                ) : (
                  <span>{badge}</span>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="text-xs">
                  {language === "en" ? "Open source document" : "Abrir documento origen"}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
