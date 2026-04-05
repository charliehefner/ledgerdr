import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Search, Send, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ALERT_CATEGORIES = [
  { value: "all", label: "Todos", description: "Recibe todas las alertas" },
  { value: "operations", label: "Operaciones", description: "Nuevas operaciones de campo" },
  { value: "finance", label: "Finanzas", description: "Transacciones, pagos, CxP/CxC" },
  { value: "maintenance", label: "Mantenimiento", description: "Alertas de equipos" },
  { value: "inventory", label: "Inventario", description: "Alertas de stock" },
  { value: "hr", label: "RRHH", description: "Nómina, empleados" },
] as const;

type Recipient = {
  id: string;
  chat_id: string;
  label: string;
  categories: string[];
  is_active: boolean;
};

export function TelegramSettings() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);

  // Add form state
  const [newChatId, setNewChatId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCategories, setNewCategories] = useState<string[]>(["all"]);
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);

  const loadRecipients = useCallback(async () => {
    const { data, error } = await supabase
      .from("telegram_recipients" as any)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load recipients:", error);
      return;
    }
    setRecipients((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

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
      setNewChatId(String(chat.chat_id));
      if (!newLabel) setNewLabel(chat.name || "");
      toast.success(`Chat encontrado: ${chat.name} (${chat.chat_id})`);
    } catch (err: any) {
      toast.error(`Error descubriendo chat ID: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const handleAdd = async () => {
    if (!newChatId) {
      toast.error("Ingresa un Chat ID");
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase
        .from("telegram_recipients" as any)
        .insert({
          chat_id: newChatId,
          label: newLabel || newChatId,
          categories: newCategories,
          is_active: true,
        } as any);
      if (error) throw error;
      toast.success("Destinatario agregado");
      setNewChatId("");
      setNewLabel("");
      setNewCategories(["all"]);
      await loadRecipients();
    } catch (err: any) {
      toast.error(`Error agregando: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("telegram_recipients" as any)
      .update({ is_active: !isActive } as any)
      .eq("id", id);
    if (error) {
      toast.error("Error actualizando estado");
      return;
    }
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, is_active: !isActive } : r));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("telegram_recipients" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Error eliminando");
      return;
    }
    setRecipients(prev => prev.filter(r => r.id !== id));
    toast.success("Destinatario eliminado");
  };

  const handleTestMessage = async (chatId: string, label: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-telegram", {
        body: { chat_id: chatId, message: `✅ Mensaje de prueba para <b>${label}</b> desde LedgerDR` },
      });
      if (error) throw error;
      toast.success(`Mensaje enviado a ${label}`);
    } catch (err: any) {
      toast.error(`Error enviando: ${err.message}`);
    }
  };

  const toggleCategoryIn = (cat: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => {
      if (cat === "all") return ["all"];
      const without = prev.filter(c => c !== "all");
      if (without.includes(cat)) {
        const result = without.filter(c => c !== cat);
        return result.length === 0 ? ["all"] : result;
      }
      return [...without, cat];
    });
  };

  const toggleCategory = (cat: string) => toggleCategoryIn(cat, setNewCategories);

  const startEditing = (r: Recipient) => {
    setEditingId(r.id);
    setEditLabel(r.label);
    setEditCategories([...r.categories]);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("telegram_recipients" as any)
      .update({ label: editLabel, categories: editCategories } as any)
      .eq("id", editingId);
    if (error) {
      toast.error("Error actualizando destinatario");
      return;
    }
    setRecipients(prev => prev.map(r => r.id === editingId ? { ...r, label: editLabel, categories: editCategories } : r));
    toast.success("Destinatario actualizado");
    setEditingId(null);
  };

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Telegram — Destinatarios</h3>
            <p className="text-sm text-muted-foreground">
              Configura múltiples destinatarios y qué categorías de alertas recibe cada uno.
            </p>
          </div>
        </div>

        {/* Existing recipients */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">No hay destinatarios configurados.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {recipients.map((r) => (
              <div
                key={r.id}
                className={`rounded-lg border p-4 transition-colors ${r.is_active ? "bg-card" : "bg-muted/50 opacity-60"}`}
              >
                {editingId === r.id ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="max-w-xs"
                        placeholder="Nombre"
                      />
                      <span className="text-xs text-muted-foreground font-mono">{r.chat_id}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ALERT_CATEGORIES.map(cat => (
                        <label
                          key={cat.value}
                          className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            checked={editCategories.includes(cat.value)}
                            onCheckedChange={() => toggleCategoryIn(cat.value, setEditCategories)}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium">{cat.label}</span>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Check className="mr-1 h-4 w-4" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        <X className="mr-1 h-4 w-4" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{r.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">{r.chat_id}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.categories.map(cat => (
                          <span key={cat} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {ALERT_CATEGORIES.find(c => c.value === cat)?.label ?? cat}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestMessage(r.chat_id, r.label)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={() => handleToggleActive(r.id, r.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(r.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new recipient */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium">Agregar destinatario</p>

          {/* Discover */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscover} disabled={discovering}>
              <Search className="mr-2 h-4 w-4" />
              {discovering ? "Buscando…" : "Descubrir Chat ID"}
            </Button>
            <p className="text-xs text-muted-foreground self-center">
              Envía un mensaje al bot y haz clic en Descubrir.
            </p>
          </div>

          {/* Label + Chat ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-label">Nombre</Label>
              <Input
                id="new-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej: Juan, Grupo Ops"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-chat-id">Chat ID</Label>
              <Input
                id="new-chat-id"
                value={newChatId}
                onChange={(e) => setNewChatId(e.target.value)}
                placeholder="Ej: 123456789"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label>Categorías de alerta</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALERT_CATEGORIES.map(cat => (
                <label
                  key={cat.value}
                  className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={newCategories.includes(cat.value)}
                    onCheckedChange={() => toggleCategory(cat.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">{cat.label}</span>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleAdd} disabled={adding || !newChatId}>
            <Plus className="mr-2 h-4 w-4" />
            {adding ? "Agregando…" : "Agregar Destinatario"}
          </Button>
        </div>
      </div>
    </div>
  );
}
