import { cn } from "@/lib/utils";
import { Circle, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export type InvoiceStatus = "draft" | "pending" | "approved" | "paid" | "overdue";

interface StatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const statusConfig: Record<InvoiceStatus, { label: string; icon: typeof Circle; className: string }> = {
  draft: {
    label: "Draft",
    icon: Circle,
    className: "status-draft",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "status-pending",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "status-approved",
  },
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    className: "status-paid",
  },
  overdue: {
    label: "Overdue",
    icon: AlertCircle,
    className: "status-overdue",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn("status-badge", config.className, className)}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
