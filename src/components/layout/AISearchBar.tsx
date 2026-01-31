import { useState, useRef, useEffect } from "react";
import { Search, Loader2, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AISearchBar() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ query: string; answer: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);
    setIsOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { query: query.trim() },
      });

      if (error) {
        console.error("AI search error:", error);
        toast.error("Error al procesar la búsqueda");
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setResult({ query: query.trim(), answer: data.answer });
    } catch (err) {
      console.error("AI search error:", err);
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  return (
    <>
      <div className="relative w-64">
        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
        <Input
          ref={inputRef}
          placeholder="Pregunta con IA..."
          className="pl-9 pr-9 bg-background"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query.trim() ? (
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Respuesta IA
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {result && (
              <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                <span className="font-medium">Pregunta:</span> {result.query}
              </div>
            )}
            
            <ScrollArea className="max-h-[50vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Analizando datos...</span>
                </div>
              ) : result ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {result.answer}
                  </div>
                </div>
              ) : null}
            </ScrollArea>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
