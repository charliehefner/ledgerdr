# Preview no se actualiza — Plan simplificado

## Diagnóstico

El proyecto tuvo un PWA con service worker. Aunque ya existen kill-switches (`public/sw.js`, `public/service-worker.js`, `public/registerSW.js`) que se auto-desregistran, hay tres focos que mantienen la app pegada a versiones viejas:

1. **`<link rel="manifest" href="/manifest.json">` en `index.html`** sigue anunciando la app como PWA. Algunos navegadores móviles/Chrome aún re-registran automáticamente y reinstalan caché stale entre sesiones.
2. **Tags `<meta http-equiv="Cache-Control">` en `index.html`** son redundantes — el proxy de Lovable ya envía `Cache-Control: no-cache, must-revalidate, max-age=0` para HTML. Los meta tags no aplican a respuestas servidas con esos headers y solo confunden el debug.
3. **Probe de versión propio en `src/main.tsx`** (fetch a `/version.json` cada 10 min + reload) compite con la limpieza de SW y puede dejar pestañas en estado intermedio cuando ambos disparan a la vez. Lovable's proxy ya marca `/version.json` como `no-store` y el HTML como `no-cache`, así que esta lógica casera ya no aporta.

Resultado neto hoy: el navegador tiene cache fantasma + un SW viejo + dos sistemas distintos intentando "auto-curar". Justo el escenario que la guía de Lovable pide evitar.

## Cambios

### 1. `index.html`
- Quitar `<link rel="manifest" href="/manifest.json">` y `<link rel="apple-touch-icon">`.
- Quitar los tres `<meta http-equiv="...">` de cache (proxy ya los maneja).
- Quitar `<script>window.__APP_VERSION__ = "__APP_VERSION__";</script>`.

### 2. `src/main.tsx`
- Conservar **solo** la limpieza de SW: al boot, si hay registrations, desregistrar todas, vaciar `caches`, reload una vez (con guard `__sw_cleanup_reloaded`).
- Aplicar el guard de iframe/preview-host de la guía oficial de Lovable: en `id-preview--*.lovable.app` o dentro de un iframe, siempre desregistrar SW.
- **Eliminar** todo el sistema de `BUILT_VERSION` / `checkVersion()` / `purgeAndReload()` / `setInterval` / `visibilitychange`. El proxy ya garantiza HTML fresco en cada navegación.
- Conservar `dirtyForms` y el `beforeunload` warning (no relacionados con caché).

### 3. `vite.config.ts`
- Eliminar `buildVersionPlugin()` completo y su uso. Ya no genera `version.json` ni reemplaza `__APP_VERSION__`.

### 4. PWA leftovers
- `public/manifest.json` y `public/manifest.webmanifest` → **borrar**.
- `public/sw.js`, `public/service-worker.js`, `public/registerSW.js` → **dejar** (son kill switches que aún protegen a usuarios con SW viejo registrado). Borrarlos en una limpieza futura, no ahora.

## Verificación
1. Después del cambio, abrir el preview y confirmar que carga.
2. DevTools → Application → Service Workers: ninguno activo.
3. Application → Manifest: vacío (ya no es instalable como PWA).
4. Editar un texto, guardar → aparece en preview tras un refresh normal en menos de unos segundos.
5. Confirmar que ni el sitio publicado ni el dev preview tienen errores de consola nuevos.

## Notas
- Cambios solo de presentación/infra de cliente. No toca DB, RPCs, ni lógica de negocio.
- Si el usuario quiere conservar la opción "Add to Home Screen" en el futuro, se puede reintroducir un `manifest.json` mínimo sin SW siguiendo la guía oficial — pero no ahora, porque es justo lo que está causando el problema.
