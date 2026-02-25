

# Plan: Update Logo + Enable PWA

## Steps

1. **Copy the uploaded logo** to `src/assets/Logo_Jord.png` (replacing the existing `jord-logo.png` reference) and to `public/logo-192.png` and `public/logo-512.png` for PWA icons
2. **Update `index.html`** — replace favicon with the new logo, add PWA meta tags (theme-color, apple-touch-icon, manifest link)
3. **Update the sidebar** — change the logo import from `jord-logo.png` to `Logo_Jord.png`
4. **Install `vite-plugin-pwa`** and configure it in `vite.config.ts` with manifest (name: "LedgerDR", icons, theme color, display: standalone) and service worker (NetworkFirst for API, exclude OAuth routes)
5. **Update `index.html` title** from "Lovable App" to "LedgerDR"

## Technical Details

- Service worker strategy: `NetworkFirst` for API calls, `StaleWhileRevalidate` for static assets
- OAuth route `/~oauth` excluded from SW precaching
- Manifest: `name: "LedgerDR"`, `short_name: "LedgerDR"`, `display: "standalone"`, `start_url: "/"`
- The uploaded PNG will be used as favicon and PWA icons (copied to public/ for HTML/manifest references, and to src/assets/ for the React sidebar import)

