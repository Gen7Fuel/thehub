import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/payablesRoute.js'),
  'utf8',
);

describe('Payables ChangeLog contract', () => {
  it('uses ChangeLog rather than the legacy ActionLog queue', () => {
    expect(source).toContain("require('../middleware/changeLogger')");
    expect(source).not.toContain("require('../middleware/actionLogger')");
    expect(source).not.toContain('logAction(req');
  });

  it('logs all five durable Payables mutation workflows', () => {
    expect(source.match(/await logChange\(req/g)).toHaveLength(5);
    expect(source).toContain("resourceStore: 'mongodb'");
    expect(source).toContain("req.headers['x-action-source'] || 'payables'");
    expect(source).toContain("resourceType: 'payable-vendor-tag'");
    expect(source).toContain('Sage bill ${key} linked to payable');
  });

  it('preserves complete payable before/after documents', () => {
    expect(source).toContain('before: null,');
    expect(source).toContain('after: populatedPayable');
    expect(source).toMatch(/before,\s+after: payable/);
    expect(source).toContain('before: payable,');
    expect(source).toContain('after: null,');
  });

  it('leaves failures to AccessLog because no durable change occurred', () => {
    expect(source).not.toMatch(/logChange\(req, \{[^}]*success: false/s);
  });
});
