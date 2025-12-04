const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require('../models/User');
const _ = require("lodash");
const Role = require("../models/Role");
const getMergedPermissions = require("../utils/mergePermissionObjects")

// Compare frontend permissions with role.permissions to find overrides for saving them as custom permissions in users
const getOverrides = (roleNodes = [], userNodes = []) => {
  const roleMap = _.keyBy(roleNodes, "name");
  const userMap = _.keyBy(userNodes, "name");

  return _.compact(
    _.map(userMap, (uNode, key) => {
      const rNode = roleMap[key];
      if (!rNode) return uNode; // new permission branch

      let hasOverride = false;

      // Check if value differs
      if (_.isBoolean(uNode.value) && uNode.value !== rNode.value) hasOverride = true;

      // Recursively check children
      let childrenOverrides = [];
      if (uNode.children && uNode.children.length > 0) {
        childrenOverrides = getOverrides(rNode.children || [], uNode.children);
        if (childrenOverrides.length > 0) hasOverride = true;
      }

      if (hasOverride) {
        return {
          name: uNode.name,
          value: uNode.value,
          ...(childrenOverrides.length > 0 ? { children: childrenOverrides } : {}),
        };
      }

      return null; // no override, skip
    })
  );
};

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
// router.get('/:userId', async (req, res) => {
//   const { userId } = req.params;

//   try {
//     const user = await User.findById(userId); // Find user by ID
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' }); // Return 404 if user doesn't exist
//     }
//     res.status(200).json(user); // Send the user as a JSON response
//   } catch (error) {
//     console.error('Error fetching user:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get role details
    const role = user.role ? await Role.findById(user.role).lean() : null;
    const roleData = role ? { _id: role._id, role_name: role.role_name } : null;

    // Merge role + custom permissions
    const mergedPermissions = await getMergedPermissions(user);

    res.status(200).json({
      ...user,
      role: roleData,
      merged_permissions: mergedPermissions,
      is_logged_in: user.is_loggedIn,
      last_login: user.lastLoginDate
    });
  } catch (error) {
    console.error("Error fetching user with merged permissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
// router.put('/:userId', async (req, res) => {
//   const { userId } = req.params;
//   const { access } = req.body; // Extract the 'access' object from the request body

//   if (!access || typeof access !== 'object') {
//     return res.status(400).json({ error: 'Invalid or missing access object' });
//   }

//   try {
//     const updatedUser = await User.findByIdAndUpdate(
//       userId, // Find the user by _id
//       { $set: { access } }, // Update the 'access' attribute
//       { new: true } // Return the updated document
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ error: 'User not found' }); // Return 404 if user doesn't exist
//     }

//     res.status(200).json(updatedUser); // Send the updated user as a JSON response
//   } catch (error) {
//     console.error('Error updating user access:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// router.put('/:userId', async (req, res) => {
//   const { userId } = req.params;
//   const { access, is_admin, is_inOffice } = req.body;

//   try {
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       {
//         $set: {
//           access: access || {},
//           is_admin: is_admin ?? false,
//           is_inOffice: is_inOffice ?? false,
//         },
//       },
//       { new: true }
//     );

//     if (!updatedUser) return res.status(404).json({ error: 'User not found' });

//     res.status(200).json(updatedUser);
//   } catch (err) {
//     console.error('Error updating user:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
router.put("/:userId/permissions", async (req, res) => {
  const { userId } = req.params;
  const { mergedPermissions, roleId } = req.body;

  if (!mergedPermissions || !roleId) {
    return res.status(400).json({ error: "Missing permissions or role ID" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const customPermissions = getOverrides(role.permissions, mergedPermissions);

    // Update user
    user.custom_permissions = customPermissions;
    await user.save();
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("permissions-updated");
    }

    res.json({ success: true, custom_permissions: customPermissions });
  } catch (err) {
    console.error("Error updating custom permissions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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