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
import type { ColumnConfig } from "@/hooks/useColumnVisibility";

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  visibility: Record<string, boolean>;
  onToggle: (key: string) => void;
  onReset: () => void;
}

export function ColumnSelector({
  columns,
  visibility,
  onToggle,
  onReset,
}: ColumnSelectorProps) {
  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onReset();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Select Columns</DialogTitle>
          <DialogDescription>
            Choose which columns to display in the table.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[300px] pr-4">
          <div className="space-y-3 py-2">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center space-x-3">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={visibility[col.key] !== false}
                  onCheckedChange={() => onToggle(col.key)}
                />
                <Label
                  htmlFor={`col-${col.key}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
          >
            Reset to Defaults
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
