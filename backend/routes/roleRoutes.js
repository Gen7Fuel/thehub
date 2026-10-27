const express = require("express");
const router = express.Router();
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const _ = require('lodash'); 
const User = require('../models/User');
const { hydrateTreeValues, flattenHydratedTree } = require("../utils/mergePermissionObjects")
const { logChange } = require('../middleware/changeLogger');

// GET all roles
// router.get("/", async (req, res) => {
//   try {
//     const roles = await Role.find().sort({ role_name: 1 });
//     res.status(200).json(roles);
//   } catch (error) {
//     console.error("Error fetching roles:", error);
//     res.status(500).json({ message: "Server error fetching roles" });
//   }
// });
router.get("/", async (req, res) => {
  try {
    const [roles, allMasterPermissions] = await Promise.all([
      Role.find({}),
      Permission.find({}).sort({ module_name: 1 })
    ]);

    // Hydrate EVERY role so templates work on the frontend
    const hydratedRoles = roles.map(role => {
      const roleValuesMap = new Map(
        role.permissionsArray.map(p => [p.permId, p.value])
      );

      const hydratedPermissions = allMasterPermissions.map(module => ({
        name: module.module_name,
        permId: module.module_permId,
        value: roleValuesMap.get(module.module_permId) ?? false,
        children: hydrateTreeValues(module.structure, roleValuesMap)
      }));

      const roleObj = role.toJSON();
      roleObj.permissions = hydratedPermissions;
      return roleObj;
    });

    res.status(200).json(hydratedRoles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// GET specific role by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const role = await Role.findById(req.params.id);
//     if (!role) return res.status(404).json({ message: "Role not found" });

//     // Sort only root-level permissions alphabetically
//     if (Array.isArray(role.permissions)) {
//       role.permissions.sort((a, b) => a.name.localeCompare(b.name));
//     }

//     res.status(200).json(role);
//   } catch (error) {
//     console.error("Error fetching role:", error);
//     res.status(500).json({ message: "Server error fetching role" });
//   }
// });
// 2. The Route Handler
router.get("/:id", async (req, res) => {
  try {
    // Fetch the Role and all Permission master modules in parallel
    const [role, allMasterPermissions] = await Promise.all([
      Role.findById(req.params.id),
      Permission.find({}).sort({ module_name: 1 })
    ]);

    if (!role) return res.status(404).json({ message: "Role not found" });

    // Create a Map for O(1) lookup: permId -> boolean value
    const roleValuesMap = new Map(
      role.permissionsArray.map(p => [p.permId, p.value])
    );

    // Construct the "permissions" tree for the frontend
    const hydratedPermissions = allMasterPermissions.map(module => {
      // Check value for the module root itself
      const moduleValue = roleValuesMap.get(module.module_permId) ?? false;

      return {
        name: module.module_name,
        permId: module.module_permId,
        value: moduleValue,
        children: hydrateTreeValues(module.structure, roleValuesMap)
      };
    });

    // Prepare response object
    const roleObj = role.toJSON();
    roleObj.permissions = hydratedPermissions;

    res.status(200).json(roleObj);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ message: "Server error fetching role", error: error.message });
  }
});

// Add new role to the collection
// router.post("/", async (req, res) => {
//   try {
//     const { role_name, description, permissions } = req.body;

//     // Validate required fields
//     if (!role_name || typeof role_name !== "string") {
//       return res.status(400).json({ message: "Role name is required and must be a string" });
//     }

//     // Validate permissions recursively
//     const validatePermissionNodes = (nodes) => {
//       return nodes.every(node =>
//         typeof node.name === "string" &&
//         typeof node.value === "boolean" &&
//         (!node.children || validatePermissionNodes(node.children))
//       );
//     };

//     if (!Array.isArray(permissions) || !validatePermissionNodes(permissions)) {
//       return res.status(400).json({ message: "Invalid permissions structure" });
//     }

//     // Create the role
//     const newRole = new Role({
//       role_name,
//       description: description || "",
//       permissions,
//     });

//     await newRole.save();

//     res.status(201).json({ message: "Role created successfully", role: newRole });
//   } catch (err) {
//     console.error(err);

//     // Handle duplicate role_name
//     if (err.code === 11000 && err.keyPattern?.role_name) {
//       return res.status(400).json({ message: "Role name already exists" });
//     }

//     res.status(500).json({ message: "Failed to create role" });
//   }
// });
router.post("/", async (req, res) => {
  try {
    const { role_name, description, permissions } = req.body;

    // 1. Basic Validation
    if (!role_name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const exists = await Role.findOne({ role_name });
    if (exists) {
      return res.status(400).json({ message: "Role name already exists" });
    }

    // 2. Process Permissions
    let flatPermissionsArray = [];
    if (permissions && Array.isArray(permissions)) {
      // Flatten the hierarchical tree sent by the frontend into our new flat model
      flatPermissionsArray = flattenHydratedTree(permissions);
    }

    // 3. Create Role
    const newRole = new Role({
      role_name,
      description: description || "",
      // permissions: permissions || [], // Keeping the tree for UI state
      permissionsArray: flatPermissionsArray // The new source of truth
    });

    await newRole.save();

    await logChange(req, {
      action: 'create',
      resourceType: 'role',
      resourceId: newRole._id,
      success: true,
      statusCode: 201,
      source: 'settings.roles',
      resourceLabel: newRole.role_name,
      before: null,
      after: newRole.toObject(),
      diffOptions: { arrayKeys: { permissionsArray: 'permId' } },
    });

    res.status(201).json({ 
      message: "Role created successfully", 
      role: newRole 
    });
  } catch (err) {
    console.error("Error creating role:", err);
    res.status(500).json({ message: "Server error creating role", error: err.message });
  }
});

// Update role and role permissions along with safely merging with user permission
router.put("/:id", async (req, res) => {
  try {
    const { role_name, description, permissions, inStoreAccount } = req.body;
    const role = await Role.findById(req.params.id);
    
    if (!role) return res.status(404).json({ message: "Role not found" });

    const before = role.toObject();

    // 1. Update basic fields
    role.role_name = role_name || role.role_name;
    role.description = description || role.description;

    // We check if it's undefined to allow the frontend to send "false"
    if (typeof inStoreAccount !== 'undefined') {
      role.inStoreAccount = inStoreAccount;
    }

    // 2. Handle Permission Sync
    if (permissions && Array.isArray(permissions)) {
      // Keep the old tree field for now if your frontend still reads it directly
      // role.permissions = permissions; 

      // NEW: Flatten the tree sent by the frontend into the flat permId array
      const flatArray = flattenHydratedTree(permissions);
      
      // Update the new source of truth
      role.permissionsArray = flatArray;
      
      // Explicitly mark as modified for Mongoose to detect changes in the array
      role.markModified("permissionsArray");
      role.markModified("permissions");
    }

    await role.save();

    await logChange(req, {
      action: 'update',
      resourceType: 'role',
      resourceId: role._id,
      success: true,
      statusCode: 200,
      source: 'settings.roles',
      resourceLabel: role.role_name,
      before,
      after: role.toObject(),
      diffOptions: { arrayKeys: { permissionsArray: 'permId' } },
    });

    // 3. Emit updates to connected users (Real-time sync)
    const users = await User.find({ role: role._id });
    const io = req.app.get("io");

    if (io) {
      users.forEach((user) => {
        io.to(user._id.toString()).emit("permissions-updated");
      });
    }

    res.status(200).json({ 
      message: "Role and Permission IDs updated successfully", 
      role 
    });

  } catch (err) {
    console.error("Update Role Error:", err);
    res.status(500).json({ message: "Failed to update role", error: err.message });
  }
});
// router.put("/:id", async (req, res) => {
//   try {
//     const { role_name, description, permissions } = req.body;
//     const role = await Role.findById(req.params.id);
//     if (!role) return res.status(404).json({ message: "Role not found" });

//     role.role_name = role_name || role.role_name;
//     role.description = description || role.description;
//     role.permissions = permissions || [];
//     await role.save();

//     // 🔑 Emit to all users who have this role
//     const users = await User.find({ role: role._id });
//     const io = req.app.get("io");

//     if (io) {
//       users.forEach((user) => {
//         const userId = user._id.toString();
//         io.to(userId).emit("permissions-updated");
//       });
//     }

//     res.status(200).json({ message: "Role updated successfully", role });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to update role" });
//   }
// });


// Delete role
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Role.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Role not found" });

    await logChange(req, {
      action: 'delete',
      resourceType: 'role',
      resourceId: deleted._id,
      success: true,
      statusCode: 200,
      source: 'settings.roles',
      resourceLabel: deleted.role_name,
      before: deleted.toObject(),
      after: null,
      diffOptions: { arrayKeys: { permissionsArray: 'permId' } },
    });
    res.json({ message: "Role deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete role" });
  }
});

//Assign roles to users 
router.put("/:id/assign-users", async (req, res) => {
  const roleId = req.params.id;
  const { userIds } = req.body;
  try {
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ message: "userIds must be an array" });
    }

    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ message: "Role not found" });

    const previouslyAssigned = await User.find({ role: roleId }).select('_id').lean();
    const previousIds = previouslyAssigned.map((user) => String(user._id));

    // Assign role to selected users
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { role: roleId } }
    );

    // Remove role from users not selected but currently have it
    const removedUsers = await User.find({ _id: { $nin: userIds }, role: roleId });
    await User.updateMany(
      { _id: { $nin: userIds }, role: roleId },
      { $set: { role: null } }
    );

    const affectedIds = [...new Set([...previousIds, ...userIds.map(String)])];

    await logChange(req, {
      action: 'update',
      resourceType: 'role-assignment',
      resourceId: role._id,
      success: true,
      statusCode: 200,
      source: 'settings.roles',
      resourceLabel: role.role_name,
      message: `User assignments for role ${role.role_name} updated — ${userIds.length} assigned`,
      bulk: {
        affectedCount: affectedIds.length,
        resourceIds: affectedIds.slice(0, 100),
        truncated: affectedIds.length > 100,
      },
      before: { userIds: previousIds },
      after: { userIds: userIds.map(String) },
    });

    // 🔑 Emit to all affected users
    const io = req.app.get("io");
    if (io) {
      const affectedUsers = await User.find({ _id: { $in: userIds } }).select("_id");
      [...affectedUsers, ...removedUsers].forEach((user) => {
        io.to(user._id.toString()).emit("permissions-updated");
      });
    }

    res.status(200).json({ message: "Role assignment updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to assign users" });
  }
});

// router.put("/:id/assign-users", async (req, res) => {
//   const roleId = req.params.id;
//   const { userIds } = req.body;

//   try {
//     const role = await Role.findById(roleId);
//     if (!role) return res.status(404).json({ message: "Role not found" });

//     // Assign this role to all selected users
//     await User.updateMany(
//       { _id: { $in: userIds } },
//       { $set: { role: roleId } }
//     );

//     // Remove this role from users who are NOT selected but currently have it
//     await User.updateMany(
//       { _id: { $nin: userIds }, role: roleId },
//       { $set: { role: null } }
//     );

//     res.status(200).json({ message: "Role assignment updated successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to assign users" });
//   }
// });

module.exports = router;
