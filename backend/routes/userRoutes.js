const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require('../models/User');
const _ = require("lodash");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const { getMergedPermissions, hydrateTreeValues, flattenHydratedTree } = require("../utils/mergePermissionObjects")
const { logChange } = require('../middleware/changeLogger');

const userLabel = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
const mapToObject = (value) => value instanceof Map ? Object.fromEntries(value) : value;
const auditableUserState = (user) => ({
  is_active: user.is_active,
  role: user.role?._id || user.role || null,
  site_access: mapToObject(user.site_access),
  customPermissionsArray: user.customPermissionsArray,
  is_loggedIn: user.is_loggedIn,
});

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
    const users = await User.find().select('-password'); // Never expose credential hashes
    res.status(200).json(users); // Send the users as a JSON response
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New route to get users with role names specifically for the settings UI
router.get('/populate-roles', async (req, res) => {
  try {
    const users = await User.find()
      .populate('role', 'role_name') 
      .select('firstName lastName email site_access role is_active'); // Added is_active
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET route to list every user's effective value (role default, overridden by
// their customPermissionsArray if present) for a single permId
router.get('/by-permission/:permId', async (req, res) => {
  try {
    const permId = Number(req.params.permId);
    if (!Number.isFinite(permId)) {
      return res.status(400).json({ error: "Invalid permId" });
    }

    const users = await User.find()
      .populate('role', 'role_name permissionsArray')
      .select('firstName lastName email role customPermissionsArray')
      .lean();

    const result = users.map((user) => {
      const override = user.customPermissionsArray?.find((p) => p.permId === permId);
      const roleValue = user.role?.permissionsArray?.find((p) => p.permId === permId)?.value ?? false;
      const value = override ? override.value : roleValue;

      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleName: user.role?.role_name || null,
        value,
      };
    });

    result.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching users by permission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT route to set/clear a single permId override for a batch of users,
// without touching any of their other permissions/overrides
router.put('/by-permission/:permId', async (req, res) => {
  try {
    const permId = Number(req.params.permId);
    const { changes } = req.body;

    if (!Number.isFinite(permId)) {
      return res.status(400).json({ error: "Invalid permId" });
    }
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: "changes must be an array" });
    }

    const io = req.app.get("io");
    const appliedChanges = [];

    for (const { userId, value } of changes) {
      const user = await User.findById(userId).populate('role', 'permissionsArray');
      if (!user) continue;

      const roleValue = user.role?.permissionsArray?.find((p) => p.permId === permId)?.value ?? false;
      const existingIdx = user.customPermissionsArray.findIndex((p) => p.permId === permId);
      const beforeValue = existingIdx > -1 ? user.customPermissionsArray[existingIdx].value : roleValue;
      if (Boolean(value) === Boolean(beforeValue)) continue;

      if (value === roleValue) {
        // Matches the role default again -> no override needed
        if (existingIdx === -1) continue;
        user.customPermissionsArray.splice(existingIdx, 1);
      } else if (existingIdx > -1) {
        user.customPermissionsArray[existingIdx].value = value;
      } else {
        user.customPermissionsArray.push({ permId, value });
      }

      user.markModified('customPermissionsArray');
      await user.save();

      appliedChanges.push({
        userId: user._id,
        userLabel: userLabel(user),
        before: beforeValue,
        after: Boolean(value),
      });

      if (io) io.to(userId).emit("permissions-updated");
    }

    if (appliedChanges.length > 0) {
      const loggedChanges = appliedChanges.slice(0, 100).map((entry) => ({
        operation: 'replace',
        path: `users.${entry.userId}.permissions.${permId}`,
        before: entry.before,
        after: entry.after,
      }));
      await logChange(req, {
        action: 'update',
        resourceType: 'user-permission',
        resourceIds: appliedChanges.map((entry) => entry.userId),
        resourceStore: 'mongodb',
        success: true,
        statusCode: 200,
        source: req.headers['x-action-source'] || 'settings.permissions',
        message: `Permission ${permId} assignment updated for ${appliedChanges.length} user${appliedChanges.length === 1 ? '' : 's'}`,
        changes: loggedChanges,
        changeSummary: { added: 0, removed: 0, replaced: appliedChanges.length, total: appliedChanges.length },
        changesTruncated: appliedChanges.length > loggedChanges.length,
        bulk: {
          affectedCount: appliedChanges.length,
          resourceIds: appliedChanges.slice(0, 100).map((entry) => String(entry.userId)),
          truncated: appliedChanges.length > 100,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating users by permission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET route to fetch a single user by userId
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select('-password').lean();
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
      role: role ? { _id: role._id, role_name: role.role_name, inStoreAccount: role.inStoreAccount } : null,
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

    const before = auditableUserState(user);

    user.role = roleId;
    await user.save();
    await logChange(req, {
      action: 'update', resourceType: 'user-role', resourceId: user._id,
      success: true, statusCode: 200, source: 'settings.users',
      resourceLabel: userLabel(user), before, after: auditableUserState(user),
    });
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const before = auditableUserState(user);
    user.site_access = siteAccess;
    await user.save();
    await logChange(req, {
      action: 'update', resourceType: 'user-site-access', resourceId: user._id,
      success: true, statusCode: 200, source: 'settings.users',
      resourceLabel: userLabel(user), before, after: auditableUserState(user),
    });
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
    const before = auditableUserState(user);

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
    // 3. Identify custom overrides with "Parent Guarantee" logic
    const customPermissionsArray = [];

    // Helper to add or update an override in the array (prevents duplicates)
    const setOverride = (permId, value) => {
      const existingIdx = customPermissionsArray.findIndex(p => p.permId === permId);
      if (existingIdx > -1) {
        customPermissionsArray[existingIdx].value = value;
      } else {
        customPermissionsArray.push({ permId, value });
      }
    };

    flattenedIncoming.forEach(uPerm => {
      const roleValue = roleMap.get(uPerm.permId);

      // A: Standard Difference Check
      if (uPerm.value !== roleValue) {
        setOverride(uPerm.permId, uPerm.value);
      }

      // B: THE FUTURE-PROOF PARENT GUARANTEE
      // If this permission is TRUE, we force the entire path to the root 
      // to be saved as TRUE in the customPermissionsArray.
      if (uPerm.value === true) {
        let currentParentId = parentMap.get(uPerm.permId);

        while (currentParentId) {
          // 🔥 FORCE save the parent as TRUE in overrides.
          // This way, even if the Role changes the parent to FALSE later,
          // this User's specific override will keep their access active.
          setOverride(currentParentId, true);

          // Move up to the next ancestor
          currentParentId = parentMap.get(currentParentId);
        }
      }
    });

    // 4. Save to User
    user.customPermissionsArray = customPermissionsArray;
    // Mark modified if using Mixed types or just to be safe
    user.markModified('customPermissionsArray');

    await user.save();

    await logChange(req, {
      action: 'update', resourceType: 'user-permission', resourceId: user._id,
      success: true, statusCode: 200, source: 'settings.users',
      resourceLabel: userLabel(user), before, after: auditableUserState(user),
      diffOptions: { arrayKeys: { customPermissionsArray: 'permId' } },
    });

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

    const before = auditableUserState(user);

    user.is_active = is_active;

    // If user is being deactivated, clear sensitive fields
    if (is_active === false) {
      user.role = null;
      user.custom_permissions = [];
      user.customPermissionsArray = [];

      // Set all site_access values to false
      if (user.site_access && user.site_access.size > 0) {
        for (const key of user.site_access.keys()) {
          user.site_access.set(key, false);
        }
      }
    }

    await user.save();

    await logChange(req, {
      action: 'update', resourceType: 'user', resourceId: user._id,
      success: true, statusCode: 200, source: 'settings.users',
      resourceLabel: userLabel(user), before, after: auditableUserState(user),
      diffOptions: { arrayKeys: { customPermissionsArray: 'permId' } },
    });

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

    await logChange(req, {
      action: 'update', resourceType: 'user-session', resourceId: updatedUser._id,
      success: true, statusCode: 200, source: 'settings.users',
      resourceLabel: userLabel(updatedUser),
      before: { is_loggedIn: true }, after: { is_loggedIn: false },
    });

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

    const affectedIds = usersToLogout.map((user) => String(user._id));
    await logChange(req, {
      action: 'update', resourceType: 'user-session', success: true, statusCode: 200,
      source: 'settings.users',
      message: `Administrative logout completed for ${affectedIds.length} non-admin user${affectedIds.length === 1 ? '' : 's'}`,
      bulk: { affectedCount: affectedIds.length, resourceIds: affectedIds.slice(0, 100), truncated: affectedIds.length > 100 },
      changes: [{ operation: 'replace', path: 'is_loggedIn', before: true, after: false }],
      changeSummary: { added: 0, removed: 0, replaced: 1, total: 1 },
    });

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
