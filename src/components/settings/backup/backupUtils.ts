import { supabase } from '@/integrations/supabase/client';
import type { TableName } from './backupConstants';

export async function fetchTableData(tableName: TableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) {
    console.warn(`Error fetching ${tableName}:`, error.message);
    return [];
  }
  return data || [];
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
**Version:** 2.2

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

## Restoration Steps

### For Supabase (Recommended)

1. Create a new Supabase project
2. Go to SQL Editor and run scripts in order:
   - \`00_schema.sql\`
   - \`02_rls_policies.sql\`
   - \`03_triggers.sql\`
   - \`04_storage.sql\`
   - \`01_data.sql\`
3. Upload \`attachments/\` contents to Storage buckets
4. Configure authentication and create admin user

### For Standalone PostgreSQL

1. Create database: \`CREATE DATABASE ledger_dr;\`
2. Run \`00_schema.sql\` and \`03_triggers.sql\`
3. Skip \`02_rls_policies.sql\` and \`04_storage.sql\` (Supabase-specific)
4. Run \`01_data.sql\` to insert data
5. Set up your own file storage solution
6. Update \`attachment_url\` columns with new storage paths
7. Implement your own authentication system

---

## Security Architecture

### Roles

| Role | Access Level |
|------|-------------|
| admin | Full system access |
| management | Full operational access |
| supervisor | Operations, scheduling, fuel management |
| accountant | Financial transactions, payroll |
| viewer | Read-only access |
| driver | Fuel submissions only |

### RLS Pattern

All policies use \`public.has_role(auth.uid(), 'role_name')\` for access control.
The \`has_role()\` function is \`SECURITY DEFINER\` to prevent RLS bypass.

---

## Authentication Migration

If replacing Supabase Auth with SSO:

1. Replace \`auth.uid()\` references in RLS policies with your identity provider's user ID
2. Modify \`user_roles\` table to reference your user directory
3. Update \`has_role()\` and \`get_user_role()\` functions
4. Refactor frontend \`AuthContext.tsx\` for your SSO provider

---

## Statistics

- **Total Rows:** ${metadata.totalRows.toLocaleString()}
- **Tables:** ${metadata.tables.length}
- **NCF Attachments:** ${ncfCount}
- **Employee Documents:** ${employeeDocsCount}

---

## Detailed Restore Procedure

### Step-by-step with psql

\`\`\`bash
# 1. Create the database (standalone PostgreSQL only)
createdb ledger_dr

# 2. Run schema creation
psql -d ledger_dr -f 00_schema.sql

# 3. Run triggers
psql -d ledger_dr -f 03_triggers.sql

# 4. Import data (handles dependency order via ON CONFLICT DO NOTHING)
psql -d ledger_dr -f 01_data.sql

# 5. (Supabase only) Run RLS policies and storage config
psql -d ledger_dr -f 02_rls_policies.sql
psql -d ledger_dr -f 04_storage.sql

# 6. Verify row counts
psql -d ledger_dr -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
\`\`\`

### Restoring Attachments

1. Create storage buckets \`transaction-attachments\` and \`employee-documents\`
2. Upload files from the \`attachments/\` folder preserving directory structure
3. For Supabase: use the Storage dashboard or \`supabase storage cp\` CLI

### Restoring from JSON (Alternative)

Each table's data is also available as individual JSON files in the \`tables/\` folder. Use these for programmatic import or migration to non-PostgreSQL databases.

---

## Required Secrets (for edge functions)

| Secret | Purpose |
|--------|---------|
| SUPABASE_URL | Database connection |
| SUPABASE_ANON_KEY | Client-side API access |
| SUPABASE_SERVICE_ROLE_KEY | Admin operations |

---

*Generated by Ledger DR Backup System v2.3*
`;
}
