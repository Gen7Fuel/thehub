import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/safesheetRoutes.js'),
  'utf8',
);

describe('Safesheet logging contract', () => {
  it('keeps reads middleware-owned and sends mutations to ChangeLog', () => {
    expect(source).toContain("require('../middleware/changeLogger')");
    expect(source).not.toContain('actionLogger');
    expect(source).not.toContain('logAction(req');
    expect(source.match(/await logChange\(req/g)).toHaveLength(5);
    expect(source).toContain("resourceType: 'safesheet-entry'");
    expect(source).toContain("resourceStore: 'mongodb'");
    expect(source).toContain('before: beforeEntry');
    expect(source).toContain('after: null');
  });
});
