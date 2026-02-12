import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import HumanResources from "./pages/HumanResources";
import Fuel from "./pages/Fuel";
import Inventory from "./pages/Inventory";
import Equipment from "./pages/Equipment";
import Operations from "./pages/Operations";
import Herbicide from "./pages/Herbicide";
import Rainfall from "./pages/Rainfall";
import Cronograma from "./pages/Cronograma";
import Alerts from "./pages/Alerts";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import DriverPortal from "./pages/DriverPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <SidebarProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/hr" element={<ProtectedRoute><HumanResources /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/fuel" element={<ProtectedRoute><Fuel /></ProtectedRoute>} />
                <Route path="/equipment" element={<ProtectedRoute><Equipment /></ProtectedRoute>} />
                <Route path="/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
                <Route path="/herbicide" element={<ProtectedRoute><Herbicide /></ProtectedRoute>} />
                <Route path="/rainfall" element={<ProtectedRoute><Rainfall /></ProtectedRoute>} />
                <Route path="/cronograma" element={<ProtectedRoute><Cronograma /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/driver-portal" element={<ProtectedRoute><DriverPortal /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SidebarProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
