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


// const permissionNodeSchema = new mongoose.Schema({
//   name: { type: String, required: true}, // e.g., "view", "template"
//   children: { type: [this], default: [] }, // recursive children
// }, { _id: false }); // _id: false for inline sub-docs

// const permissionSchema = new mongoose.Schema({
//   module_name: { type: String, required: true, unique: true },
//   structure: {
//     type: [permissionNodeSchema], // array of root-level components
//     required: true,
//   },
// }, { timestamps: true });

const permissionNodeSchema = new mongoose.Schema(
  {
    permId: {
      type: Number,
    },
    name: {
      type: String,
      required: true,
    },
    children: {
      type: [this],
      default: [],
    },
  },
  { _id: false }
);

const permissionSchema = new mongoose.Schema(
  {
    module_name: {
      type: String,
      required: true,
      unique: true,
    },

    module_permId: {
      type: Number,
      required: true,
      unique: true,
    },

    structure: {
      type: [permissionNodeSchema],
      required: true,
    },
  },
  { timestamps: true }
);

/* ---------- AUTO permId ASSIGNMENT ---------- */

/**
 * Assign permIds sequentially within the module's reserved range
 * - moduleBaseId = module_permId
 * - all children get next available number
 * - preserves existing permIds
 */
function assignPermIdsSequential(nodes, moduleBaseId) {
  let maxUsedId = moduleBaseId;

  // 1️⃣ Find the max existing permId in this tree
  function findMax(nodes) {
    for (const node of nodes) {
      if (node.permId && node.permId > maxUsedId) {
        maxUsedId = node.permId;
      }
      if (node.children?.length) {
        findMax(node.children);
      }
    }
  }

  // 2️⃣ Assign new permIds sequentially starting from maxUsedId
  function assign(nodes) {
    for (const node of nodes) {
      if (!node.permId) {
        maxUsedId += 1;
        node.permId = maxUsedId;
      }

      if (node.children?.length) {
        assign(node.children);
      }
    }
  }

  findMax(nodes);
  assign(nodes);
}

/* ------------------- Permission Schema Hook ------------------- */

permissionSchema.pre("validate", function (next) {
  if (this.structure?.length) {
    if (!this.module_permId) {
      return next(
        new Error("module_permId must be set before saving Permission module")
      );
    }

    // assign permIds sequentially within this module
    assignPermIdsSequential(this.structure, this.module_permId);
  }
  next();
});

module.exports = mongoose.model("Permission", permissionSchema);
