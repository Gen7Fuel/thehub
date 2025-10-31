const express = require("express");
const router = express.Router();
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const _ = require('lodash'); 
const User = require('../models/User');

// GET all roles
router.get("/", async (req, res) => {
  try {
    const roles = await Role.find().sort({ role_name: 1 });
    res.status(200).json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Server error fetching roles" });
  }
});

// GET a single role by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const role = await Role.findById(req.params.id);
//     if (!role) return res.status(404).json({ message: "Role not found" });
//     res.status(200).json(role);
//   } catch (error) {
//     console.error("Error fetching role:", error);
//     res.status(500).json({ message: "Server error fetching role" });
//   }
// });
router.get("/:id", async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Sort only root-level permissions alphabetically
    if (Array.isArray(role.permissions)) {
      role.permissions.sort((a, b) => a.name.localeCompare(b.name));
    }

    res.status(200).json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ message: "Server error fetching role" });
  }
});


// Add new role to the collection
router.post("/", async (req, res) => {
  try {
    const { role_name, description, permissions } = req.body;

    // Validate required fields
    if (!role_name || typeof role_name !== "string") {
      return res.status(400).json({ message: "Role name is required and must be a string" });
    }

    // Validate permissions recursively
    const validatePermissionNodes = (nodes) => {
      return nodes.every(node =>
        typeof node.name === "string" &&
        typeof node.value === "boolean" &&
        (!node.children || validatePermissionNodes(node.children))
      );
    };

    if (!Array.isArray(permissions) || !validatePermissionNodes(permissions)) {
      return res.status(400).json({ message: "Invalid permissions structure" });
    }

    // Create the role
    const newRole = new Role({
      role_name,
      description: description || "",
      permissions,
    });

    await newRole.save();

    res.status(201).json({ message: "Role created successfully", role: newRole });
  } catch (err) {
    console.error(err);

    // Handle duplicate role_name
    if (err.code === 11000 && err.keyPattern?.role_name) {
      return res.status(400).json({ message: "Role name already exists" });
    }

    res.status(500).json({ message: "Failed to create role" });
  }
});

// Update role and role permissions along with safely merging with user permission
router.put("/:id", async (req, res) => {
  try {
    const { role_name, description, permissions } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });

    role.role_name = role_name || role.role_name;
    role.description = description || role.description;
    role.permissions = permissions || [];

    await role.save();

    res.status(200).json({ message: "Role updated successfully", role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update role" });
  }
});


// Delete role
router.delete("/:id", async (req, res) => {
  try {
    await Role.findByIdAndDelete(req.params.id);
    res.json({ message: "Role deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete role" });
  }
});

//Assign roles to users 
// router.put("/:id/assign-users", async (req, res) => {
//   const roleId = req.params.id;
//   const { userIds } = req.body;

//   try {
//     const role = await Role.findById(roleId);
//     if (!role) return res.status(404).json({ message: "Role not found" });

//     // Assign this role to all selected users (overwrite if needed)
//     await User.updateMany(
//       { _id: { $in: userIds } },
//       { $set: { role: roleId } }
//     );

//     res.status(200).json({ message: "Role assigned to selected users successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to assign users" });
//   }
// });
router.put("/:id/assign-users", async (req, res) => {
  const roleId = req.params.id;
  const { userIds } = req.body;

  try {
    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Assign this role to all selected users
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { role: roleId } }
    );

    // Remove this role from users who are NOT selected but currently have it
    await User.updateMany(
      { _id: { $nin: userIds }, role: roleId },
      { $set: { role: null } }
    );

    res.status(200).json({ message: "Role assignment updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to assign users" });
  }
});

module.exports = router;