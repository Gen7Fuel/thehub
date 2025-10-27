const express = require("express");
const router = express.Router();
const Permission = require("../models/Permission");
const User = require('../models/User');

// Get all permissions
router.get("/", async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.status(200).json(permissions);
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add new permission
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Permission name required" });

  try {
    // 1. Add new permission to collection
    const newPermission = new Permission({ name });
    await newPermission.save();

    res.status(201).json({
      success: true,
      message: `Permission '${name}' added.`,
    });
  } catch (err) {
    console.error("Error adding permission:", err);
    res.status(500).json({
      error: "Failed to add permission",
      details: err.message,
    });
  }
});


// Delete permission by ID
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Permission.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });

    res.status(200).json({ message: "Deleted successfully and removed from users" });
  } catch (err) {
    console.error("Error deleting permission:", err);
    res.status(500).json({ error: "Failed to delete permission" });
  }
});

// Sync permissions with all users (add missing, remove old)
// router.post("/sync", async (req, res) => {
//   try {
//     const permissions = await Permission.find().lean();
//     const permissionNames = permissions.map(p => p.name);

//     const users = await User.find();

//     for (const user of users) {
//       let updatedAccess = {};

//       // Add missing permissions, preserve old values
//       permissionNames.forEach(perm => {
//         updatedAccess[perm] = user.access?.[perm] ?? false;
//       });

//       // Assign cleaned object back
//       user.access = updatedAccess;
//       await user.save();
//     }

//     res.json({ success: true, message: "Permissions synced for all users." });
//   } catch (error) {
//     console.error("Error syncing permissions:", error);
//     res.status(500).json({ error: "Failed to sync permissions" });
//   }
// });
router.post("/sync", async (req, res) => {
  try {
    const permissions = await Permission.find().lean();
    const permissionNames = permissions.map((p) => p.name);

    const users = await User.find();

    for (const user of users) {
      let updatedAccess = {};

      for (const perm of permissions) {
        if (perm.name === "site_access" && Array.isArray(perm.sites)) {
          const sitesAccess = {};
          const existingSitesAccess = user.access?.site_access || {};
          if (user.is_inOffice) {
            // User is in office → full access to all sites
            perm.sites.forEach((site) => {
              sitesAccess[site] = true;
            });
          } else {
            // Not in office → preserve existing permissions
            perm.sites.forEach((site) => {
              sitesAccess[site] = existingSitesAccess[site] ?? false;
            });
          }
          updatedAccess[perm.name] = sitesAccess;
        } else {
          // For new permissions, set true if user is admin
          if (!(perm.name in (user.access || {})) && user.is_admin) {
            updatedAccess[perm.name] = true;
          } else {
            // Preserve existing value or default to false
            updatedAccess[perm.name] = user.access?.[perm.name] ?? false;
          }
        }
      }
      user.access = updatedAccess;
      await user.save();
    }

    res.json({ success: true, message: "Permissions synced for all users." });
  } catch (error) {
    console.error("Error syncing permissions:", error);
    res.status(500).json({ error: "Failed to sync permissions" });
  }
});


// Edit (rename) a permission
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;

  try {
    const permission = await Permission.findById(id);
    if (!permission) return res.status(404).json({ error: "Permission not found" });

    const oldName = permission.name;

    // Check duplicate
    const exists = await Permission.findOne({ name: newName });
    if (exists) {
      return res.status(400).json({ error: "Permission with this name already exists" });
    }

    // Update permission name in collection
    permission.name = newName;
    await permission.save();

    // Rename field in all users
    await User.updateMany(
      { [`access.${oldName}`]: { $exists: true } },
      {
        $rename: {
          [`access.${oldName}`]: `access.${newName}`
        }
      }
    );

    res.json({ message: "Permission renamed successfully" });
  } catch (err) {
    console.error("Error renaming permission:", err);
    res.status(500).json({ error: "Failed to rename permission" });
  }
});

module.exports = router;
