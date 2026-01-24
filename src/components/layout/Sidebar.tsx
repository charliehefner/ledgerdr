import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  BarChart3,
  Settings,
  LogOut,
  ArrowRightLeft,
  Users,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jordLogo from "@/assets/jord-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: ArrowRightLeft },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Human Resources", href: "/hr", icon: Users },
  { name: "Inventory", href: "/inventory", icon: Package },
];

const secondaryNav = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border bg-white/95 mx-3 mt-3 rounded-lg">
        <img src={jordLogo} alt="Jord Dominicana" className="h-8" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Menu
        </div>
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "nav-item",
              isActive(item.href) && "active"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}

        <div className="my-4 border-t border-sidebar-border" />

        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          System
        </div>
        {secondaryNav.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "nav-item",
              isActive(item.href) && "active"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.email?.split("@")[0] || "User"}</p>
            <p className="text-xs text-sidebar-foreground/60">Administrator</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
