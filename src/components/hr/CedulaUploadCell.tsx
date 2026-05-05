import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileImage, Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadCedula, getCedulaSignedUrl, type CedulaKind } from "@/lib/cedulaAttachments";

interface Props {
  kind: CedulaKind;
  recordId: string;
  table: "jornaleros" | "service_providers";
  currentPath: string | null;
  onUploaded: () => void;
  canWrite: boolean;
}

export function CedulaUploadCell({ kind, recordId, table, currentPath, onUploaded, canWrite }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleView = async () => {
    if (!currentPath) return;
    const url = await getCedulaSignedUrl(currentPath);
    if (url) window.open(url, "_blank");
    else toast({ title: "Error", description: "No se pudo cargar la cédula", variant: "destructive" });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const { path, error } = await uploadCedula(file, kind, recordId);
      if (error) throw new Error(error);
      const { error: updErr } = await supabase
        .from(table)
        .update({ cedula_attachment_url: path } as any)
        .eq("id", recordId);
      if (updErr) throw updErr;
      toast({ title: "Cédula subida" });
      onUploaded();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (currentPath) {
    return (
      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="icon" title="Ver cédula" onClick={handleView}>
          <FileImage className="h-4 w-4 text-primary" />
        </Button>
        {canWrite && (
          <>
            <Button
              variant="ghost"
              size="icon"
              title="Reemplazar cédula"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </>
        )}
      </div>
    );
  }

  if (!canWrite) return <span className="text-muted-foreground">—</span>;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        Subir
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </>
  );
}
