import { useState, useEffect, useCallback } from 'react';

export interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

export function useColumnVisibility(
  tableId: string,
  columns: ColumnConfig[]
) {
  const storageKey = `column-visibility-${tableId}`;
  
  // Initialize from localStorage or defaults
  const getInitialVisibility = useCallback(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved) as Record<string, boolean>;
      } catch {
        // Invalid JSON, use defaults
      }
    }
    // Default visibility based on column config
    return columns.reduce((acc, col) => {
      acc[col.key] = col.defaultVisible !== false;
      return acc;
    }, {} as Record<string, boolean>);
  }, [columns, storageKey]);

  const [visibility, setVisibility] = useState<Record<string, boolean>>(getInitialVisibility);

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
  }, [columns]);

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
