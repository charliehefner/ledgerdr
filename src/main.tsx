import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aggressive client-side cleanup: unregister any leftover service workers
// from the previous PWA build and clear all caches. This protects field
// users who would otherwise be stuck on a stale app shell. Safe to run on
// every load — it only does work when registrations or caches exist, and
// uses a one-time reload guarded by sessionStorage to avoid loops.
(async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      let didWork = false;
      for (const r of regs) {
        try { await r.unregister(); didWork = true; } catch (_) { /* noop */ }
      }
      if ("caches" in window) {
        const names = await caches.keys();
        if (names.length) {
          await Promise.all(names.map((n) => caches.delete(n)));
          didWork = true;
        }
      }
      if (didWork && !sessionStorage.getItem("__sw_cleanup_reloaded")) {
        sessionStorage.setItem("__sw_cleanup_reloaded", "1");
        location.reload();
        return;
      }
    }
  } catch (_) {
    // Ignore — never block app boot on cleanup.
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
