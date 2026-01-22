import { useState, useEffect, useCallback, useMemo } from 'react';

export interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

// Increment this version when column definitions change to reset user preferences
const STORAGE_VERSION = 2;

export function useColumnVisibility(
  tableId: string,
  columns: ColumnConfig[]
) {
  const storageKey = `column-visibility-v${STORAGE_VERSION}-${tableId}`;
  
  // Memoize the column keys to detect when columns change
  const columnKeys = useMemo(() => columns.map(c => c.key).join(','), [columns]);
  
  // Initialize from localStorage, but always merge with current column definitions
  const getInitialVisibility = useCallback(() => {
    const saved = localStorage.getItem(storageKey);
    let savedVisibility: Record<string, boolean> = {};
    
    if (saved) {
      try {
        savedVisibility = JSON.parse(saved) as Record<string, boolean>;
      } catch {
        // Invalid JSON, use empty object
      }
    }
    
    // Merge: use saved values where available, defaults for new columns
    return columns.reduce((acc, col) => {
      if (savedVisibility.hasOwnProperty(col.key)) {
        acc[col.key] = savedVisibility[col.key];
      } else {
        // New column - use default visibility
        acc[col.key] = col.defaultVisible !== false;
      }
      return acc;
    }, {} as Record<string, boolean>);
  }, [columns, storageKey]);

  const [visibility, setVisibility] = useState<Record<string, boolean>>(getInitialVisibility);

  // Re-sync when columns definition changes (e.g., new columns added)
  useEffect(() => {
    setVisibility(getInitialVisibility());
  }, [columnKeys, getInitialVisibility]);

  // Save to localStorage when visibility changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(visibility));
  }, [visibility, storageKey]);

  const toggleColumn = useCallback((key: string) => {
    setVisibility(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const setColumnVisible = useCallback((key: string, visible: boolean) => {
    setVisibility(prev => ({
      ...prev,
      [key]: visible,
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = columns.reduce((acc, col) => {
      acc[col.key] = col.defaultVisible !== false;
      return acc;
    }, {} as Record<string, boolean>);
    setVisibility(defaults);
    // Also clear localStorage to ensure fresh start
    localStorage.removeItem(storageKey);
  }, [columns, storageKey]);

  const isVisible = useCallback((key: string) => {
    return visibility[key] !== false;
  }, [visibility]);

  const visibleColumns = columns.filter(col => visibility[col.key] !== false);

  return {
    visibility,
    toggleColumn,
    setColumnVisible,
    resetToDefaults,
    isVisible,
    visibleColumns,
    allColumns: columns,
  };
}
