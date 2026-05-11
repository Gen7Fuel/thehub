const ActionLog = require('../models/ActionLog');
const { computeChanges } = require('../utils/diff');

function getActor(req) {
  const user = req.user || {};
  return {
    userId: user._id || undefined,
    username: user.username || user.email || user.firstName || undefined,
    role: user.role || undefined,
    locationId: user.location || undefined,
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
}) {
  try {
    const actor = getActor(req);
    const changes = computeChanges(before, after);
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()) || req.ip;
    const userAgent = req.headers['user-agent'];

    const doc = new ActionLog({
      ...actor,
      action,
      resourceType,
      resourceId,
      success: !!success,
      statusCode,
      message,
      ip,
      userAgent,
      requestId: req.requestId,
      correlationId,
      changes,
      beforeSnapshot: undefined,
      afterSnapshot: undefined,
      expiresAt,
    });

    await doc.save();
  } catch (e) {
    console.error('actionLogger error:', e.message);
  }
}

module.exports = { logAction };
