const mongoose = require("mongoose");

/**
 * Role Schema
 * Associates a role with a set of permissions.
 * Example:
 * {
 *   role_name: "Manager",
 *   description: "Can manage inventory and view reports",
 *   permissions: [
 *     {
 *       module_name: "inventory",
 *       components: [
 *         { name: "products", children: ["view", "edit"] },
 *         { name: "suppliers", children: ["view"] }
 *       ]
 *     },
 *     {
 *       module_name: "reports",
 *       components: [
 *         { name: "sales", children: ["view"] }
 *       ]
 *     }
 *   ]
 * }
 */

const roleSchema = new mongoose.Schema({
  role_name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  permissions: [
    {
      module_name: { type: String, required: true },
      components: [
        {
          name: { type: String, required: true },
          children: [{ type: String }],
        },
      ],
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Role", roleSchema);
