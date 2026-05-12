import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { hasDirtyForms } from "./lib/dirtyForms";

// ---------------------------------------------------------------------------
// Service-worker kill switch
//
// This project previously shipped a PWA. Even though the SW files are now
// no-op kill switches, devices that registered the old worker can still be
// pinned to a stale shell. On every boot we:
//   1. Unregister any service worker registrations.
//   2. Clear all HTTP caches the SW may have populated.
//   3. Reload exactly once (guarded by sessionStorage) so the live network
//      response wins.
// In Lovable preview/iframe contexts we always run this guard, per the
// official PWA guidance.
// ---------------------------------------------------------------------------

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app"));

(async () => {
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
      } else if (isPreviewHost || isInIframe) {
        // No registrations — nothing to do, but defensively clear caches in
        // preview/iframe so a stale Workbox cache cannot resurface.
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      }
    }
  } catch {
    // Never block boot on cleanup.
  }
})();

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

createRoot(document.getElementById("root")!).render(<App />);
