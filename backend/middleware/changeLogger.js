const { randomUUID } = require('crypto');
const { enqueueChangeLog } = require('../queues/changeLogQueue');
const { computeAuditDiff, buildAuditMessage } = require('../utils/auditDiff');

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

async function logChange(req, {
  action,
  resourceType,
  resourceId,
  resourceIds,
  resourceStore,
  success,
  statusCode,
  message,
  before,
  after,
  correlationId,
  source,
  method,
  path,
  changes: suppliedChanges,
  changeSummary: suppliedChangeSummary,
  changesTruncated: suppliedChangesTruncated,
  resourceLabel,
  bulk,
  diffOptions,
}) {
  try {
    const computed = suppliedChanges
      ? {
          changes: suppliedChanges,
          changeSummary: suppliedChangeSummary,
          changesTruncated: suppliedChangesTruncated,
        }
      : computeAuditDiff(before, after, diffOptions);

    await enqueueChangeLog({
      eventId: randomUUID(),
      eventType: 'change',
      ...getActor(req),
      action,
      resourceType,
      resourceId,
      resourceIds,
      resourceStore,
      success: !!success,
      statusCode,
      message: message || buildAuditMessage({
        action,
        resourceType,
        resourceLabel,
        changeSummary: computed.changeSummary,
        changes: computed.changes,
        bulk,
      }),
      source,
      method,
      path,
      ip: req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      correlationId,
      changes: computed.changes,
      changeSummary: computed.changeSummary,
      changesTruncated: computed.changesTruncated,
      bulk,
      beforeSnapshot: undefined,
      afterSnapshot: undefined,
    });
  } catch (error) {
    console.error('changeLogger error:', error.message);
  }
}

module.exports = { logChange };
