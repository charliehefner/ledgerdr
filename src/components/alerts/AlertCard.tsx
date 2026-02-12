import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertSeverity = "urgent" | "warning" | "info";

interface AlertCardProps {
  severity: AlertSeverity;
  title: string;
  detail: string;
}

const severityConfig: Record<AlertSeverity, { icon: typeof AlertTriangle; borderColor: string; bgColor: string; iconColor: string }> = {
  urgent: {
    icon: AlertCircle,
    borderColor: "border-red-500",
    bgColor: "bg-red-50",
    iconColor: "text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-yellow-500",
    bgColor: "bg-yellow-50",
    iconColor: "text-yellow-600",
  },
  info: {
    icon: Info,
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
};

export function AlertCard({ severity, title, detail }: AlertCardProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border-l-4 p-3", config.borderColor, config.bgColor)}>
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconColor)} />
      <div className="min-w-0">
        <p className="font-medium text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      </div>
    </div>
  );
}
