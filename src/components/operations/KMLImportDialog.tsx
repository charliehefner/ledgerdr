import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseKMLFile, ParsedPlacemark } from "./kmlParser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

interface KMLImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MatchedPlacemark {
  placemark: ParsedPlacemark;
  field: { id: string; name: string; farm_name: string } | null;
}

export function KMLImportDialog({ open, onOpenChange }: KMLImportDialogProps) {
  const [matches, setMatches] = useState<MatchedPlacemark[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fields } = useQuery({
    queryKey: ["fields-for-kml"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fields")
        .select("id, name, farms(name)")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; farms: { name: string } }[];
    },
    enabled: open,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const placemarks = await parseKMLFile(file);
      const matched: MatchedPlacemark[] = placemarks.map((pm) => {
        const match = fields?.find(
          (f) => f.name.toLowerCase() === pm.name.toLowerCase()
        );
        return {
          placemark: pm,
          field: match
            ? { id: match.id, name: match.name, farm_name: match.farms.name }
            : null,
        };
      });
      setMatches(matched);
    } catch (err: any) {
      toast({
        title: "Error parsing file",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const matchedCount = matches.filter((m) => m.field).length;

  const handleImport = async () => {
    const toImport = matches.filter((m) => m.field);
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-field-boundaries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            boundaries: toImport.map((m) => ({
              field_id: m.field!.id,
              geojson: JSON.stringify(m.placemark.geojson),
            })),
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      const result = await res.json();
      toast({
        title: "Boundaries imported",
        description: `${result.count} field boundaries saved successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      queryClient.invalidateQueries({ queryKey: ["fields-with-boundaries"] });
      onOpenChange(false);
      setMatches([]);
      setFileName("");
    } catch (err: any) {
      toast({
        title: "Import error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setMatches([]);
          setFileName("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Field Boundaries (KML/KMZ)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".kml,.kmz"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {fileName || "Select KML or KMZ file"}
            </Button>
          </div>

          {matches.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {matchedCount} of {matches.length} placemarks matched
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placemark</TableHead>
                    <TableHead>Matched Field</TableHead>
                    <TableHead>Farm</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {m.placemark.name}
                      </TableCell>
                      <TableCell>{m.field?.name || "—"}</TableCell>
                      <TableCell>{m.field?.farm_name || "—"}</TableCell>
                      <TableCell>
                        {m.field ? (
                          <Badge
                            variant="default"
                            className="bg-green-600 text-white"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Matched
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            No match
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || matchedCount === 0}
                >
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {matchedCount} Boundaries
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
