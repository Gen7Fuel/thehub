import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const notifications = fs.readFileSync(path.join(root, 'routes/notificationRoutes.js'), 'utf8');
const groups = fs.readFileSync(path.join(root, 'routes/userGroupRoutes.js'), 'utf8');

describe('Notification change logging contract', () => {
  it('logs sent notifications and template mutations with Mongo IDs', () => {
    expect(notifications.match(/await logChange\(req/g)).toHaveLength(3);
    expect(notifications).toContain("resourceType: 'notification'");
    expect(notifications).toContain("resourceType: 'notification-template'");
    expect(notifications).toContain("resourceStore: 'mongodb'");
    expect(notifications).toContain('before = await NotificationTemplate.findById(_id).lean()');
    expect(notifications).toContain('before: deletedTemplate');
  });

  it('logs recipient-group create, update, and delete operations', () => {
    expect(groups.match(/await logChange\(req/g)).toHaveLength(3);
    expect(groups).toContain("resourceType: 'notification-user-group'");
    expect(groups).toContain('const before = await UserGroup.findById(id).lean()');
    expect(groups).toContain('before: deleted');
  });

  it('does not promote read receipts or summary dismissal to durable change events', () => {
    const detailStart = notifications.indexOf("router.get('/:id'");
    const sendStart = notifications.indexOf("router.post('/'", detailStart);
    expect(notifications.slice(detailStart, sendStart)).not.toContain('logChange(req');
    const dismissStart = notifications.indexOf("router.post('/dismiss-summary'");
    const templateStart = notifications.indexOf("router.post('/template'", dismissStart);
    expect(notifications.slice(dismissStart, templateStart)).not.toContain('logChange(req');
  });
});
