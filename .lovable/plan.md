

## Problem
The translation key `common.clear` doesn't exist in either language file, so the button displays the raw key "common.clear" instead of "Limpiar".

## Fix
Add `"common.clear": "Limpiar"` to `src/i18n/es.ts` and `"common.clear": "Clear"` to `src/i18n/en.ts` in the common labels section.

