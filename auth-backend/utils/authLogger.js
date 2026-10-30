const { randomUUID } = require('crypto');

let ChangeLog = null;
try {
  // backend/models is mounted at /app/models for this service.
  ChangeLog = require('../models/ChangeLog');
} catch (error) {
  // Keep authentication available, but never silently disable audit history.
  console.error('Auth ChangeLog disabled: shared model could not be loaded:', error.message);
}

function logAuthChange(req, {
  action,
  resourceType,
  resourceId,
  username,
  locationName,
  source,
  message,
  changes,
  changeSummary,
  statusCode = 200,
}) {
  if (!ChangeLog) return;

  // Copy request metadata now so the Express request object is not retained.
  const payload = {
    eventId: randomUUID(),
    eventType: 'change',
    userId: resourceType === 'user' ? resourceId : undefined,
    username,
    locationName,
    action,
    resourceType,
    resourceId,
    resourceStore: 'mongodb',
    success: true,
    statusCode,
    message,
    source: source || req.headers['x-action-source'] || 'auth',
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'],
    changes,
    changeSummary,
  };

  // Auth must never wait for or fail because of audit persistence.
  setImmediate(() => {
    ChangeLog.create(payload).catch((error) => {
      console.error('Auth change log persistence failed:', error.message);
    });
  });
}

module.exports = { logAuthChange };
