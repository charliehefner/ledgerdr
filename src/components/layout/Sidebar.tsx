import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import jordLogo from "@/assets/jord-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: ArrowRightLeft },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Human Resources", href: "/hr", icon: Users },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Fuel", href: "/fuel", icon: Fuel },
  { name: "Equipment", href: "/equipment", icon: Tractor },
  { name: "Operations", href: "/operations", icon: Activity },
];

const secondaryNav = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { collapsed, toggleCollapsed } = useSidebar();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const NavItem = ({ item }: { item: typeof navigation[0] }) => {
    const link = (
      <Link
        to={item.href}
        className={cn(
          "nav-item",
          isActive(item.href) && "active",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.name}</span>}
      </Link>
    );

    if (collapsed) {
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

  return (
    <aside 
      className={cn(
        "flex h-screen flex-col bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo & Collapse Toggle */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border bg-white/95 mx-3 mt-3 rounded-lg",
        collapsed ? "justify-center px-2" : "justify-between px-3"
      )}>
        {!collapsed && <img src={jordLogo} alt="Jord Dominicana" className="h-8" />}
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {!collapsed && (
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Menu
          </div>
        )}
        {navigation.map((item) => (
          <NavItem key={item.name} item={item} />
        ))}

        <div className="my-4 border-t border-sidebar-border" />

        {!collapsed && (
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            System
          </div>
        )}
        {secondaryNav.map((item) => (
          <NavItem key={item.name} item={item} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "gap-3"
        )}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground shrink-0">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <div className="font-medium">{user?.email?.split("@")[0] || "User"}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role || 'User'}</div>
              </TooltipContent>
            )}
          </Tooltip>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.email?.split("@")[0] || "User"}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role || 'User'}</p>
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
          {collapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleLogout}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors hidden"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}
