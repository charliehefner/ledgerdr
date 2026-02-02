import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground gap-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      colorScheme: {
        default: "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        // Turquoise - Primary action tabs (darker text for contrast)
        turquoise: "bg-[hsl(var(--tab-turquoise-light))] text-[hsl(174_70%_25%)] hover:bg-[hsl(var(--tab-turquoise))]/20 data-[state=active]:bg-[hsl(var(--tab-turquoise))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Coral - Accent/attention tabs (darker text for contrast)
        coral: "bg-[hsl(var(--tab-coral-light))] text-[hsl(12_85%_35%)] hover:bg-[hsl(var(--tab-coral))]/20 data-[state=active]:bg-[hsl(var(--tab-coral))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Sky - Secondary tabs (darker text for contrast)
        sky: "bg-[hsl(var(--tab-sky-light))] text-[hsl(200_90%_30%)] hover:bg-[hsl(var(--tab-sky))]/20 data-[state=active]:bg-[hsl(var(--tab-sky))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Violet - Configuration/settings tabs (darker text for contrast)
        violet: "bg-[hsl(var(--tab-violet-light))] text-[hsl(270_70%_35%)] hover:bg-[hsl(var(--tab-violet))]/20 data-[state=active]:bg-[hsl(var(--tab-violet))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Lime - Success/action tabs (darker text for contrast)
        lime: "bg-[hsl(var(--tab-lime-light))] text-[hsl(82_70%_28%)] hover:bg-[hsl(var(--tab-lime))]/20 data-[state=active]:bg-[hsl(var(--tab-lime))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Legacy schemes (mapped to new colors with darker text)
        primary: "bg-[hsl(var(--tab-turquoise-light))] text-[hsl(174_70%_25%)] hover:bg-[hsl(var(--tab-turquoise))]/20 data-[state=active]:bg-[hsl(var(--tab-turquoise))] data-[state=active]:text-white data-[state=active]:shadow-md",
        secondary: "bg-[hsl(var(--tab-sky-light))] text-[hsl(200_90%_30%)] hover:bg-[hsl(var(--tab-sky))]/20 data-[state=active]:bg-[hsl(var(--tab-sky))] data-[state=active]:text-white data-[state=active]:shadow-md",
        accent: "bg-[hsl(var(--tab-coral-light))] text-[hsl(12_85%_35%)] hover:bg-[hsl(var(--tab-coral))]/20 data-[state=active]:bg-[hsl(var(--tab-coral))] data-[state=active]:text-white data-[state=active]:shadow-md",
        muted: "bg-[hsl(var(--tab-violet-light))] text-[hsl(270_70%_35%)] hover:bg-[hsl(var(--tab-violet))]/20 data-[state=active]:bg-[hsl(var(--tab-violet))] data-[state=active]:text-white data-[state=active]:shadow-md",
      },
    },
    defaultVariants: {
      colorScheme: "turquoise",
    },
  }
);

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, colorScheme, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ colorScheme, className }))}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
