import { test, expect } from "@playwright/test";

const ROUTES = [
  { path: "/dashboard", heading: /dashboard|panel|inicio/i },
  { path: "/transactions", heading: /transac/i },
  { path: "/hr", heading: /recursos|human|rrhh|empleados/i },
  { path: "/fuel", heading: /combustible|fuel/i },
  { path: "/inventory", heading: /inventario|inventory/i },
  { path: "/operations", heading: /operaciones|operations/i },
  { path: "/equipment", heading: /equipo|equipment|activos/i },
  { path: "/accounting", heading: /contabilidad|accounting/i },
  { path: "/industrial", heading: /industrial/i },
];

test.describe("Module navigation smoke tests", () => {
  for (const { path, heading } of ROUTES) {
    test(`${path} loads without error`, async ({ page }) => {
      await page.goto(path);

      // Should not redirect to login
      await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

      // Page should render (no blank screen)
      await expect(page.locator("body")).not.toBeEmpty();

      // No unhandled JS error overlay
      const errorOverlay = page.locator("[data-error-overlay]");
      await expect(errorOverlay).toHaveCount(0);
    });
  }
});
