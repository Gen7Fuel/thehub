const mongoose = require("mongoose");

/**
 * Permission Schema
 * Represents a single permission or access right in the system.
 * Each permission has a unique name (e.g., "view_reports", "edit_users").
 */
const PermissionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true // Ensures each permission name is unique
  },
  sites: [{ type: String }], // store site names
});

// This will use the "permissions" collection automatically
const Permission = mongoose.model("Permission", PermissionSchema);

module.exports = Permission;