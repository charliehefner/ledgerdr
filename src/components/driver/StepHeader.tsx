import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StepHeaderProps {
  icon: ReactNode;
  iconPosition?: "left" | "center" | "right";
  iconColor?: string;
  iconBgColor?: string;
  children?: ReactNode;
}

/**
 * Visual step header for non-readers
 * Uses large icons and positioning to communicate step purpose
 */
export function StepHeader({ 
  icon, 
  iconPosition = "center",
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  children 
}: StepHeaderProps) {
  return (
    <div className={cn(
      "flex items-center gap-4 mb-6",
      iconPosition === "left" && "justify-start",
      iconPosition === "center" && "justify-center",
      iconPosition === "right" && "justify-end"
    )}>
      <div className={cn(
        "rounded-full p-5 shadow-lg transition-transform",
        iconBgColor
      )}>
        <div className={cn("h-16 w-16", iconColor)}>
          {icon}
        </div>
      </div>
      {children && (
        <div className="flex-1">
          {children}
        </div>
      )}
    </div>
  );
}
