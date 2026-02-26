const mongoose = require('mongoose');

const MaintenanceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  scheduleStart: {
    type: Date,
    required: true
  },
  scheduleClose: {
    type: Date,
    required: true
  },
  actualStart: {
    type: Date
  },
  actualEnd: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // To track if the "48-hour notification email" was already sent 
  // so you don't spam users if the server restarts.
  notificationSent: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Indexing for faster lookups when the middleware checks for active maintenance
MaintenanceSchema.index({ status: 1, scheduleStart: 1 });

module.exports = mongoose.model('Maintenance', MaintenanceSchema);