import { useState, useEffect } from "react";
import { HelpCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpPanelButtonProps {
  chapter: string;
}

export function HelpPanelButton({ chapter }: HelpPanelButtonProps) {
  const { language, t } = useLanguage();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState(false);

  const filePath = `/help/${language}/${chapter}.pdf`;

  // Clean up blob URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (!open) {
      // Revoke on close
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }
    setLoading(true);
    setNotFound(false);
    setBlobUrl(null);

    fetch(filePath)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("Not found");
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              aria-label={t("help.openManual")}
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("help.openManual")}</TooltipContent>
      </Tooltip>

      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="flex flex-row items-center justify-between pr-8">
          <SheetTitle>{t("help.title")}</SheetTitle>
          {blobUrl && (
            <a
              href={filePath}
              download={`${chapter}.pdf`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              {t("help.download")}
            </a>
          )}
        </SheetHeader>

        <div className="mt-4 h-[calc(100vh-6rem)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {notFound && (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{t("help.comingSoon")}</p>
              <p className="text-sm mt-1">{t("help.comingSoonDesc")}</p>
            </div>
          )}

          {blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0 rounded"
              title={t("help.title")}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}