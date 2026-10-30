import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/fuelRecRoutes.js'),
  'utf8',
);
const activeSource = source.replace(/^\s*\/\/.*$/gm, '');

describe('Fuel Rec change logging contract', () => {
  it('logs every active Fuel Rec write workflow', () => {
    for (const route of [
      "router.post('/capture'",
      "router.post('/request-again'",
      "router.post('/:id/link-po'",
      "router.post('/:id/unlink-po'",
      "router.delete('/:id'",
      "router.post('/:id/comment'",
    ]) {
      const routeStart = activeSource.indexOf(route);
      expect(routeStart, route).toBeGreaterThan(-1);
      const nextRoute = activeSource.indexOf('\nrouter.', routeStart + route.length);
      const routeSource = activeSource.slice(routeStart, nextRoute === -1 ? undefined : nextRoute);
      expect(routeSource, route).toContain('logChange(req');
    }
  });

  it('records generalized before/after changes and Mongo resource IDs', () => {
    expect(source).toContain("resourceStore: 'mongodb'");
    expect(source).toContain('before: { bol, order: beforeOrder }');
    expect(source).toContain('after: { bol: updatedBol, order');
    expect(source).toContain('resourceIds: [updatedBol._id');
  });

  it('preserves frontend purpose metadata with a safe module fallback', () => {
    expect(source).toContain("req.headers['x-action-source'] || 'fuel-rec'");
    expect(source).toContain('source: requestSource(req)');
  });
});
