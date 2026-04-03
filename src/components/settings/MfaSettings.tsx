import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

type MfaStatus = "loading" | "enrolled" | "not_enrolled" | "enrolling";

export function MfaSettings() {
  const [status, setStatus] = useState<MfaStatus>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  // Enrollment state
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [enrollFactorId, setEnrollFactorId] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.filter((f) => f.status === "verified") || [];
      if (verified.length > 0) {
        setFactorId(verified[0].id);
        setStatus("enrolled");
      } else {
        setStatus("not_enrolled");
      }
    } catch {
      setStatus("not_enrolled");
    }
  };

  const startEnrollment = async () => {
    setError("");
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (enrollError) throw enrollError;

      setQrUri(data.totp.uri);
      setSecret(data.totp.secret);
      setEnrollFactorId(data.id);
      setStatus("enrolling");
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar configuración MFA");
    }
  };

  const confirmEnrollment = async () => {
    if (code.length !== 6) {
      setError("Ingrese un código de 6 dígitos");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast.success("MFA activado exitosamente");
      setFactorId(enrollFactorId);
      setStatus("enrolled");
      setCode("");
      setQrUri("");
      setSecret("");
    } catch (err: any) {
      setError(err.message === "Invalid TOTP code" ? "Código inválido" : (err.message || "Error de verificación"));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (!factorId) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("MFA desactivado");
      setFactorId(null);
      setStatus("not_enrolled");
    } catch (err: any) {
      toast.error(err.message || "Error al desactivar MFA");
    } finally {
      setUnenrolling(false);
      setShowUnenrollConfirm(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Verificando estado MFA...</span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Autenticación de Dos Factores (MFA)</h3>
          <p className="text-sm text-muted-foreground">
            Agrega una capa extra de seguridad a tu cuenta
          </p>
        </div>
        {status === "enrolled" && (
          <Badge variant="default" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Activado
          </Badge>
        )}
        {status === "not_enrolled" && (
          <Badge variant="secondary" className="gap-1">
            <ShieldOff className="h-3 w-3" />
            No configurado
          </Badge>
        )}
      </div>

      {status === "enrolled" && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>MFA está activo en su cuenta</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowUnenrollConfirm(true)}
          >
            Desactivar MFA
          </Button>
        </div>
      )}

      {status === "not_enrolled" && (
        <Button onClick={startEnrollment}>
          <Shield className="h-4 w-4 mr-2" />
          Configurar MFA
        </Button>
      )}

      {status === "enrolling" && (
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Escanee el código QR con su aplicación de autenticación:
          </p>

          <div className="flex justify-center p-4 bg-white rounded-lg border w-fit mx-auto">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`}
              alt="QR Code MFA"
              className="w-44 h-44"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Código manual:</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted p-2 rounded break-all select-all">
                {secret}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(secret);
                  setCopiedSecret(true);
                  setTimeout(() => setCopiedSecret(false), 2000);
                }}
              >
                {copiedSecret ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Código de 6 dígitos</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-lg font-mono tracking-widest"
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) confirmEnrollment();
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStatus("not_enrolled");
                setCode("");
                setError("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={confirmEnrollment} disabled={verifying || code.length !== 6}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar y Activar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={showUnenrollConfirm} onOpenChange={setShowUnenrollConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar MFA?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará la autenticación de dos factores de su cuenta. Su cuenta será menos segura.
              Tendrá que configurar MFA nuevamente la próxima vez que inicie sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={unenrolling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
