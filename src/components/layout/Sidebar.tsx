import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  ArrowRightLeft,
  Users,
  Package,
  Fuel,
  Activity,
  Tractor,
  CloudRain,
  Bell,
  PanelLeftClose,
  PanelLeft,
  Menu,
  Languages,
  CalendarClock,
  Beaker,
  BookOpen,
  Receipt,
  Wallet,
  Landmark,
  Building2,
  Factory,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jordLogo from "@/assets/Logo_Jord.png";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Section, roleDisplayNames } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { usePendingApprovalCount } from "@/hooks/usePendingApprovalCount";

type NavItem = {
  nameKey: string;
  href: string;
  icon: typeof LayoutDashboard;
  section: Section;
};

// Section color mapping for subtle visual hints
const sectionColors: Record<Section, string> = {
  dashboard: "",
  transactions: "",
  invoices: "",
  reports: "",
  analytics: "",
  hr: "bg-section-hr",
  inventory: "bg-section-inventory",
  fuel: "bg-section-fuel",
  equipment: "bg-section-fuel",
  operations: "bg-section-operations",
  herbicide: "bg-section-operations",
  rainfall: "bg-section-rainfall",
  cronograma: "",
  alerts: "",
  settings: "",
  accounting: "",
  "ap-ar": "",
  budget: "",
  treasury: "",
  contacts: "",
  industrial: "bg-section-fuel",
  "driver-portal": "",
  approvals: "",
};

const navigation: NavItem[] = [
  { nameKey: "nav.alerts", href: "/alerts", icon: Bell, section: "alerts" },
  { nameKey: "nav.dashboard", href: "/", icon: LayoutDashboard, section: "dashboard" },
  { nameKey: "nav.transactions", href: "/transactions", icon: ArrowRightLeft, section: "transactions" },
  { nameKey: "nav.reports", href: "/reports", icon: BarChart3, section: "reports" },
  { nameKey: "nav.analytics", href: "/analytics", icon: BarChart3, section: "analytics" },
  { nameKey: "nav.accounting", href: "/accounting", icon: BookOpen, section: "accounting" },
  { nameKey: "nav.apar", href: "/accounts", icon: Receipt, section: "ap-ar" },
  { nameKey: "nav.budget", href: "/budget", icon: Wallet, section: "budget" },
  { nameKey: "nav.treasury", href: "/treasury", icon: Landmark, section: "treasury" },
  { nameKey: "nav.contacts", href: "/contacts", icon: Building2, section: "contacts" },
  { nameKey: "nav.hr", href: "/hr", icon: Users, section: "hr" },
  { nameKey: "nav.inventory", href: "/inventory", icon: Package, section: "inventory" },
  { nameKey: "nav.fuel", href: "/fuel", icon: Fuel, section: "fuel" },
  { nameKey: "nav.equipment", href: "/equipment", icon: Tractor, section: "equipment" },
  { nameKey: "nav.operations", href: "/operations", icon: Activity, section: "operations" },
  { nameKey: "nav.herbicide", href: "/herbicide", icon: Beaker, section: "herbicide" },
  { nameKey: "nav.rainfall", href: "/rainfall", icon: CloudRain, section: "rainfall" },
  { nameKey: "nav.cronograma", href: "/cronograma", icon: CalendarClock, section: "cronograma" },
  { nameKey: "nav.industrial", href: "/industrial", icon: Factory, section: "industrial" },
  { nameKey: "nav.approvals", href: "/approvals", icon: ClipboardCheck, section: "approvals" },
];

const secondaryNav: NavItem[] = [
  { nameKey: "nav.settings", href: "/settings", icon: Settings, section: "settings" },
];

// Sidebar content component (shared between desktop and mobile)
function SidebarContent({ 
  onNavigate 
}: { 
  onNavigate?: () => void 
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, canAccessSection } = useAuth();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { language, setLanguage, t } = useLanguage();
  const isMobile = useIsMobile();
  const pendingApprovalCount = usePendingApprovalCount();
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const handleNavClick = () => {
    if (onNavigate) onNavigate();
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const showCollapsed = collapsed && !isMobile;
    const itemName = t(item.nameKey);
    const sectionColor = sectionColors[item.section];
    
    const link = (
      <Link
        to={item.href}
        onClick={handleNavClick}
        className={cn(
          "nav-item",
          isActive(item.href) && "active",
          showCollapsed && "justify-center px-2"
        )}
      >
        <div className="relative">
          <item.icon className="h-5 w-5 shrink-0" />
          {sectionColor && (
            <span className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full", sectionColor)} />
          )}
          {item.section === "approvals" && pendingApprovalCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
            </span>
          )}
        </div>
        {(!showCollapsed || isMobile) && <span>{itemName}</span>}
      </Link>
    );

    if (showCollapsed && !isMobile) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {itemName}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  // Filter navigation items based on user's role permissions
  const filteredNavigation = navigation.filter(item => canAccessSection(item.section));
  const filteredSecondaryNav = secondaryNav.filter(item => canAccessSection(item.section));

  // Get Spanish role name
  const roleDisplay = user?.role ? roleDisplayNames[user.role] : "Usuario";

  const showCollapsed = collapsed && !isMobile;

  return (
    <div className="flex h-full flex-col">
      {/* Logo & Collapse Toggle */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border/50 bg-white/95 mx-3 mt-3 rounded-lg shadow-sm",
        showCollapsed ? "justify-center px-2" : "justify-between px-3"
      )}>
        {(!showCollapsed || isMobile) && <img src={jordLogo} alt="Jord Dominicana" className="h-8" />}
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {(!showCollapsed || isMobile) && (
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {t("sidebar.menu")}
          </div>
        )}
        {filteredNavigation.map((item) => (
          <NavItemComponent key={item.nameKey} item={item} />
        ))}

        {filteredSecondaryNav.length > 0 && (
          <>
            <div className="my-4 border-t border-sidebar-border" />

            {(!showCollapsed || isMobile) && (
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t("sidebar.system")}
              </div>
            )}
            {filteredSecondaryNav.map((item) => (
              <NavItemComponent key={item.nameKey} item={item} />
            ))}
          </>
        )}

        {/* Language Toggle */}
        <div className="my-4 border-t border-sidebar-border" />
        {(!showCollapsed || isMobile) ? (
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
              <Languages className="h-4 w-4" />
              <span>{t("sidebar.language")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={cn(language === "es" ? "text-sidebar-foreground font-medium" : "text-sidebar-foreground/50")}>ES</span>
              <Switch
                checked={language === "en"}
                onCheckedChange={(checked) => setLanguage(checked ? "en" : "es")}
                className="scale-75"
              />
              <span className={cn(language === "en" ? "text-sidebar-foreground font-medium" : "text-sidebar-foreground/50")}>EN</span>
            </div>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLanguage(language === "es" ? "en" : "es")}
                className="w-full flex justify-center p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              >
                <Languages className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {language === "es" ? "Switch to English" : "Cambiar a Español"}
            </TooltipContent>
          </Tooltip>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className={cn(
          "flex items-center",
          showCollapsed && !isMobile ? "justify-center" : "gap-3"
        )}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground shrink-0 ring-2 ring-primary/30">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
            </TooltipTrigger>
            {showCollapsed && !isMobile && (
              <TooltipContent side="right">
                <div className="font-medium">{user?.email?.split("@")[0] || "User"}</div>
                <div className="text-xs text-muted-foreground">{roleDisplay}</div>
              </TooltipContent>
            )}
          </Tooltip>
          {(!showCollapsed || isMobile) && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.email?.split("@")[0] || "User"}</p>
                <p className="text-xs text-sidebar-foreground/60">{roleDisplay}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile sidebar (hamburger menu with sheet)
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72 bg-sidebar">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

// Desktop sidebar
export function Sidebar() {
  const { collapsed } = useSidebar();
  const isMobile = useIsMobile();

  // On mobile, don't render the desktop sidebar
  if (isMobile) {
    return null;
  }

  return (
    <aside 
      className={cn(
        "flex h-screen flex-col bg-gradient-to-b from-sidebar to-[hsl(210,24%,12%)] transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
}
