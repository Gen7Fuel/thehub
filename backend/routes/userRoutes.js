const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require('../models/User');
const _ = require("lodash");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const { getMergedPermissions, hydrateTreeValues, flattenHydratedTree } = require("../utils/mergePermissionObjects")

// Compare frontend permissions with role.permissions to find overrides for saving them as custom permissions in users
// const getOverrides = (roleNodes = [], userNodes = []) => {
//   const roleMap = _.keyBy(roleNodes, "name");
//   const userMap = _.keyBy(userNodes, "name");

//   return _.compact(
//     _.map(userMap, (uNode, key) => {
//       const rNode = roleMap[key];
//       if (!rNode) return uNode; // new permission branch

//       let hasOverride = false;

//       // Check if value differs
//       if (_.isBoolean(uNode.value) && uNode.value !== rNode.value) hasOverride = true;

//       // Recursively check children
//       let childrenOverrides = [];
//       if (uNode.children && uNode.children.length > 0) {
//         childrenOverrides = getOverrides(rNode.children || [], uNode.children);
//         if (childrenOverrides.length > 0) hasOverride = true;
//       }

//       if (hasOverride) {
//         return {
//           name: uNode.name,
//           value: uNode.value,
//           ...(childrenOverrides.length > 0 ? { children: childrenOverrides } : {}),
//         };
//       }

//       return null; // no override, skip
//     })
//   );
// };
const getOverrides = (roleNodes = [], userNodes = []) => {
  return _.compact(
    userNodes.map((uNode) => {
      // Find matching node in the CURRENT role structure
      const rNode = roleNodes.find(r => r.name === uNode.name);

      // If the node no longer exists in the role, discard this override branch
      if (!rNode) return null;

      let hasOverride = false;
      let childrenOverrides = [];

      // 1. Check if the boolean value itself is an override
      if (uNode.value !== rNode.value) {
        hasOverride = true;
      }

      // 2. Recursively check children based ONLY on current role children
      if (uNode.children && uNode.children.length > 0) {
        childrenOverrides = getOverrides(rNode.children || [], uNode.children);
        if (childrenOverrides.length > 0) {
          hasOverride = true;
        }
      }

      // 3. Only return the node if it or its children actually differ from the role
      if (hasOverride) {
        return {
          name: uNode.name,
          value: uNode.value,
          ...(childrenOverrides.length > 0 ? { children: childrenOverrides } : {}),
        };
      }

      return null;
    })
  );
};

function buildParentMap(modules, map = new Map()) {
  modules.forEach(module => {
    if (module.structure) {
      const traverse = (nodes, parentId) => {
        nodes.forEach(node => {
          map.set(node.permId, parentId);
          if (node.children) traverse(node.children, node.permId);
        });
      };
      traverse(module.structure, module.module_permId);
    }
  });
  return map;
}

// GET route to fetch all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from the database
    res.status(200).json(users); // Send the users as a JSON response
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET route to fetch a single user by userId
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. Fetch necessary data for merging
    const [allMasterPermissions, role] = await Promise.all([
      Permission.find({}).sort({ module_name: 1 }),
      user.role ? Role.findById(user.role).lean() : Promise.resolve(null)
    ]);

    // 2. Initialize the Merged Map
    const mergedValuesMap = new Map();

    // 3. Layer 1: Apply Role Permissions
    if (role && role.permissionsArray) {
      role.permissionsArray.forEach(p => {
        mergedValuesMap.set(p.permId, p.value);
      });
    }

    // 4. Layer 2: Apply User Overrides (Overwrites role values if permId matches)
    if (user.customPermissionsArray && user.customPermissionsArray.length > 0) {
      user.customPermissionsArray.forEach(p => {
        mergedValuesMap.set(p.permId, p.value);
      });
    }

    // 5. Construct the hydrated tree using the existing utility
    const mergedPermissionsTree = allMasterPermissions.map(module => {
      return {
        name: module.module_name,
        permId: module.module_permId,
        value: mergedValuesMap.get(module.module_permId) ?? false,
        // Call your utility function here
        children: hydrateTreeValues(module.structure, mergedValuesMap)
      };
    });

    // 6. Respond
    res.status(200).json({
      ...user,
      role: role ? { _id: role._id, role_name: role.role_name } : null,
      merged_permissions: mergedPermissionsTree,
      is_logged_in: user.is_loggedIn,
      last_login: user.lastLoginDate
    });

  } catch (error) {
    console.error("Error fetching user with merged permissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// router.get("/:userId", async (req, res) => {
//   const { userId } = req.params;

//   try {
//     const user = await User.findById(userId).lean();
//     if (!user) return res.status(404).json({ error: "User not found" });

//     // Get role details
//     const role = user.role ? await Role.findById(user.role).lean() : null;
//     const roleData = role ? { _id: role._id, role_name: role.role_name } : null;

//     // Merge role + custom permissions
//     const mergedPermissions = await getMergedPermissions(user);

//     res.status(200).json({
//       ...user,
//       role: roleData,
//       merged_permissions: mergedPermissions,
//       is_logged_in: user.is_loggedIn,
//       last_login: user.lastLoginDate
//     });
//   } catch (error) {
//     console.error("Error fetching user with merged permissions:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// Update a user role
router.put("/:userId/role", async (req, res) => {
  const { userId } = req.params;
  const { roleId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.role = roleId;
    await user.save();
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("permissions-updated");
    }

    res.json({ success: true, message: "User role updated successfully" });
  } catch (err) {
    console.error("Error updating role:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// update the site access for a user
router.put("/:userId/site-access", async (req, res) => {
  try {
    const { userId } = req.params;
    const { siteAccess } = req.body;

    if (!siteAccess || typeof siteAccess !== "object") {
      return res.status(400).json({ message: "Invalid site access data" });
    }

    await User.findByIdAndUpdate(userId, { site_access: siteAccess });
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("permissions-updated");
    }
    res.json({ success: true, message: "Site access updated successfully" });
  } catch (err) {
    console.error("Error updating site access:", err);
    res.status(500).json({ message: "Failed to update site access" });
  }
});



// PUT route to update the 'access' attribute of a user by _id
router.put("/:userId/permissions", async (req, res) => {
  const { userId } = req.params;
  const { mergedPermissions, roleId } = req.body;

  if (!mergedPermissions || !roleId) {
    return res.status(400).json({ error: "Missing permissions or role ID" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. Fetch BOTH the role and the Master Permissions structure
    const [role, allMasterPermissions] = await Promise.all([
      Role.findById(roleId).lean(),
      Permission.find({}).lean() // <--- THIS WAS MISSING
    ]);

    if (!role) return res.status(404).json({ error: "Role not found" });

    // 2. Build the helper maps
    const parentMap = buildParentMap(allMasterPermissions);
    const roleMap = new Map((role.permissionsArray || []).map(p => [p.permId, p.value]));
    const flattenedIncoming = flattenHydratedTree(mergedPermissions);

    // 3. Identify custom overrides with "Parent Guarantee" logic
    const customPermissionsArray = [];

    flattenedIncoming.forEach(uPerm => {
      const roleValue = roleMap.get(uPerm.permId);

      // Basic difference check
      let isDifferent = uPerm.value !== roleValue || roleValue === undefined;

      // THE FIX: If child is true, force all ancestors to be true in the override list
      if (uPerm.value === true) {
        let currentParentId = parentMap.get(uPerm.permId);
        while (currentParentId) {
          // If the role would have disabled this parent, we must explicitly enable it
          if (roleMap.get(currentParentId) === false) {
            if (!customPermissionsArray.find(p => p.permId === currentParentId)) {
              customPermissionsArray.push({ permId: currentParentId, value: true });
            }
          }
          currentParentId = parentMap.get(currentParentId);
        }
      }

      // Add the actual permission if it was different
      if (isDifferent) {
        if (!customPermissionsArray.find(p => p.permId === uPerm.permId)) {
          customPermissionsArray.push(uPerm);
        }
      }
    });

    // 4. Save to User
    user.customPermissionsArray = customPermissionsArray;
    // Mark modified if using Mixed types or just to be safe
    user.markModified('customPermissionsArray');

    await user.save();

    // 5. Emit socket update
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("permissions-updated");
    }

    res.json({
      success: true,
      overrideCount: customPermissionsArray.length,
      customPermissionsArray
    });

  } catch (err) {
    console.error("Error updating user permissions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// router.put("/:userId/permissions", async (req, res) => {
//   const { userId } = req.params;
//   const { mergedPermissions, roleId } = req.body;

//   if (!mergedPermissions || !roleId) {
//     return res.status(400).json({ error: "Missing permissions or role ID" });
//   }

//   try {
//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const role = await Role.findById(roleId);
//     if (!role) return res.status(404).json({ error: "Role not found" });

//     const customPermissions = getOverrides(role.permissions, mergedPermissions);

//     // Update user
//     user.custom_permissions = customPermissions;
//     await user.save();
//     const io = req.app.get("io");
//     if (io) {
//       io.to(userId).emit("permissions-updated");
//     }

//     res.json({ success: true, custom_permissions: customPermissions });
//   } catch (err) {
//     console.error("Error updating custom permissions:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// PATCH /api/users/:id/active 
// handles users active and inactive status
// PATCH /api/users/:id/active
router.patch("/:id/active", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.is_active = is_active;

    // If user is being deactivated, clear sensitive fields
    if (is_active === false) {
      user.role = null;
      user.custom_permissions = [];

      // Set all site_access values to false
      if (user.site_access && user.site_access.size > 0) {
        for (const key of user.site_access.keys()) {
          user.site_access.set(key, false);
        }
      }
    }

    await user.save();

    res.json({ message: "User status updated", user });
  } catch (error) {
    console.error("Error updating user active status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin-forced logout
router.post("/:id/logout", async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const adminUserId = req.user?._id; // admin performing the action
    // console.log('userid:', targetUserId);

    // Mark user as logged out
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      {
        is_loggedIn: false,
        loggedOutBy: adminUserId,
      },
      { new: true, timestamps: false }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Emit socket event to notify the user
    const io = req.app.get("io");
    if (io) {
      io.to(targetUserId).emit("force-logout", {
        message: "You have been logged out by an administrator.",
      });
    }

    res.json({ message: "User logged out successfully", user: updatedUser });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// logout-multiple route for except admin
router.post("/logout-multiple", async (req, res) => {
  try {
    const adminUserId = req.user?._id;
    // Find Admin Role ID
    const adminRole = await Role.findOne({ role_name: "Admin" });
    if (!adminRole) return res.status(400).json({ message: "Admin role not found" });

    const adminRoleId = adminRole._id.toString();

    // Find all active, logged-in NON-admin users
    const usersToLogout = await User.find({
      is_loggedIn: true,
      is_active: true,
      $or: [
        { role: { $exists: false } },
        { role: null },
        { role: { $ne: adminRoleId } },
      ],
    });

    console.log("Users to logout:", usersToLogout.length);

    if (!usersToLogout.length) {
      return res.json({ message: "No users to log out" });
    }

    const io = req.app.get("io");

    for (const user of usersToLogout) {
      user.is_loggedIn = false;
      user.loggedOutBy = adminUserId;
      await user.save({ timestamps: false });

      if (io) {
        io.to(user._id.toString()).emit("force-logout", {
          message: "You have been logged out by an administrator.",
        });
      }
    }

    res.json({
      message: "All non-admin active users logged out successfully",
      count: usersToLogout.length,
    });

  } catch (err) {
    console.error("Logout all users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;