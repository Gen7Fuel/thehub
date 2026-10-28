const mongoose = require('mongoose');
const { attachSiteAlias } = require('../utils/attachSiteAlias');

const AccessLogSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, enum: ['access'], default: 'access', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    username: { type: String },
    role: { type: String },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', index: true },
    locationName: { type: String },
    site: { type: String },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'read', 'approve', 'reject', 'login', 'logout', 'error'],
      required: true,
      index: true,
    },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    success: { type: Boolean, required: true, index: true },
    statusCode: { type: Number },
    message: { type: String },
    source: { type: String, index: true },
    method: { type: String },
    path: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String, index: true },
    correlationId: { type: String },
    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AccessLogSchema.index({ resourceType: 1, createdAt: -1 });
AccessLogSchema.index({ userId: 1, createdAt: -1 });
AccessLogSchema.index({ requestId: 1, createdAt: -1 });
AccessLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AccessLogSchema.index({ createdAt: 1, _id: 1 });

attachSiteAlias(AccessLogSchema, 'locationName');

module.exports = mongoose.model('AccessLog', AccessLogSchema);
