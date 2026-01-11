const mongoose = require("mongoose");

//  * Role Schema
//  * permissions: array of permission nodes (tree structure)
//  * Only nodes present are granted to the role.
// {
//   "role_name": "Auditor",
//   "description": "Can view audit templates and dashboard",
//   "permissions": [
//     {
//       "name": "audits",
//       "value": true, 
//       "children": [
//         {
//           "name": "template",
//           "value": true, 
//           "children": [
//             { "name": "view", "value": true, "children": [] }
//           ]
//         },
//         { "name": "dashboard", "value": true, "children": [] }
//       ]
//     }
//   ]
// }
const permissionNodeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Boolean, default: false }, // new flag for enable/disable
  children: { type: [this], default: [] },
}, { _id: false });

/**
 * Role Permission Entry
 * Represents the baseline permission state for a role
 */
// {
//   "role_name": "Auditor",
//   "permissions": [
//     { "permId": 5000, "value": true },
//     { "permId": 5001, "value": true },
//     { "permId": 5002, "value": false }
//   ]
// }

const rolePermissionSchema = new mongoose.Schema(
  {
    permId: {
      type: Number,
      required: true,
    },
    value: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema({
  role_name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: {
    type: [permissionNodeSchema],
    default: [],
  },
  /*
   FULL permission set for the new role
   Every permId should exist here
  */
  permissionsArray: {
    type: [rolePermissionSchema],
    default: [],
  },
}, { timestamps: true });


roleSchema.pre("validate", function (next) {
  const ids = this.permissionsArray.map(p => p.permId);
  if (ids.length !== new Set(ids).size) {
    return next(new Error("Duplicate permId in role permissions"));
  }
  next();
});

module.exports = mongoose.model("Role", roleSchema);
