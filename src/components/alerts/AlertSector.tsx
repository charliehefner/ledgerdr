import { CheckCircle } from "lucide-react";
import { ReactNode } from "react";

interface AlertSectorProps {
  title: string;
  alertCount: number;
  children: ReactNode;
}

export function AlertSector({ title, alertCount, children }: AlertSectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          ({alertCount} {alertCount === 1 ? "alerta" : "alertas"})
        </span>
      </div>
      {alertCount === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-700">Todo en orden</p>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
