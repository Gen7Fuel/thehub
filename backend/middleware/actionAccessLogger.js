const { randomUUID } = require('crypto');
const { getClientIp } = require('../utils/clientIp');

const ACTIONS = new Set(['create', 'read', 'update', 'delete', 'approve', 'reject']);
const SAFE_IDENTIFIER = /^[a-zA-Z0-9._-]+$/;
const METHOD_ACTIONS = {
  GET: 'read',
  HEAD: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

// These reads are application-level polling/health checks rather than a
// deliberate user access to a business module. Successful checks add noise to
// AccessLog, but failures are still recorded so authentication, permission,
// and operational problems remain visible.
const SYSTEM_POLL_PATHS = new Set([
  '/api/health',
  '/api/maintenance',
  '/api/fuel-pricing/prices-ticker',
  '/api/fuel-pricing/check-pending-verification',
]);

// These endpoints are initiated by the application shell/bootstrap process.
// Unlike normal business routes, their fallback message must not imply that
// the user deliberately opened the corresponding module.
const APPLICATION_REQUEST_PATHS = new Set([
  ...SYSTEM_POLL_PATHS,
  '/api/locations',
  '/api/notification',
  '/api/notification/unread-count',
  '/api/notification/unread-summary',
]);

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

function requestPath(req) {
  return String(req.originalUrl || req.url || '/')
    .split('?')[0]
    .slice(0, 250);
}

function resourceFromPath(path) {
  const segments = path.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  const candidate = segments[apiIndex >= 0 ? apiIndex + 1 : 0];
  return candidate && SAFE_IDENTIFIER.test(candidate) ? candidate : 'unknown';
}

function isSuccessfulSystemPoll(method, path, statusCode) {
  return (method === 'GET' || method === 'HEAD')
    && SYSTEM_POLL_PATHS.has(path)
    && statusCode < 400;
}

function defaultMessage(method, path) {
  if ((method === 'GET' || method === 'HEAD') && APPLICATION_REQUEST_PATHS.has(path)) {
    return `Application request: ${method} ${path}`;
  }
  return `User accessed ${path}`;
}

module.exports = function actionAccessLogger(options = {}) {
  const enqueue = options.enqueueAccessLog
    || require('../queues/accessLogQueue').enqueueAccessLog;

  return function logAccessRequest(req, res, next) {
    const path = requestPath(req);
    const method = String(req.method || '').toUpperCase();
    const methodAction = METHOD_ACTIONS[method];

    if (methodAction) {
      const suppliedAction = readHeader(req, 'X-Action-Type', 20);
      const suppliedSource = readHeader(req, 'X-Action-Source', 100);
      const suppliedResourceType = readHeader(req, 'X-Action-Resource', 80);
      const suppliedMessage = readHeader(req, 'X-Action-Message', 500);
      const suppliedGroupId = readHeader(req, 'X-Action-Group-Id', 160);

      const action = suppliedAction && ACTIONS.has(suppliedAction)
        ? suppliedAction
        : methodAction;
      const source = suppliedSource && SAFE_IDENTIFIER.test(suppliedSource)
        ? suppliedSource
        : 'unknown';
      const resourceType = suppliedResourceType && SAFE_IDENTIFIER.test(suppliedResourceType)
        ? suppliedResourceType
        : resourceFromPath(path);
      const message = suppliedMessage || defaultMessage(method, path);

      res.once('finish', () => {
        const statusCode = res.statusCode;

        if (isSuccessfulSystemPoll(method, path, statusCode)) return;

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
          method,
          path,
          ip: getClientIp(req),
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          // Group only successful reads. Authentication, authorization, and
          // server failures must always remain individually visible.
          accessGroupId: action === 'read' && statusCode < 400 && suppliedGroupId
            ? suppliedGroupId
            : undefined,
        };

        enqueue(payload).catch((error) => {
          console.error('Failed to enqueue action access log:', error.message);
        });
      });
    }

    next();
  };
};
