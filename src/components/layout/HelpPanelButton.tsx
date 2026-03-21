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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import ReactMarkdown from "react-markdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpPanelButtonProps {
  chapter: string;
}

export function HelpPanelButton({ chapter }: HelpPanelButtonProps) {
  const { language, t } = useLanguage();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState(false);

  const filePath = `/help/${language}/${chapter}.md`;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setNotFound(false);
    setContent(null);

    fetch(filePath)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.text();
      })
      .then((text) => {
        // Vite returns index.html for missing files in dev; detect that
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          setNotFound(true);
        } else {
          setContent(text);
        }
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

      <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl">
        <SheetHeader className="flex flex-row items-center justify-between pr-8">
          <SheetTitle>{t("help.title")}</SheetTitle>
          {content && !notFound && (
            <a
              href={filePath}
              download={`${chapter}.md`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              {t("help.download")}
            </a>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-2">
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

          {content && !notFound && (
            <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
