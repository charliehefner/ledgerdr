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
  PanelLeftClose,
  PanelLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jordLogo from "@/assets/jord-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Section, roleDisplayNames } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  section: Section;
};

const navigation: NavItem[] = [
  { name: "Panel", href: "/", icon: LayoutDashboard, section: "dashboard" },
  { name: "Transacciones", href: "/transactions", icon: ArrowRightLeft, section: "transactions" },
  { name: "Reportes", href: "/reports", icon: BarChart3, section: "reports" },
  { name: "Recursos Humanos", href: "/hr", icon: Users, section: "hr" },
  { name: "Inventario", href: "/inventory", icon: Package, section: "inventory" },
  { name: "Combustible", href: "/fuel", icon: Fuel, section: "fuel" },
  { name: "Equipos", href: "/equipment", icon: Tractor, section: "equipment" },
  { name: "Operaciones", href: "/operations", icon: Activity, section: "operations" },
];

const secondaryNav: NavItem[] = [
  { name: "Configuración", href: "/settings", icon: Settings, section: "settings" },
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
  const isMobile = useIsMobile();

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
        <item.icon className="h-5 w-5 shrink-0" />
        {(!showCollapsed || isMobile) && <span>{item.name}</span>}
      </Link>
    );

    if (showCollapsed && !isMobile) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name}
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
        "flex h-16 items-center border-b border-sidebar-border bg-white/95 mx-3 mt-3 rounded-lg",
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
            Menú
          </div>
        )}
        {filteredNavigation.map((item) => (
          <NavItemComponent key={item.name} item={item} />
        ))}

        {filteredSecondaryNav.length > 0 && (
          <>
            <div className="my-4 border-t border-sidebar-border" />

            {(!showCollapsed || isMobile) && (
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Sistema
              </div>
            )}
            {filteredSecondaryNav.map((item) => (
              <NavItemComponent key={item.name} item={item} />
            ))}
          </>
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground shrink-0">
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
        "flex h-screen flex-col bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
}
