// const mongoose = require("mongoose");

// /**
//  * Permission Schema
//  * Represents a single permission or access right in the system.
//  * Each permission has a unique name (e.g., "view_reports", "edit_users").
//  */
// const PermissionSchema = new mongoose.Schema({
//   name: { 
//     type: String, 
//     required: true, 
//     unique: true // Ensures each permission name is unique
//   },
//   sites: [{ type: String }], // store site names
// });

// // This will use the "permissions" collection automatically
// const Permission = mongoose.model("Permission", PermissionSchema);

// module.exports = Permission;

const mongoose = require("mongoose");

/**
 * Permission Schema
 * Defines available modules, components, and actions (children)
 * Example:
 * {
 *   module_name: "inventory",
 *   components: [
 *     { name: "products", children: ["view", "edit", "delete"] },
 *     { name: "suppliers", children: ["view"] }
 *   ]
 * }
 */

const permissionSchema = new mongoose.Schema({
  module_name: {
    type: String,
    required: true,
    unique: true, // Each module name must be unique
  },
  components: [
    {
      name: { type: String, required: true }, // e.g. "products"
      children: [{ type: String }], // e.g. ["view", "edit", "delete"]
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Permission", permissionSchema);