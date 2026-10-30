const { randomUUID } = require('crypto');
const { getClientIp } = require('../utils/clientIp');

let AccessLog = null;
try {
  // backend/models is mounted at /app/models for this service.
  AccessLog = require('../models/AccessLog');
} catch (error) {
  console.error('Auth AccessLog disabled: shared model could not be loaded:', error.message);
}

const validActions = new Set(['create', 'update', 'delete', 'read', 'approve', 'reject', 'login', 'logout', 'error']);
const derivedAction = (method) => ({ GET: 'read', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[method] || 'read');
const clean = (value, max) => typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : undefined;

module.exports = function authAccessLogger() {
  return function logAuthAccess(req, res, next) {
    res.on('finish', () => {
      if (!AccessLog) return;

      const path = req.originalUrl || req.url;
      if (path === '/login-auth/health') return;
      if (path === '/login-auth/maintenance-status' && res.statusCode < 400) return;

      const headerAction = clean(req.headers['x-action-type'], 30);
      const action = validActions.has(headerAction) ? headerAction : derivedAction(req.method);
      const actor = res.locals.authAuditActor || {};
      const isRegistration = path === '/login-auth/register';
      const username = isRegistration
        ? 'unknown'
        : actor.username || clean(req.body?.email, 254) || 'unknown';

      const payload = {
        eventId: randomUUID(),
        eventType: 'access',
        userId: actor.userId,
        username,
        locationName: actor.locationName || (!isRegistration ? clean(req.body?.stationName, 120) : undefined),
        action,
        resourceType: clean(req.headers['x-action-resource'], 80) || 'authentication',
        success: res.statusCode < 400,
        statusCode: res.statusCode,
        message: clean(req.headers['x-action-message'], 500) || `Authentication request: ${req.method} ${path}`,
        source: clean(req.headers['x-action-source'], 100) || 'auth',
        method: req.method,
        path,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        requestId: req.requestId,
      };

      setImmediate(() => {
        AccessLog.create(payload).catch((error) => {
          console.error('Auth access log persistence failed:', error.message);
        });
      });
    });

    next();
  };
};
