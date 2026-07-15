const mongoose = require('mongoose');
const { attachSiteAlias } = require('../utils/attachSiteAlias');

const ActionLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    username: { type: String },
    role: { type: String },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', index: true },
    locationName: { type: String },
    site: { type: String }, // Additive alias of locationName, auto-synced

    action: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'read',
        'approve',
        'reject',
        'login',
        'logout',
        'error'
      ],
      required: true,
      index: true,
    },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, index: true },

    success: { type: Boolean, required: true, index: true },
    statusCode: { type: Number },
    message: { type: String },

    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String, index: true },
    correlationId: { type: String },

    changes: { type: Object, default: undefined },
    beforeSnapshot: { type: Object, default: undefined },
    afterSnapshot: { type: Object, default: undefined },

    expiresAt: { type: Date, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActionLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
ActionLogSchema.index({ userId: 1, createdAt: -1 });
ActionLogSchema.index({ action: 1, createdAt: -1 });
ActionLogSchema.index({ success: 1, createdAt: -1 });
ActionLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

attachSiteAlias(ActionLogSchema, 'locationName');

module.exports = mongoose.model('ActionLog', ActionLogSchema);
