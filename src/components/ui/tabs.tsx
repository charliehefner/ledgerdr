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
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      colorScheme: {
        default: "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        // Turquoise - Primary action tabs
        turquoise: "bg-[hsl(var(--tab-turquoise-light))] text-[hsl(var(--tab-turquoise))] font-medium hover:bg-[hsl(var(--tab-turquoise))]/20 data-[state=active]:bg-[hsl(var(--tab-turquoise))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Coral - Accent/attention tabs  
        coral: "bg-[hsl(var(--tab-coral-light))] text-[hsl(var(--tab-coral))] font-medium hover:bg-[hsl(var(--tab-coral))]/20 data-[state=active]:bg-[hsl(var(--tab-coral))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Sky - Secondary tabs
        sky: "bg-[hsl(var(--tab-sky-light))] text-[hsl(var(--tab-sky))] font-medium hover:bg-[hsl(var(--tab-sky))]/20 data-[state=active]:bg-[hsl(var(--tab-sky))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Violet - Configuration/settings tabs
        violet: "bg-[hsl(var(--tab-violet-light))] text-[hsl(var(--tab-violet))] font-medium hover:bg-[hsl(var(--tab-violet))]/20 data-[state=active]:bg-[hsl(var(--tab-violet))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Lime - Success/action tabs
        lime: "bg-[hsl(var(--tab-lime-light))] text-[hsl(var(--tab-lime))] font-medium hover:bg-[hsl(var(--tab-lime))]/20 data-[state=active]:bg-[hsl(var(--tab-lime))] data-[state=active]:text-white data-[state=active]:shadow-md",
        // Legacy schemes (mapped to new colors)
        primary: "bg-[hsl(var(--tab-turquoise-light))] text-[hsl(var(--tab-turquoise))] font-medium hover:bg-[hsl(var(--tab-turquoise))]/20 data-[state=active]:bg-[hsl(var(--tab-turquoise))] data-[state=active]:text-white data-[state=active]:shadow-md",
        secondary: "bg-[hsl(var(--tab-sky-light))] text-[hsl(var(--tab-sky))] font-medium hover:bg-[hsl(var(--tab-sky))]/20 data-[state=active]:bg-[hsl(var(--tab-sky))] data-[state=active]:text-white data-[state=active]:shadow-md",
        accent: "bg-[hsl(var(--tab-coral-light))] text-[hsl(var(--tab-coral))] font-medium hover:bg-[hsl(var(--tab-coral))]/20 data-[state=active]:bg-[hsl(var(--tab-coral))] data-[state=active]:text-white data-[state=active]:shadow-md",
        muted: "bg-[hsl(var(--tab-violet-light))] text-[hsl(var(--tab-violet))] font-medium hover:bg-[hsl(var(--tab-violet))]/20 data-[state=active]:bg-[hsl(var(--tab-violet))] data-[state=active]:text-white data-[state=active]:shadow-md",
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
