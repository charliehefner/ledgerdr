import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Database, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { getOrderedTableList } from "./backup/backupConstants";
import { SCHEMA_SQL } from "./backup/schemaSql";
import { RLS_POLICIES_SQL } from "./backup/rlsPoliciesSql";
import { TRIGGERS_SQL } from "./backup/triggersSql";
import { STORAGE_SQL } from "./backup/storageSql";
import {
  fetchTableData,
  fetchNCFAttachments,
  fetchStorageFiles,
  generateSQLInserts,
  generateReadme,
} from "./backup/backupUtils";

export function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [lastBackup, setLastBackup] = useState<string | null>(() => 
    localStorage.getItem("lastBackupTime")
  );
  const [exportSummary, setExportSummary] = useState<{ tables: number; rows: number } | null>(null);
  const { t, language } = useLanguage();

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportSummary(null);
    const zip = new JSZip();
    
    try {
      // Step 0: Discover all tables dynamically
      setCurrentStep(language === 'es' ? 'Descubriendo tablas...' : 'Discovering tables...');
      const tablesToExport = await getOrderedTableList();
      const totalSteps = tablesToExport.length + 3;
      let completedSteps = 0;

      // Step 1: Add all schema files
      setCurrentStep(t("backup.generatingSchema"));
      zip.file('00_schema.sql', SCHEMA_SQL);
      zip.file('02_rls_policies.sql', RLS_POLICIES_SQL);
      zip.file('03_triggers.sql', TRIGGERS_SQL);
      zip.file('04_storage.sql', STORAGE_SQL);
      completedSteps++;
      setProgress((completedSteps / totalSteps) * 100);

      // Step 2: Fetch all table data
      let dataSQL = `-- =============================================
-- DATA INSERTS
-- Generated: ${new Date().toISOString()}
-- Tables: ${tablesToExport.length} (dynamically discovered)
-- =============================================

`;
      const allData: Record<string, unknown[]> = {};
      
      for (const tableName of tablesToExport) {
        setCurrentStep(t("backup.exportingTable").replace("{table}", tableName));
        const data = await fetchTableData(tableName);
        allData[tableName] = data;
        dataSQL += generateSQLInserts(tableName, data as Record<string, unknown>[]);
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }
      
      zip.file('01_data.sql', dataSQL);
      zip.file('backup.json', JSON.stringify(allData, null, 2));
      
      // Individual table JSON files
      const jsonFolder = zip.folder('tables');
      for (const [tableName, data] of Object.entries(allData)) {
        jsonFolder?.file(`${tableName}.json`, JSON.stringify(data, null, 2));
      }

      // Step 3: Fetch attachments (NCF only for transactions)
      setCurrentStep(t("backup.downloadingAttachments"));
      const attachmentsFolder = zip.folder('attachments');
      
      const ncfAttachments = await fetchNCFAttachments();
      for (const file of ncfAttachments) {
        attachmentsFolder?.file(`transactions/${file.name}`, file.data);
      }
      
      const employeeDocuments = await fetchStorageFiles('employee-documents');
      for (const file of employeeDocuments) {
        attachmentsFolder?.file(`employees/${file.name}`, file.data);
      }
      completedSteps++;
      setProgress((completedSteps / totalSteps) * 100);

      // Add metadata
      const metadata = {
        exportDate: new Date().toISOString(),
        application: "Ledger DR - Agricultural Farm Management",
        version: "3.0",
        migrationPackage: "Complete IT Migration Package",
        discoveryMethod: "Dynamic (get_all_public_tables RPC)",
        tables: Object.entries(allData).map(([name, data]) => ({
          name,
          rowCount: data.length,
        })),
        totalRows: Object.values(allData).reduce((sum, data) => sum + data.length, 0),
        attachments: {
          transactions: ncfAttachments.length,
          employees: employeeDocuments.length,
        },
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      zip.file('README.md', generateReadme(metadata, ncfAttachments.length, employeeDocuments.length));

      // Generate and download
      setCurrentStep(t("backup.generatingZip"));
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-full-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      const now = new Date();
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const dd = String(now.getDate()).padStart(2, '0');
      const mon = months[now.getMonth()];
      const yyyy = now.getFullYear();
      const time = now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const backupTimeStr = `${dd}${mon}${yyyy} ${time}`;
      localStorage.setItem("lastBackupTime", backupTimeStr);
      setLastBackup(backupTimeStr);
      setExportSummary({ tables: tablesToExport.length, rows: metadata.totalRows });
      const totalFiles = ncfAttachments.length + employeeDocuments.length;
      toast.success(
        t("backup.complete")
          .replace("{rows}", metadata.totalRows.toLocaleString(language === 'es' ? 'es-DO' : 'en-US'))
          .replace("{files}", totalFiles.toString())
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t("backup.error"));
    } finally {
      setIsExporting(false);
      setCurrentStep("");
      setProgress(0);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{t("backup.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("backup.subtitle")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">{t("backup.includesAll")}</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>{t("backup.schemaComplete")}</li>
                <li>{language === 'es' ? 'Todas las tablas (descubrimiento dinámico)' : 'All tables (dynamic discovery)'}</li>
                <li>{t("backup.attachments")}</li>
                <li>{t("backup.instructions")}</li>
              </ul>
            </div>
          </div>
        </div>

        {isExporting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{currentStep}</p>
          </div>
        )}

        {exportSummary && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">
              {language === 'es' ? 'Último respaldo:' : 'Last export:'} {exportSummary.tables} {language === 'es' ? 'tablas' : 'tables'}, {exportSummary.rows.toLocaleString()} {language === 'es' ? 'filas' : 'rows'}
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="mt-2"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("backup.exporting")} {Math.round(progress)}%
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t("backup.downloadBackup")}
              </>
            )}
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">
            {language === 'es' ? 'Último respaldo' : 'Last backup'}: <span className="font-mono font-medium">{lastBackup ?? (language === 'es' ? 'Nunca' : 'Never')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
