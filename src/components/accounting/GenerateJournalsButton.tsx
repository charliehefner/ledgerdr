import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useJournalGeneration } from "./useJournalGeneration";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, Loader2 } from "lucide-react";

interface Props {
  userId?: string;
}

export function GenerateJournalsButton({ userId }: Props) {
  const { generate, countUnlinked, generating } = useJournalGeneration(userId);
  const { t } = useLanguage();
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

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleClick} disabled={counting || generating}>
        {counting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
        {t("accounting.generateFromTx")}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={(v) => !generating && setConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounting.generateJournalsTitle")}</DialogTitle>
            <DialogDescription>
              {count === 0
                ? t("accounting.noPendingJournals")
                : t("accounting.willGenerateDrafts").replace("{count}", String(count))}
            </DialogDescription>
          </DialogHeader>

          {generating && (
            <div className="space-y-2">
              <Progress className="h-2 animate-pulse" />
              <p className="text-xs text-muted-foreground text-center">
                Procesando en servidor…
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={generating}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={generating || count === 0}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {generating ? t("common.generating") : t("common.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
