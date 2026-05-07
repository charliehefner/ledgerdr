import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ---------------------------------------------------------------------------
// Stale-cache self-healing
//
// Three layers protect users from being pinned on an outdated build:
//   1. Unregister any leftover service workers from the old PWA (kill switch).
//   2. Clear any HTTP caches the browser kept around.
//   3. Compare window.__APP_VERSION__ (baked into index.html at build time)
//      against /version.json (always fetched no-store). If they disagree, the
//      cached HTML is stale — purge everything and reload exactly once.
//
// The probe is also re-run every 10 minutes and on tab focus so long-lived
// tabs (common in this app) self-update without a manual refresh.
// ---------------------------------------------------------------------------

import { hasDirtyForms } from "./lib/dirtyForms";

const BUILT_VERSION = (window as any).__APP_VERSION__ as string | undefined;

async function doPurgeAndReload(marker: string) {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (_) {
    // Never block on cleanup.
  }
  // Guard against reload loops: only reload once per detected version.
  const key = "__version_reloaded_for";
  if (sessionStorage.getItem(key) === marker) return;
  sessionStorage.setItem(key, marker);
  location.reload();
}

async function purgeAndReload(reason: string, newVersion?: string) {
  const marker = newVersion ?? reason;

  // If the user has unsaved work, defer until the form is clean OR the
  // tab is hidden (whichever comes first).
  if (hasDirtyForms()) {
    if ((window as any).__pendingReloadMarker) return; // already deferred
    (window as any).__pendingReloadMarker = marker;

    const trigger = () => {
      if (!(window as any).__pendingReloadMarker) return;
      const m = (window as any).__pendingReloadMarker as string;
      (window as any).__pendingReloadMarker = undefined;
      window.__onDirtyFormsEmpty = undefined;
      void doPurgeAndReload(m);
    };

    window.__onDirtyFormsEmpty = () => {
      if (!hasDirtyForms()) trigger();
    };
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") trigger();
      },
      { once: true }
    );
    return;
  }

  await doPurgeAndReload(marker);
}

// Native safety net: warn the user before they lose unsaved work via manual
// refresh/close. Modern browsers ignore custom strings but still show a prompt
// when the handler returns a truthy value.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (hasDirtyForms()) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });
}

async function checkVersion() {
  if (!BUILT_VERSION || BUILT_VERSION === "__APP_VERSION__" || BUILT_VERSION === "dev") {
    return; // Dev mode or pre-build placeholder — never trigger.
  }
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version?: string };
    if (version && version !== BUILT_VERSION) {
      await purgeAndReload("version-mismatch", version);
    }
  } catch (_) {
    // Ignore — never block app boot on cleanup.
  }
}

(async () => {
  // Legacy cleanup: if the previous PWA SW is still registered, kill it now.
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        if (!sessionStorage.getItem("__sw_cleanup_reloaded")) {
          sessionStorage.setItem("__sw_cleanup_reloaded", "1");
          location.reload();
          return;
        }
      }
    }
  } catch (_) {
    // Never block boot.
  }

  // Initial version probe.
  await checkVersion();
})();

// Periodic + focus-driven re-checks.
if (typeof window !== "undefined") {
  setInterval(checkVersion, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersion();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
