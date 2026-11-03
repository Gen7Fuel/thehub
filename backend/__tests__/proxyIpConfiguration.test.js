import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const caddyfile = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../Caddyfile'),
  'utf8',
);

describe('production proxy client-IP configuration', () => {
  it('parses forwarded client IPs only from private proxy peers', () => {
    expect(caddyfile).toContain('trusted_proxies static private_ranges');
    expect(caddyfile).toContain('trusted_proxies_strict');
    expect(caddyfile).toContain('client_ip_headers X-Forwarded-For X-Real-IP');
  });
});
