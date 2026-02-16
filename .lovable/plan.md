

## Update GPSGate API Key

### What needs to happen

1. **Update the secret** `GPSGATE_API_KEY` with the new value: `v2:MDAwMDAxNTk3Mzo5NzU3YjU5MzViMDg5OGE4MWY1Zg==`

2. **Redeploy** the `gpsgate-proxy` edge function so it picks up the new secret value.

3. **Test** the "Cargar Dispositivos" button in Settings > GPS to confirm the 401 error is resolved and devices load correctly.

### Technical Notes

- The edge function sends the key directly as the `Authorization` header value to GPSGate. Some APIs expect a prefix like `Bearer` or `Basic`. If the raw value still returns 401, we may need to try `Bearer v2:MDAwMDAxNTk3Mzo5NzU3YjU5MzViMDg5OGE4MWY1Zg==` instead.
- No code changes are needed -- only a secret update and redeployment.

