const mongoose = require('mongoose');

const permissionRegistrySchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  registry: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  metadata: {
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    },
    description: String
  }
}, {
  timestamps: true,
  minimize: false // This ensures empty objects are saved
});

// Ensure only one registry document exists
permissionRegistrySchema.index({ version: 1 }, { unique: true });

// Static method to get the current registry
permissionRegistrySchema.statics.getCurrentRegistry = async function() {
  let registry = await this.findOne({}).sort({ createdAt: -1 });
  
  if (!registry) {
    // Create default registry if none exists
    registry = await this.create({
      registry: {
        cycleCount: {
          sitePicker: { view: true, edit: true },
          summary: { view: true, export: true }
        },
        orders: { create: true, approve: true },
        managedSites: ["Oliver", "Osoyoos"]
      }
    });
  }
  
  return registry;
};

// Instance method to update registry
permissionRegistrySchema.methods.updatePermission = function(path, value, userId) {
  const pathArray = path.split('.');
  let current = this.registry;
  
  // Navigate to the parent object
  for (let i = 0; i < pathArray.length - 1; i++) {
    if (!current[pathArray[i]]) {
      current[pathArray[i]] = {};
    }
    current = current[pathArray[i]];
  }
  
  // Set the value
  current[pathArray[pathArray.length - 1]] = value;
  
  // Update metadata
  this.metadata.lastUpdatedBy = userId;
  this.metadata.lastUpdatedAt = new Date();
  this.markModified('registry');
  
  return this.save();
};

// Instance method to delete permission
permissionRegistrySchema.methods.deletePermission = function(path, userId) {
  const pathArray = path.split('.');
  let current = this.registry;
  
  // Navigate to the parent object
  for (let i = 0; i < pathArray.length - 1; i++) {
    if (!current[pathArray[i]]) {
      return null; // Path doesn't exist
    }
    current = current[pathArray[i]];
  }
  
  // Delete the property
  delete current[pathArray[pathArray.length - 1]];
  
  // Update metadata
  this.metadata.lastUpdatedBy = userId;
  this.metadata.lastUpdatedAt = new Date();
  this.markModified('registry');
  
  return this.save();
};

module.exports = mongoose.model('PermissionRegistry', permissionRegistrySchema);