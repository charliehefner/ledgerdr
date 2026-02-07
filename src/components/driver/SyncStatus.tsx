import { Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SyncStatusProps {
  pendingCount: number;
  lastSyncTime: Date | null;
}

export function SyncStatus({ pendingCount, lastSyncTime }: SyncStatusProps) {
  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-blue-800">
          <RefreshCw className="h-4 w-4" />
          <span className="font-medium">{pendingCount} pendiente(s)</span>
        </div>
        {lastSyncTime && (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className="h-3 w-3" />
            <span className="text-xs">
              Última sync: {format(lastSyncTime, "HH:mm", { locale: es })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
