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
//       "children": [
//         {
//           "name": "template",
//           "children": [
//             { "name": "view", "children": [] }
//           ]
//         },
//         { "name": "dashboard", "children": [] }
//       ]
//     }
//   ]
// }

const permissionNodeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  children: { type: [this], default: [] }, // recursive children
}, { _id: false });

const roleSchema = new mongoose.Schema({
  role_name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: {
    type: [permissionNodeSchema], // tree-like structure
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model("Role", roleSchema);
