import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-2">
      <div className="flex items-center gap-2 text-amber-800 text-sm">
        <WifiOff className="h-4 w-4" />
        <span className="font-medium">Modo sin conexión</span>
        <span className="text-amber-600">- Los datos se sincronizarán cuando se restablezca la conexión</span>
      </div>
    </div>
  );
}
