// Tracks "dirty" forms (unsaved user input) so the stale-cache self-healing
// system in src/main.tsx can defer auto-reloads, and so the browser shows a
// native "Leave site?" prompt on manual refresh/close.
//
// Usage in a component:
//   useDirtyForm("transaction-form", isDirty);
// or imperatively:
//   markDirty("my-id"); markClean("my-id");

import { useEffect } from "react";

declare global {
  interface Window {
    __dirtyForms?: Set<string>;
    __onDirtyFormsEmpty?: () => void;
  }
}

function registry(): Set<string> {
  if (typeof window === "undefined") return new Set();
  if (!window.__dirtyForms) window.__dirtyForms = new Set();
  return window.__dirtyForms;
}

export function markDirty(id: string) {
  registry().add(id);
}

export function markClean(id: string) {
  const r = registry();
  r.delete(id);
  if (r.size === 0 && typeof window !== "undefined" && window.__onDirtyFormsEmpty) {
    window.__onDirtyFormsEmpty();
  }
}

export function hasDirtyForms(): boolean {
  return registry().size > 0;
}

export function useDirtyForm(id: string, isDirty: boolean) {
  useEffect(() => {
    if (isDirty) markDirty(id);
    else markClean(id);
  }, [id, isDirty]);

  useEffect(() => {
    return () => markClean(id);
  }, [id]);
}
