import { ReactNode } from "react";
import { MainLayout } from "./MainLayout";
import { HelpPanelButton } from "./HelpPanelButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabConfig {
  value: string;
  label: string;
  icon?: ReactNode;
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
  headerIcon?: ReactNode;
  headerAccent?: boolean;
}

/**
 * Shared layout component for pages that use a header + tabs pattern.
 */
export function TabbedPageLayout({
  title,
  subtitle,
  activeTab,
  onTabChange,
  tabGroups,
  actions,
  hideChrome,
  headerIcon,
  headerAccent,
}: TabbedPageLayoutProps) {
  const hasMultipleGroups = tabGroups.length > 1;

  return (
    <MainLayout>
      <div className="space-y-6" role="main" aria-label={title}>
        <header
          className={`${hideChrome ? "hidden" : ""} ${
            headerAccent
              ? "flex items-center gap-3 rounded-lg border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent px-4 py-4"
              : ""
          }`}
        >
          {headerIcon && headerAccent && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              {headerIcon}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={onTabChange}>
          <div className={hideChrome ? "hidden" : "border-b border-border pb-0"}>
            <TabsList className={`${hasMultipleGroups ? "w-full justify-between" : ""}`}>
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
                      className="gap-1.5"
                    >
                      {tab.icon}
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </div>
              ))}
              {actions && <div className="ml-2">{actions}</div>}
            </TabsList>
          </div>

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
