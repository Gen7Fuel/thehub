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

//Eg. Document - how this structure would look like
// {
//   "module_name": "audits",
//   "structure": [
//     {
//       "name": "template",
//       "children": [
//         {
//           "name": "view",
//           "children": [
//             { "name": "columns", "children": [] },
//             { "name": "filters", "children": [] }
//           ]
//         },
//         { "name": "edit", "children": [] }
//       ]
//     },
//     {
//       "name": "dashboard",
//       "children": [
//         { "name": "view", "children": [] }
//       ]
//     }
//   ]
// }


const permissionNodeSchema = new mongoose.Schema({
  name: { type: String, required: true}, // e.g., "view", "template"
  children: { type: [this], default: [] }, // recursive children
}, { _id: false }); // _id: false for inline sub-docs

const permissionSchema = new mongoose.Schema({
  module_name: { type: String, required: true, unique: true },
  structure: {
    type: [permissionNodeSchema], // array of root-level components
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("Permission", permissionSchema);
