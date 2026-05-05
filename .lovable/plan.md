I found the cause: the published site is actively serving a PWA service worker at `/sw.js`. It precaches `index.html` and the JS/CSS bundles, so some users can keep getting an old app shell even after you publish. That is not acceptable for field workers.

Plan:

1. Remove the current PWA service worker generation
   - Remove `vite-plugin-pwa` usage from `vite.config.ts`.
   - Remove the PWA dependency from package manifests.
   - Keep app icons/branding intact, but stop generating the Workbox precache service worker that is causing stale UI.

2. Ship a service-worker “kill switch” for already affected browsers
   - Add a static `/sw.js` file that:
     - activates immediately with `skipWaiting()` and `clients.claim()`;
     - deletes all service-worker caches;
     - reloads controlled tabs with a cache-busting query parameter;
     - unregisters itself after cleanup.
   - Also add `/service-worker.js` with the same cleanup logic as a safety net, in case any browser/device registered that path in the past.

3. Add a client-side safety cleanup on app startup
   - In `src/main.tsx`, before rendering the app, check for existing service-worker registrations.
   - If any exist, unregister them and clear Cache Storage automatically.
   - Trigger a one-time reload using a localStorage flag so users do not get stuck in a reload loop.
   - This helps users who load a stale shell that still eventually runs current JS.

4. Preserve installability without offline caching
   - If needed, keep a plain web app manifest/icon setup for “Add to Home Screen”.
   - Do not use offline precaching for this operations/accounting app because current data and UI updates are more important than offline cached shells.

5. Expected user impact
   - After the next publish, affected browsers should clean themselves up automatically on their next visit.
   - Users may see one automatic refresh once.
   - They should not need DevTools, manual cache clearing, or instructions that are unrealistic for field workers.

Technical notes:

- The live `/sw.js` currently contains Workbox precaching for `index.html`, `assets/index-DY2RM6g4.js`, CSS, icons, and `manifest.webmanifest`.
- It uses `createHandlerBoundToURL("index.html")`, which is exactly the pattern that can keep serving an old SPA shell.
- Because service workers persist after code changes, simply deleting the PWA plugin is not enough. The static cleanup worker must be shipped at the same path (`/sw.js`) for at least one release cycle so existing devices can unregister themselves.