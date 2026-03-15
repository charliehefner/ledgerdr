import { useState, useMemo } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";

interface AccountItem {
  code: string;
  desc: string;
}

interface AccountGroup {
  label: string;
  accounts: AccountItem[];
}

interface AccountSelectorProps {
  accounts: AccountItem[];
  groups?: AccountGroup[];
  hiddenCodes: Set<string>;
  onToggle: (code: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function AccountSelector({
  accounts,
  groups,
  hiddenCodes,
  onToggle,
  onShowAll,
  onHideAll,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const visibleCount = accounts.length - hiddenCodes.size;

  const renderList = (items: AccountItem[]) =>
    items.map((acc) => (
      <div key={acc.code} className="flex items-center space-x-3">
        <Checkbox
          id={`acc-${acc.code}`}
          checked={!hiddenCodes.has(acc.code)}
          onCheckedChange={() => onToggle(acc.code)}
        />
        <Label
          htmlFor={`acc-${acc.code}`}
          className="text-sm font-normal cursor-pointer flex-1"
        >
          <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
          {acc.desc}
        </Label>
      </div>
    ));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          {t("budget.accounts") || "Accounts"}
          {hiddenCodes.size > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({visibleCount}/{accounts.length})
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("budget.selectAccounts") || "Select Accounts"}</DialogTitle>
          <DialogDescription>
            {t("budget.selectAccountsDesc") || "Choose which accounts to display. Totals always include all accounts."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3 py-2">
            {groups
              ? groups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-3 first:mt-0">
                      {group.label}
                    </p>
                    {renderList(group.accounts)}
                  </div>
                ))
              : renderList(accounts)}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={onHideAll}>
            {t("common.deselectAll") || "Deselect All"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onShowAll}>
            {t("common.selectAll") || "Select All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
