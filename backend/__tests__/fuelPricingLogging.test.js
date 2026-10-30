import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const routePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../routes/fuel/fuelPricingRoutes.js',
);
const source = fs.readFileSync(routePath, 'utf8');

describe('Fuel Pricing change logging contract', () => {
  it('logs all active pricing write routes through ChangeLog', () => {
    expect(source).toContain('require("../../middleware/changeLogger")');
    for (const route of [
      'router.put("/verify-price-receipt"',
      'router.post("/upsert-retail"',
      'router.delete("/cancel-schedule/:locationId"',
      'router.put("/edit-schedule-prices"',
    ]) {
      const routeStart = source.indexOf(route);
      expect(routeStart, route).toBeGreaterThan(-1);
      const nextRoute = source.indexOf('\nrouter.', routeStart + route.length);
      const routeSource = source.slice(routeStart, nextRoute === -1 ? undefined : nextRoute);
      expect(routeSource, route).toContain('logChange(req');
    }
  });

  it('records PostgreSQL IDs and before/after state for price changes', () => {
    expect(source).toContain('resourceStore: "postgresql"');
    expect(source).toContain('resourceIds: afterRows.map');
    expect(source).toContain('before: beforeRows');
    expect(source).toContain('after: afterRows');
    expect(source).toContain('resourceType: "fuel-price-log"');
    expect(source).toContain('resourceType: "fuel-price-schedule"');
  });

  it('preserves the frontend source so desktop, mobile, and verification changes remain distinct', () => {
    expect(source).toContain('req.headers["x-action-source"] || fallback');
    expect(source).toContain('requestSource(req, "fuel-pricing.verification")');
    expect(source).toContain('requestSource(req, "fuel-pricing.desktop")');
  });
});
