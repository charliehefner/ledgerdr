import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { AISearchBar } from "./AISearchBar";
import { EntitySwitcher } from "./EntitySwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  headerExtra?: ReactNode;
}

export function MainLayout({ children, title, subtitle, actions, headerExtra }: MainLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 backdrop-blur-sm bg-card/95">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <MobileSidebar />
            <EntitySwitcher />
            
            {title && (
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-foreground">{title}</h1>
                  {headerExtra}
                </div>
                {subtitle && <p className="text-sm text-muted-foreground hidden sm:block">{subtitle}</p>}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* AI Search - hide on mobile */}
            {!isMobile && <AISearchBar />}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user?.email}</span>
                  <span className="hidden md:inline text-xs text-muted-foreground capitalize">({user?.role})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.email}</span>
                    <span className="text-xs font-normal text-muted-foreground capitalize">{user?.role}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("sidebar.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {actions}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6" role="main" aria-label="Main content">
          {children}
        </main>
      </div>
    </div>
  );
}
