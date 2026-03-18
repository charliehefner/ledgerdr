
Root cause identified: this is a tooling startup failure, not a Treasury/database logic bug.

`vite.config.ts` currently imports `@vitejs/plugin-react-swc`, and preview startup crashes while loading SWC native binaries:

- `vite.config.ts` line 2: `import react from "@vitejs/plugin-react-swc";`
- crash: `Error: Failed to load native binding` from `node_modules/@swc/core/binding.js:333`

So the live preview never reaches your app code; Vite fails during config/plugin initialization.

Implementation plan (to restore preview reliably):
1. Replace SWC React plugin with the non-native React plugin in Vite config.
   - Change import from `@vitejs/plugin-react-swc` to `@vitejs/plugin-react`
   - Keep the same `react()` usage in plugins array
2. Update dev dependencies accordingly.
   - Remove `@vitejs/plugin-react-swc`
   - Add `@vitejs/plugin-react`
3. Keep all business logic untouched.
   - No changes to Treasury, transactions, petty cash, or backend migrations
4. Validate startup and build.
   - Confirm `vite` dev server starts without native binding errors
   - Confirm preview opens and loads `/` correctly
   - Run production build check to ensure no regression in bundling
5. Quick functional sanity check after startup is restored.
   - Confirm sidebar renders after login
   - Confirm “Transactions → New Transaction → Payment Method” loads options from Treasury as expected

Technical details:
- This class of error happens when SWC’s platform-native module cannot be loaded in the runtime environment (optional dependency resolution / ABI/runtime mismatch), even if app code is valid.
- Because the failure occurs before app bootstrap, recent SQL migration changes are not the trigger.
- Switching to `@vitejs/plugin-react` avoids native SWC bindings and is the most stable fix in managed preview environments.
