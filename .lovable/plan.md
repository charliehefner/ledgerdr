## Goal

Eliminate the stale-cache class of bug permanently so no user (Brave, Chrome, old PWA installs, mobile field devices) can be stuck on an outdated build.

## Root cause

Three independent caching layers can each pin a user to an old version:

1. **HTTP cache on `index.html`** — if the browser serves it from disk cache, none of our cleanup code runs.
2. **Leftover PWA service worker** — older builds registered a Workbox SW that cached the app shell. Our current `public/sw.js` is a kill-switch, but only runs if the browser actually re-fetches it.
3. **Vite hashed asset cache** — fine on its own, but useless if `index.html` (which points to the new hashes) is itself stale.

The current `main.tsx` cleanup is reactive — it can only fix what it can reach.

## Fix: build-version check + hard no-cache on the entry

Three small, layered changes — each is a backstop for the others.

### 1. Emit a `version.json` at build time

Vite plugin writes `dist/version.json` containing the build's commit hash (or timestamp fallback) and injects the same value as `window.__APP_VERSION__` into `index.html`.

```json
{ "version": "a1b2c3d-1715000000" }
```

### 2. Runtime version probe in `main.tsx`

Before rendering, fetch `/version.json?t=<now>` (cache-busted). Compare to `window.__APP_VERSION__`:

- Match → render normally.
- Mismatch → unregister SWs, clear caches, then `location.reload(true)` once (guarded by `sessionStorage` to prevent loops).
- Network error → render normally (don't block offline users).

Also re-run the probe every 10 minutes while the tab is open and on `visibilitychange`, so long-lived tabs (common in this app) self-update without a manual refresh.

### 3. Force `index.html` and `version.json` to never be cached

Add to `index.html` `<head>`:

```html
<meta http-equiv="Cache-Control" content="no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

Meta tags are a defense-in-depth measure (real headers from Lovable's CDN are the primary control, and Lovable already sets short TTLs on HTML, but the meta tags catch edge cases like Brave's aggressive disk cache and corporate proxies).

`version.json` is fetched with `cache: 'no-store'` and a query-string buster, so it's safe regardless of headers.

## What this guarantees

- A user with a stale `index.html` will, on the next probe (≤10 min, or on tab focus), detect the mismatch and self-heal — even if they never hard-refresh.
- A user with a leftover PWA service worker still gets the existing kill-switch path (kept as-is).
- A user offline keeps working with whatever they have; the probe fails silently.

## Out of scope

- No change to existing `public/sw.js` / `public/service-worker.js` kill-switches — they still do their job.
- No change to Vite's asset hashing.
- No new dependencies.

## Technical notes

- Files touched: `vite.config.ts` (tiny custom plugin), `index.html` (meta tags + `__APP_VERSION__` placeholder), `src/main.tsx` (version probe + interval).
- The plugin also runs in `dev` mode writing a stable dev sentinel so the probe never triggers a reload during development.
- Reload guard uses `sessionStorage["__version_reloaded_for"] = newVersion` to ensure at most one reload per mismatched version per tab.

## User-facing remediation (today, for the MX Linux Brave install)

While the above ships, the affected user can fix their machine right now:

1. Brave → Settings → Privacy and Security → **Clear browsing data** → Advanced → check **Cached images and files** + **Cookies and other site data**, time range "All time", site `ledgerdr.lovable.app` (or use site-specific clear via the lock icon → Site settings → Clear data).
2. Open DevTools (`Ctrl+Shift+I`) → Application → Service Workers → click **Unregister** on any entry for this domain.
3. Close the tab fully, then reopen.

After the build-version check ships, this manual step won't be needed again.