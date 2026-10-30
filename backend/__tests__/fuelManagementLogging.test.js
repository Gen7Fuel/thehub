import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const routeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/fuel');
const read = (name) => fs.readFileSync(path.join(routeDir, name), 'utf8');

describe('Fuel Management change logging contract', () => {
  it.each([
    ['fuelCarrierRoutes.js', 'fuel-carrier'],
    ['fuelRackRoutes.js', 'fuel-rack'],
    ['fuelSupplierRoutes.js', 'fuel-supplier'],
    ['fuelStationTankRoutes.js', 'fuel-station-tank'],
    ['fuelOrderRoutes.js', 'fuel-order'],
    ['fuelSaleRoutes.js', 'fuel-sales'],
  ])('%s sends mutations to ChangeLog as %s', (file, resourceType) => {
    const source = read(file);
    expect(source).toContain("require('../../middleware/changeLogger')");
    expect(source).toContain('logChange(req');
    expect(source).toContain(`resourceType: '${resourceType}'`);
  });

  it('records before and after state for editable fuel resources', () => {
    for (const file of ['fuelCarrierRoutes.js', 'fuelRackRoutes.js', 'fuelSupplierRoutes.js', 'fuelStationTankRoutes.js', 'fuelOrderRoutes.js']) {
      const source = read(file);
      expect(source).toMatch(/before[,:]/);
      expect(source).toMatch(/after:/);
    }
  });

  it('preserves the calling module source for shared manual tank readings', () => {
    const source = read('fuelStationTankRoutes.js');
    expect(source).toContain("req.headers['x-action-source'] || 'fuel-management.volume'");
  });

  it('records bulk order IDs when a create-order request makes multiple orders', () => {
    const source = read('fuelOrderRoutes.js');
    expect(source).toContain('resourceIds: savedOrders.map');
    expect(source).toContain('bulk: { count: savedOrders.length }');
  });

  it('records the completed business result of a manual daily fuel sync', () => {
    const source = read('fuelStationTankRoutes.js');
    expect(source).toContain("resourceType: 'fuel-data-sync'");
    expect(source).toContain("resourceStore: 'external'");
    expect(source).toContain("message: 'Manual daily fuel sync and archive completed'");
    expect(source).toContain("path: 'syncStatus'");
  });
});
