import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Fuel, LogOut, Wifi, WifiOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { FuelingWizard } from "@/components/driver/FuelingWizard";
import { OfflineIndicator } from "@/components/driver/OfflineIndicator";
import { SyncStatus } from "@/components/driver/SyncStatus";
import jordLogo from "@/assets/jord-logo.png";

export default function DriverPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { pendingCount, lastSyncTime } = useOfflineQueue();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<number>(0);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSubmissionComplete = () => {
    setIsWizardOpen(false);
    setRecentSubmissions(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={jordLogo} alt="Jord" className="h-8" />
            <div>
              <h1 className="font-semibold text-lg">Portal de Combustible</h1>
              <p className="text-xs text-muted-foreground">
                {user?.email?.split("@")[0] || "Conductor"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-600" />
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Offline/Sync indicators */}
        {!isOnline && <OfflineIndicator />}
        {pendingCount > 0 && <SyncStatus pendingCount={pendingCount} lastSyncTime={lastSyncTime} />}
      </header>

      {/* Main Content */}
      <main className="p-4 pb-24">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-primary">{recentSubmissions}</div>
              <p className="text-xs text-muted-foreground">Hoy</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="flex items-center justify-center gap-1">
                {pendingCount > 0 ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <span className="text-3xl font-bold text-amber-600">{pendingCount}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-3xl font-bold text-green-600">0</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
        </div>

        {/* Instructions Card */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Instrucciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Escanea el código QR del tractor</p>
            <p>2. Toma foto del horómetro</p>
            <p>3. Escanea el código QR del tanque</p>
            <p>4. Registra lecturas de la bomba</p>
            <p>5. Revisa y envía</p>
          </CardContent>
        </Card>

        {/* Fueling Wizard Modal */}
        {isWizardOpen && (
          <FuelingWizard 
            onClose={() => setIsWizardOpen(false)}
            onComplete={handleSubmissionComplete}
          />
        )}
      </main>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <Button 
          size="lg" 
          className="w-full h-14 text-lg font-semibold shadow-lg"
          onClick={() => setIsWizardOpen(true)}
        >
          <Fuel className="mr-2 h-6 w-6" />
          Registrar Combustible
        </Button>
      </div>
    </div>
  );
}
