

# Update Nanonets API Key

## What
Update the `NANONETS_API_KEY` secret with the new value provided to fix the 401 Unauthorized errors on the receipt scanning (Escanear Recibo) feature.

## Steps
1. Use the `add_secret` tool to update `NANONETS_API_KEY` with the provided key value.
2. Test the `ocr-receipt` edge function to confirm it no longer returns 401 errors.

## Scope
- No code changes required
- No database changes required
- Only a secret value update

