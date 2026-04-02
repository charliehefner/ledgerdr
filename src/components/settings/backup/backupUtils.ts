import { supabase } from '@/integrations/supabase/client';

export async function fetchTableData(tableName: string) {
  const { data, error } = await (supabase
    .from(tableName as any)
    .select('*'));
  
  if (error) {
    console.warn(`Error fetching ${tableName}:`, error.message);
    return [];
  }
  return (data as Record<string, unknown>[]) || [];
}

// Fetch only NCF attachments for transactions
export async function fetchNCFAttachments() {
  const files: { name: string; data: Blob }[] = [];
  
  try {
    const { data: ncfRecords, error } = await supabase
      .from('transaction_attachments')
      .select('attachment_url')
      .eq('attachment_category', 'ncf');
    
    if (error || !ncfRecords) {
      console.warn('Error fetching NCF records:', error?.message);
      return files;
    }
    
    for (const record of ncfRecords) {
      if (!record.attachment_url) continue;
      
      const match = record.attachment_url.match(/transaction-attachments\/(.+)$/);
      if (!match) continue;
      
      const filePath = match[1];
      
      try {
        const { data, error: downloadError } = await supabase.storage
          .from('transaction-attachments')
          .download(filePath);
        
        if (data && !downloadError) {
          files.push({ name: filePath, data });
        }
      } catch (e) {
        console.warn(`Skipping NCF file ${filePath}:`, e);
      }
    }
  } catch (e) {
    console.warn('Error fetching NCF attachments:', e);
  }
  
  return files;
}

export async function fetchStorageFiles(bucketName: string) {
  const files: { name: string; data: Blob }[] = [];
  
  const listFilesRecursively = async (path: string): Promise<{ name: string; fullPath: string }[]> => {
    const allFiles: { name: string; fullPath: string }[] = [];
    
    try {
      const { data: items, error } = await supabase.storage
        .from(bucketName)
        .list(path, { limit: 1000 });
      
      if (error || !items) {
        console.warn(`Error listing ${bucketName}/${path}:`, error?.message);
        return allFiles;
      }

      for (const item of items) {
        if (!item.name) continue;
        
        const fullPath = path ? `${path}/${item.name}` : item.name;
        
        if (item.metadata === null || item.id === null) {
          const subFiles = await listFilesRecursively(fullPath);
          allFiles.push(...subFiles);
        } else {
          allFiles.push({ name: item.name, fullPath });
        }
      }
    } catch (e) {
      console.warn(`Error listing path ${path} in ${bucketName}:`, e);
    }
    
    return allFiles;
  };

  try {
    const allFilesList = await listFilesRecursively('');
    
    for (const file of allFilesList) {
      try {
        const { data, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(file.fullPath);
        
        if (data && !downloadError) {
          files.push({ name: file.fullPath, data });
        } else if (downloadError) {
          console.warn(`Error downloading ${file.fullPath}:`, downloadError.message);
        }
      } catch (e) {
        console.warn(`Skipping file ${file.fullPath}:`, e);
      }
    }
  } catch (e) {
    console.warn(`Error accessing bucket ${bucketName}:`, e);
  }
  
  return files;
}

export function generateSQLInserts(tableName: string, data: Record<string, unknown>[]) {
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
    sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
  }
  sql += '\n';
  return sql;
}

export function generateReadme(
  metadata: { totalRows: number; tables: { name: string; rowCount: number }[] },
  ncfCount: number,
  employeeDocsCount: number
) {
  return `# Ledger DR Database Backup
## Complete IT Migration Package

**Export Date:** ${new Date().toISOString()}
**Version:** 3.0

---

## Package Contents

### SQL Scripts (Execute in Order)

| File | Description |
|------|-------------|
| \`00_schema.sql\` | Complete database schema: tables, enums, and functions |
| \`01_data.sql\` | All data as INSERT statements (${metadata.totalRows.toLocaleString()} rows) |
| \`02_rls_policies.sql\` | Row Level Security policies for all tables |
| \`03_triggers.sql\` | Database triggers (updated_at, sync functions) |
| \`04_storage.sql\` | Storage bucket configuration (Supabase-specific) |

### Data Files

| File/Folder | Description |
|-------------|-------------|
| \`backup.json\` | Complete data in JSON format |
| \`tables/\` | Individual JSON files per table |
| \`attachments/\` | NCF attachments & employee documents (${ncfCount + employeeDocsCount} files) |
| \`metadata.json\` | Export summary and statistics |

---

## Statistics

- **Total Rows:** ${metadata.totalRows.toLocaleString()}
- **Tables:** ${metadata.tables.length}
- **NCF Attachments:** ${ncfCount}
- **Employee Documents:** ${employeeDocsCount}

---

*Generated by Ledger DR Backup System v3.0 (Dynamic Discovery)*
`;
}
