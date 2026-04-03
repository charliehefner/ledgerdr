import { Globe, Building2, ChevronDown } from "lucide-react";
import { useEntity } from "@/contexts/EntityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function EntitySwitcher() {
  const { selectedEntityId, isGlobalAdmin, entities, setSelectedEntityId, isAllEntities } = useEntity();
  const { t } = useLanguage();

  // Entity-scoped user: show fixed label
  if (!isGlobalAdmin) {
    const entity = entities[0];
    if (!entity) return null;
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{entity.name}</span>
      </div>
    );
  }

  // Global admin: dropdown
  const currentName = isAllEntities
    ? (t("entity.allEntities") !== "entity.allEntities" ? t("entity.allEntities") : "Todas las Entidades")
    : entities.find((e) => e.id === selectedEntityId)?.name ?? "...";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[220px]">
          {isAllEntities ? (
            <Globe className="h-4 w-4 text-primary" />
          ) : (
            <Building2 className="h-4 w-4 text-primary" />
          )}
          <span className="truncate">{currentName}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          onClick={() => setSelectedEntityId(null)}
          className={isAllEntities ? "bg-accent" : ""}
        >
          <Globe className="mr-2 h-4 w-4" />
          {t("entity.allEntities") !== "entity.allEntities" ? t("entity.allEntities") : "Todas las Entidades"}
          {isAllEntities && <Badge variant="secondary" className="ml-auto text-xs">Activo</Badge>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {entities.map((entity) => (
          <DropdownMenuItem
            key={entity.id}
            onClick={() => setSelectedEntityId(entity.id)}
            className={selectedEntityId === entity.id ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="truncate">{entity.name}</span>
            <Badge variant="outline" className="ml-auto text-xs font-mono">{entity.code}</Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
