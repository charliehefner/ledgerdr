import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type MfaState = "loading" | "enroll" | "verify";

export default function MfaVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, getDefaultRoute } = useAuth();

  const [state, setState] = useState<MfaState>("loading");
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  const redirectTo = (location.state as any)?.from || getDefaultRoute();

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactors = factors?.totp || [];
      const verifiedFactors = totpFactors.filter((f) => f.status === "verified");

      if (verifiedFactors.length > 0) {
        // Has enrolled factor, needs verification
        setFactorId(verifiedFactors[0].id);
        setState("verify");
      } else {
        // No enrolled factors, show enrollment
        await startEnrollment();
      }
    } catch (err) {
      console.error("[MFA] Error checking status:", err);
      setError("Error al verificar estado MFA");
      setState("verify");
    }
  };

  const startEnrollment = async () => {
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (enrollError) throw enrollError;

      setQrUri(data.totp.uri);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setState("enroll");
    } catch (err: any) {
      console.error("[MFA] Enrollment error:", err);
      setError(err.message || "Error al configurar MFA");
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Ingrese un código de 6 dígitos");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast.success("MFA verificado exitosamente");
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error("[MFA] Verify error:", err);
      setError(err.message === "Invalid TOTP code" ? "Código inválido. Intente de nuevo." : (err.message || "Error de verificación"));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success("Secreto copiado");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>
            {state === "enroll" ? "Configurar Autenticación MFA" : "Verificación MFA"}
          </CardTitle>
          <CardDescription>
            {state === "enroll"
              ? "Escanee el código QR con su aplicación de autenticación (Google Authenticator, Authy, etc.)"
              : "Ingrese el código de 6 dígitos de su aplicación de autenticación"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {state === "enroll" && (
            <>
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                  alt="QR Code para MFA"
                  className="w-48 h-48"
                />
              </div>

              {/* Manual secret */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  ¿No puede escanear? Ingrese este código manualmente:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted p-2 rounded break-all select-all">
                    {secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={handleCopySecret}>
                    {copiedSecret ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Code input */}
          <div className="space-y-2">
            <Label>
              {state === "enroll"
                ? "Ingrese el código para confirmar la configuración"
                : "Código de verificación"}
            </Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-[0.5em] h-14"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) handleVerify();
              }}
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
            className="w-full"
          >
            {verifying ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verificando...</>
            ) : state === "enroll" ? (
              "Confirmar y Activar"
            ) : (
              "Verificar"
            )}
          </Button>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login", { replace: true });
            }}
          >
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
