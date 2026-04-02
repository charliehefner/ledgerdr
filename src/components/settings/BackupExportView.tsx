import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Database, Table2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { DatabaseBackup } from "./DatabaseBackup";

interface TableInfo {
  table_name: string;
  row_estimate: number;
}

export function BackupExportView() {
  const { language } = useLanguage();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Check 7-day warning
    const lastBackup = localStorage.getItem("lastBackupTime");
    if (!lastBackup) {
      setShowWarning(true);
    } else {
      // Parse the DTG format: "02APR2026 14:30:00"
      const match = lastBackup.match(/^(\d{2})([A-Z]{3})(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
      if (match) {
        const months: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
        const d = new Date(Number(match[3]), months[match[2]] ?? 0, Number(match[1]));
        const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        setShowWarning(daysSince > 7);
      } else {
        setShowWarning(true);
      }
    }

    // Fetch schema reference
    const fetchTables = async () => {
      const { data, error } = await supabase.rpc("get_all_public_tables");
      if (!error && data) {
        setTables(data as TableInfo[]);
      }
      setLoadingTables(false);
    };
    fetchTables();
  }, []);

  const schemaText = tables
    .map((t) => `${t.table_name.padEnd(45)} ~${t.row_estimate} rows`)
    .join("\n");

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* 7-day warning banner */}
      {showWarning && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">
              {language === "es"
                ? "No se ha descargado un respaldo en los últimos 7 días"
                : "No backup has been downloaded in the last 7 days"}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === "es"
                ? "Se recomienda descargar un respaldo completo regularmente para proteger sus datos."
                : "It is recommended to download a full backup regularly to protect your data."}
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Data Backup */}
      <DatabaseBackup />

      {/* Section 2: Schema Reference */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Table2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">
              {language === "es" ? "Referencia de Esquema" : "Schema Reference"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === "es"
                ? `${tables.length} tablas públicas en la base de datos`
                : `${tables.length} public tables in the database`}
            </p>
          </div>
        </div>

        {loadingTables ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {language === "es" ? "Cargando tablas..." : "Loading tables..."}
          </div>
        ) : (
          <Textarea
            readOnly
            value={schemaText}
            rows={Math.min(tables.length + 1, 25)}
            className="font-mono text-xs"
          />
        )}
      </div>
    </div>
  );
}
