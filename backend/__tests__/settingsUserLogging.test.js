import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/userRoutes.js'),
  'utf8',
);

describe('Settings permission-user bulk logging contract', () => {
  it('records one bounded ChangeLog event with every affected user id', () => {
    const start = source.indexOf("router.put('/by-permission/:permId'");
    const end = source.indexOf('// GET route to fetch a single user', start);
    const route = source.slice(start, end);

    expect(route).toContain('await logChange(req');
    expect(route).toContain("resourceType: 'user-permission'");
    expect(route).toContain("resourceStore: 'mongodb'");
    expect(route).toContain('resourceIds: appliedChanges.map');
    expect(route).toContain('affectedCount: appliedChanges.length');
    expect(route).toContain('changesTruncated: appliedChanges.length > loggedChanges.length');
    expect(route).toContain("source: req.headers['x-action-source'] || 'settings.permissions'");
  });
});
