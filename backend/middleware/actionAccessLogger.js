const { randomUUID } = require('crypto');

const ACTIONS = new Set(['create', 'read', 'update', 'delete', 'approve', 'reject']);
const SAFE_IDENTIFIER = /^[a-zA-Z0-9._-]+$/;

function readHeader(req, name, maxLength) {
  const value = req.get(name);
  if (!value || typeof value !== 'string') return undefined;
  const clean = value.replace(/[\r\n]+/g, ' ').trim();
  return clean && clean.length <= maxLength ? clean : undefined;
}

function actorFrom(req) {
  const user = req.user || {};
  const role = user.role;
  return {
    userId: user._id || undefined,
    username: user.username || user.email || user.firstName || undefined,
    role: role?.role_name || role?._id || role || undefined,
    locationId: user.location?._id || user.location || undefined,
    locationName: user.locationName || user.stationName || undefined,
  };
}

module.exports = function actionAccessLogger(options = {}) {
  const enqueue = options.enqueueAccessLog
    || require('../queues/accessLogQueue').enqueueAccessLog;

  return function logAnnotatedRequest(req, res, next) {
    const message = readHeader(req, 'X-Action-Message', 500);
    const source = readHeader(req, 'X-Action-Source', 100);
    const resourceType = readHeader(req, 'X-Action-Resource', 80);
    const action = readHeader(req, 'X-Action-Type', 20);

    const valid = message
      && source && SAFE_IDENTIFIER.test(source)
      && resourceType && SAFE_IDENTIFIER.test(resourceType)
      && action && ACTIONS.has(action);

    if (valid) {
      res.once('finish', () => {
        const statusCode = res.statusCode;
        const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip;
        const path = req.originalUrl.split('?')[0].slice(0, 250);

        const payload = {
          eventId: randomUUID(),
          eventType: 'access',
          ...actorFrom(req),
          action,
          resourceType,
          success: statusCode < 400,
          statusCode,
          message,
          source,
          method: req.method,
          path,
          ip,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
        };

        enqueue(payload).catch((error) => {
          console.error('Failed to enqueue action access log:', error.message);
        });
      });
    }

    next();
  };
};
