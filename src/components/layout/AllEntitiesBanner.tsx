import { useEntity } from "@/contexts/EntityContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe } from "lucide-react";

/**
 * Shows a banner when global admin is in "All Entities" mode on data-entry pages.
 * Pass showOnAllEntities=true to display.
 */
export function AllEntitiesBanner() {
  const { isAllEntities } = useEntity();

  if (!isAllEntities) return null;

  return (
    <Alert variant="default" className="border-primary/30 bg-primary/5">
      <Globe className="h-4 w-4" />
      <AlertDescription>
        Seleccione una entidad específica para crear registros. La vista consolidada es solo para consultas y reportes.
      </AlertDescription>
    </Alert>
  );
}
