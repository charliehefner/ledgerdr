import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Mail, User, Loader2 } from "lucide-react";
import { getDefaultRouteForRole, UserRole } from "@/lib/permissions";
import jordLogo from "@/assets/jord-logo.png";

// Domain used for username-based accounts (must match edge function)
const USERNAME_EMAIL_DOMAIN = "internal.jord.local";

export default function Login() {
  const [identifier, setIdentifier] = useState(""); // Can be email or username
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const { login, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Check if input looks like an email
  const isEmail = (value: string) => value.includes("@");

  // Convert username to placeholder email if needed
  const getLoginEmail = (value: string): string => {
    if (isEmail(value)) {
      return value;
    }
    // Convert username to placeholder email
    const sanitizedUsername = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${sanitizedUsername}@${USERNAME_EMAIL_DOMAIN}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const loginEmail = getLoginEmail(identifier);
      const result = await login(loginEmail, password);
      
      if (result.success) {
        toast.success("Inicio de sesión exitoso");
        // The navigation will happen via useEffect once user state updates
      } else {
        toast.error(result.error || "Usuario o contraseña inválidos");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error inesperado. Intente de nuevo.");
      setIsLoading(false);
    }
  };

  // Navigate to correct route based on role after login
  useEffect(() => {
    if (user && !isLoading) {
      const defaultRoute = getDefaultRouteForRole(user.role);
      navigate(defaultRoute);
    }
  }, [user, isLoading, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Por favor ingrese su correo electrónico");
      return;
    }
    
    setIsResetting(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("¡Correo de recuperación enviado! Revise su bandeja de entrada.");
      setShowForgotPassword(false);
    }
    
    setIsResetting(false);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img 
              src={jordLogo} 
              alt="Jord Dominicana" 
              className="mx-auto h-12 mb-4"
            />
            <CardTitle className="text-2xl">Restablecer Contraseña</CardTitle>
            <CardDescription>Ingrese su correo para recibir un enlace de recuperación</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Ingrese su correo"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isResetting}>
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Enlace de Recuperación"
                )}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                Volver al Inicio de Sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src={jordLogo} 
            alt="Jord Dominicana" 
            className="mx-auto h-12 mb-4"
          />
          <CardTitle className="text-2xl">Jord Dominicana</CardTitle>
          <CardDescription>Inicie sesión para acceder al sistema de gastos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Correo o Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Ingrese su correo o usuario"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Button 
                  type="button" 
                  variant="link" 
                  className="px-0 h-auto font-normal text-sm"
                  onClick={() => setShowForgotPassword(true)}
                >
                  ¿Olvidó su contraseña?
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
