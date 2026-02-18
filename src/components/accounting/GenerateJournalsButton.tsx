import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useJournalGeneration } from "./useJournalGeneration";
import { FileText, Loader2 } from "lucide-react";

interface Props {
  userId?: string;
}

export function GenerateJournalsButton({ userId }: Props) {
  const { generate, countUnlinked, generating, progress } = useJournalGeneration(userId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [counting, setCounting] = useState(false);

  const handleClick = async () => {
    setCounting(true);
    try {
      const n = await countUnlinked();
      setCount(n);
      setConfirmOpen(true);
    } catch {
      // toast handled in hook
    } finally {
      setCounting(false);
    }
  };

  const handleConfirm = async () => {
    await generate();
    setConfirmOpen(false);
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleClick} disabled={counting || generating}>
        {counting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
        Generar desde Transacciones
      </Button>

      <Dialog open={confirmOpen} onOpenChange={(v) => !generating && setConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar Asientos desde Transacciones</DialogTitle>
            <DialogDescription>
              {count === 0
                ? "No hay transacciones pendientes de asiento contable."
                : `Se generarán ${count} asientos como borradores para revisión.`}
            </DialogDescription>
          </DialogHeader>

          {generating && (
            <div className="space-y-2">
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.current} / {progress.total}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={generating}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={generating || count === 0}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {generating ? "Generando..." : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
