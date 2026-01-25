import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

// Tables to export
const TABLES_TO_EXPORT = [
  'accounts',
  'projects', 
  'cbs_codes',
  'transactions',
  'transaction_attachments',
  'transaction_edits',
  'employees',
  'employee_benefits',
  'employee_documents',
  'employee_incidents',
  'employee_salary_history',
  'employee_timesheets',
  'employee_vacations',
  'payroll_periods',
  'period_employee_benefits',
  'day_labor_entries',
  'farms',
  'fields',
  'fuel_equipment',
  'fuel_tanks',
  'fuel_transactions',
  'implements',
  'inventory_items',
  'inventory_purchases',
  'operation_types',
  'operations',
  'operation_inputs',
  'user_roles',
] as const;

type TableName = typeof TABLES_TO_EXPORT[number];

export function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);

  const fetchTableData = async (tableName: TableName) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.warn(`Error fetching ${tableName}:`, error.message);
      return [];
    }
    return data || [];
  };

  const generateSQLInserts = (tableName: string, data: Record<string, unknown>[]) => {
    if (data.length === 0) return `-- Table: ${tableName}\n-- No data\n\n`;
    
    const columns = Object.keys(data[0]);
    let sql = `-- Table: ${tableName}\n-- ${data.length} rows\n\n`;
    
    for (const row of data) {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    sql += '\n';
    return sql;
  };

  const handleExport = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    
    try {
      toast.info("Starting database export...");
      
      let fullSQL = `-- Database Backup\n-- Generated: ${new Date().toISOString()}\n-- Ledger DR Application\n\n`;
      const allData: Record<string, unknown[]> = {};
      
      // Fetch all tables
      for (const tableName of TABLES_TO_EXPORT) {
        const data = await fetchTableData(tableName);
        allData[tableName] = data;
        fullSQL += generateSQLInserts(tableName, data as Record<string, unknown>[]);
        toast.info(`Exported ${tableName}: ${data.length} rows`);
      }
      
      // Add SQL file
      zip.file('backup.sql', fullSQL);
      
      // Add JSON file with all data
      zip.file('backup.json', JSON.stringify(allData, null, 2));
      
      // Add individual JSON files per table
      const jsonFolder = zip.folder('tables');
      for (const [tableName, data] of Object.entries(allData)) {
        jsonFolder?.file(`${tableName}.json`, JSON.stringify(data, null, 2));
      }
      
      // Add metadata
      const metadata = {
        exportDate: new Date().toISOString(),
        tables: Object.entries(allData).map(([name, data]) => ({
          name,
          rowCount: data.length,
        })),
        totalRows: Object.values(allData).reduce((sum, data) => sum + data.length, 0),
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      
      // Generate and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Backup complete! ${metadata.totalRows} total rows exported.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export database');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Database Backup</h3>
          <p className="text-sm text-muted-foreground">
            Download a complete backup of all database tables
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This will export all tables as a ZIP file containing:
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li><strong>backup.sql</strong> - SQL INSERT statements for all data</li>
          <li><strong>backup.json</strong> - All data in JSON format</li>
          <li><strong>tables/</strong> - Individual JSON files per table</li>
          <li><strong>metadata.json</strong> - Export summary and row counts</li>
        </ul>
        
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="mt-4"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Database Backup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
