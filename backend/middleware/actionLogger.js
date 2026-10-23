const { randomUUID } = require('crypto');
const { computeChanges } = require('../utils/diff');
const { enqueueActionLog } = require('../queues/actionLogQueue');

function getActor(req) {
  const user = req.user || {};
  return {
    userId: user._id || undefined,
    username: user.username || user.email || user.firstName || undefined,
    role: user.role?.role_name || user.role?._id || user.role || undefined,
    locationId: user.location?._id || user.location || undefined,
    locationName: user.locationName || user.stationName || undefined,
  };
}

async function logAction(req, {
  action,
  resourceType,
  resourceId,
  success,
  statusCode,
  message,
  before,
  after,
  expiresAt,
  correlationId,
  eventType = 'change',
  source,
  method,
  path,
}) {
  try {
    const actor = getActor(req);
    const changes = computeChanges(before, after);
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()) || req.ip;
    const userAgent = req.headers['user-agent'];

    await enqueueActionLog({
      eventId: randomUUID(),
      ...actor,
      eventType,
      action,
      resourceType,
      resourceId,
      success: !!success,
      statusCode,
      message,
      source,
      method,
      path,
      ip,
      userAgent,
      requestId: req.requestId,
      correlationId,
      changes,
      beforeSnapshot: undefined,
      afterSnapshot: undefined,
      expiresAt,
    });
  } catch (e) {
    console.error('actionLogger error:', e.message);
  }
}

module.exports = { logAction };
