import { ReactNode } from "react";
import { MainLayout } from "./MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabConfig {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabGroup {
  tabs: TabConfig[];
  align?: "left" | "right";
}

interface TabbedPageLayoutProps {
  title: string;
  subtitle?: string;
  activeTab: string;
  onTabChange: (value: string) => void;
  tabGroups: TabGroup[];
  actions?: ReactNode;
  hideChrome?: boolean;
}

/**
 * Shared layout component for pages that use a header + tabs pattern.
 * Reduces duplication across Operations, HR, Fuel, Equipment, etc.
 */
export function TabbedPageLayout({
  title,
  subtitle,
  activeTab,
  onTabChange,
  tabGroups,
  actions,
  hideChrome,
}: TabbedPageLayoutProps) {
  const hasMultipleGroups = tabGroups.length > 1;

  return (
    <MainLayout>
      <div className="space-y-6" role="main" aria-label={title}>
        <header className={hideChrome ? "hidden" : ""}>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </header>

        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className={`${hasMultipleGroups ? "w-full justify-between" : ""} ${hideChrome ? "hidden" : ""}`}>
            {tabGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className={`flex flex-wrap gap-1 ${
                  group.align === "right" ? "ml-auto" : ""
                }`}
              >
                {group.tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    disabled={tab.disabled}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </div>
            ))}
            {actions && <div className="ml-2">{actions}</div>}
          </TabsList>

          {tabGroups.flatMap((group) =>
            group.tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-6">
                {tab.content}
              </TabsContent>
            ))
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
