import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ChangeLog from '../models/ChangeLog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(root, 'routes/fuel/fuelSettingsRoutes.js'), 'utf8');
const frontendRoot = path.resolve(root, '../frontend/src/routes/_navbarLayout/fuel-settings');

describe('Fuel Settings logging contract', () => {
  it('supports Azure SQL as an explicit ChangeLog resource store', () => {
    const error = new ChangeLog({
      eventId: 'fuel-settings-azure-sql', action: 'update', resourceType: 'fuel-setting',
      resourceStore: 'azure-sql', success: true,
    }).validateSync();
    expect(error).toBeUndefined();
  });

  it('logs every active SQL write route after the database operation', () => {
    expect(routeSource.match(/await logFuelSettingsBatch\(req/g)).toHaveLength(8);
    expect(routeSource).toContain("resourceStore: 'azure-sql'");
    expect(routeSource).toContain('changesTruncated: false');
    expect(routeSource).toContain('deletions.map');
    expect(routeSource).toContain('before: row');
    expect(routeSource).toContain('scheduledPeriod(isImmediate, scheduleEffectiveDate)');
    expect(routeSource).toContain('Station discount for ${location} rescheduled for ${newScheduleDate}');
  });

  it('sends full displayed SQL rows when deleting settings', () => {
    const sources = [
      'supplier-discounts.tsx', 'carrier-fcs.tsx',
      'carrier-haulage.tsx', 'station-discounts.tsx',
    ].map((file) => fs.readFileSync(path.join(frontendRoot, file), 'utf8')).join('\n');
    for (const field of [
      'liveDiscounts', 'stagedDiscounts', 'liveFcs', 'stagedFcs',
      'liveHaulage', 'stagedHaulage', 'scheduleEffectiveFrom',
    ]) expect(sources).toContain(field);
  });
});
