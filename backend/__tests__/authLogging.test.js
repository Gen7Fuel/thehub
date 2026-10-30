import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const route = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/auth.js'),
  'utf8',
);

describe('Self-service password change logging contract', () => {
  it('records a redacted ChangeLog entry for the authenticated mutation', () => {
    const start = route.indexOf("router.post('/change-password-self'");
    const end = route.indexOf("router.post('/reset-password'", start);
    const source = route.slice(start, end);

    expect(source).toContain('await logChange(req');
    expect(source).toContain("resourceType: 'user-credential'");
    expect(source).toContain("source: 'settings.reset-password'");
    expect(source).toContain("before: '[REDACTED]'");
    expect(source).toContain("after: '[REDACTED]'");
    expect(source).not.toContain('before: currentPassword');
    expect(source).not.toContain('after: cleanNewPassword');
  });
});
