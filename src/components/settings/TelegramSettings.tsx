import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Search, Send, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function TelegramSettings() {
  const [chatId, setChatId] = useState("");
  const [savedChatId, setSavedChatId] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadChatId();
  }, []);

  const loadChatId = async () => {
    const { data } = await supabase
      .from("notification_settings")
      .select("value")
      .eq("key", "telegram_chat_id")
      .maybeSingle();
    if (data?.value) {
      setChatId(data.value);
      setSavedChatId(data.value);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-telegram", {
        body: { action: "getUpdates" },
      });
      if (error) throw error;
      const chats = data?.chats ?? [];
      if (chats.length === 0) {
        toast.error("No se encontraron mensajes. Envía un mensaje al bot primero.");
        return;
      }
      const chat = chats[0];
      setChatId(String(chat.chat_id));
      toast.success(`Chat encontrado: ${chat.name} (${chat.chat_id})`);
    } catch (err: any) {
      toast.error(`Error descubriendo chat ID: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const handleTestMessage = async () => {
    if (!chatId) {
      toast.error("Ingresa un Chat ID primero");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-telegram", {
        body: { chat_id: chatId, message: "✅ Mensaje de prueba desde LedgerDR" },
      });
      if (error) throw error;
      toast.success("Mensaje de prueba enviado correctamente");
    } catch (err: any) {
      toast.error(`Error enviando mensaje: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    if (!chatId) {
      toast.error("Ingresa un Chat ID primero");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert({ key: "telegram_chat_id", value: chatId }, { onConflict: "key" });
      if (error) throw error;
      setSavedChatId(chatId);
      toast.success("Chat ID guardado correctamente");
    } catch (err: any) {
      toast.error(`Error guardando: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = chatId !== savedChatId;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Telegram</h3>
            <p className="text-sm text-muted-foreground">
              Configura el chat donde recibirás notificaciones
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1: Discover */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Paso 1: Descubrir Chat ID</p>
            <p className="text-sm text-muted-foreground">
              Envía cualquier mensaje a tu bot en Telegram, luego haz clic en "Descubrir".
            </p>
            <Button variant="outline" onClick={handleDiscover} disabled={discovering}>
              <Search className="mr-2 h-4 w-4" />
              {discovering ? "Buscando…" : "Descubrir Chat ID"}
            </Button>
          </div>

          {/* Step 2: Chat ID */}
          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">Chat ID</Label>
            <div className="flex gap-2">
              <Input
                id="telegram-chat-id"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Ej: 123456789"
              />
              {savedChatId && !isDirty && (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-3 shrink-0" />
              )}
            </div>
          </div>

          {/* Step 3: Test */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestMessage} disabled={sending || !chatId}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Enviando…" : "Enviar Prueba"}
            </Button>
            <Button onClick={handleSave} disabled={saving || !chatId || !isDirty}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
