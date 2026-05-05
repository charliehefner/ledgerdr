import { supabase } from "@/integrations/supabase/client";

const BUCKET = "cedula-attachments";

export type CedulaKind = "jornalero" | "provider";

export async function uploadCedula(
  file: File,
  kind: CedulaKind,
  id: string,
): Promise<{ path: string; error?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const folder = kind === "jornalero" ? "jornaleros" : "providers";
  const path = `${folder}/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return { path: "", error: error.message };
  return { path };
}

export async function getCedulaSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.functions.invoke("get-signed-url", {
      body: { filePath: path, bucket: BUCKET },
    });
    if (error) {
      console.error("cedula signed url error", error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (e) {
    console.error("cedula signed url failed", e);
    return null;
  }
}
