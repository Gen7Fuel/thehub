const mongoose = require('mongoose');
const { attachSiteAlias } = require('../utils/attachSiteAlias');

const ChangeLogSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, enum: ['change'], default: 'change', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    username: { type: String },
    role: { type: String },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', index: true },
    locationName: { type: String },
    site: { type: String },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'approve', 'reject', 'error'],
      required: true,
      index: true,
    },
    resourceType: { type: String, required: true, index: true },
    // Mixed preserves existing Mongo ObjectIds while also allowing PostgreSQL
    // integer/UUID primary keys for resources that do not live in MongoDB.
    resourceId: { type: mongoose.Schema.Types.Mixed, index: true },
    resourceIds: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    resourceStore: { type: String, enum: ['mongodb', 'postgresql', 'external'], index: true },
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
    changes: { type: Object, default: undefined },
    changeSummary: { type: Object, default: undefined },
    changesTruncated: { type: Boolean, default: undefined },
    bulk: { type: Object, default: undefined },
    beforeSnapshot: { type: Object, default: undefined },
    afterSnapshot: { type: Object, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ChangeLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
ChangeLogSchema.index({ userId: 1, createdAt: -1 });
ChangeLogSchema.index({ requestId: 1, createdAt: -1 });
ChangeLogSchema.index({ action: 1, createdAt: -1 });
ChangeLogSchema.index({ createdAt: 1, _id: 1 });

attachSiteAlias(ChangeLogSchema, 'locationName');

module.exports = mongoose.model('ChangeLog', ChangeLogSchema);
