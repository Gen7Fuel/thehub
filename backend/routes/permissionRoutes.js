const express = require("express");
const router = express.Router();
const Permission = require("../models/Permission");
const User = require('../models/User');
const Role = require("../models/Role");

// For normalising permission names and structure
// const normalizeStructure = (nodes = []) => {
//   return nodes.map(node => ({
//     ...node,
//     name: node.name.trim().toLowerCase().replace(/\s+/g, "-"),
//     children: normalizeStructure(node.children),
//   }));
// };

// recursively merge template nodes into role nodes
const mergePermissions = (templateNodes, roleNodes = []) => {
  const merged = [];

  for (const tmplNode of templateNodes) {
    // find corresponding node in role
    const existing = roleNodes.find(r => r.name === tmplNode.name);

    if (existing) {
      // preserve value, merge children recursively
      merged.push({
        name: tmplNode.name,
        value: existing.value ?? false,
        children: mergePermissions(tmplNode.children || [], existing.children || [])
      });
    } else {
      // add new node with value false (default)
      merged.push({
        name: tmplNode.name,
        value: false,
        children: mergePermissions(tmplNode.children || [], [])
      });
    }
  }

  return merged;
}


// Get all permissions
// router.get("/", async (req, res) => {
//   try {
//     const permissions = await Permission.find();
//     res.status(200).json(permissions);
//   } catch (err) {
//     console.error("Error fetching permissions:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// New Permissions Get Route
router.get("/", async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ module_name: 1 }); // sort alphabetically
    res.status(200).json(permissions);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({ message: "Server error fetching permissions" });
  }
});

// get permission (new model) by id
router.get("/:id", async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ message: "Permission not found" });
    res.status(200).json(permission);
  } catch (error) {
    console.error("Error fetching permission:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add new permission
// router.post("/", async (req, res) => {
//   const { name } = req.body;
//   if (!name) return res.status(400).json({ error: "Permission name required" });

//   try {
//     // 1. Add new permission to collection
//     const newPermission = new Permission({ name });
//     await newPermission.save();

//     res.status(201).json({
//       success: true,
//       message: `Permission '${name}' added.`,
//     });
//   } catch (err) {
//     console.error("Error adding permission:", err);
//     res.status(500).json({
//       error: "Failed to add permission",
//       details: err.message,
//     });
//   }
// });
router.post("/", async (req, res) => {
  try {
    let { module_name, structure } = req.body;
    // module_name = module_name.trim().toLowerCase().replace(/\s+/g, "-");
    // structure = normalizeStructure(structure);

    const exists = await Permission.findOne({ module_name });
    if (exists) {
      return res.status(400).json({ message: "Module name already exists" });
    }

    const newPermission = new Permission({ module_name, structure });
    await newPermission.save();

    // ---- Merge into all existing roles ----
    const allRoles = await Role.find({});
    for (const role of allRoles) {
      // find existing module node
      const existingModule = role.permissions.find(p => p.name === module_name);

      if (existingModule) {
        // merge structure preserving values
        existingModule.children = mergePermissions(structure, existingModule.children || []);
      } else {
        // new module entirely
        role.permissions.push({
          name: module_name,
          value: false,
          children: mergePermissions(structure, [])
        });
      }

      await role.save();
    }

    res.status(201).json(newPermission);
  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({ message: "Server error creating permission" });
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
// router.put("/:id", async (req, res) => {
//   const { id } = req.params;
//   const { newName } = req.body;

//   try {
//     const permission = await Permission.findById(id);
//     if (!permission) return res.status(404).json({ error: "Permission not found" });

//     const oldName = permission.name;

//     // Check duplicate
//     const exists = await Permission.findOne({ name: newName });
//     if (exists) {
//       return res.status(400).json({ error: "Permission with this name already exists" });
//     }

//     // Update permission name in collection
//     permission.name = newName;
//     await permission.save();

//     // Rename field in all users
//     await User.updateMany(
//       { [`access.${oldName}`]: { $exists: true } },
//       {
//         $rename: {
//           [`access.${oldName}`]: `access.${newName}`
//         }
//       }
//     );

//     res.json({ message: "Permission renamed successfully" });
//   } catch (err) {
//     console.error("Error renaming permission:", err);
//     res.status(500).json({ error: "Failed to rename permission" });
//   }
// });


// routes/permissions.js
// router.put("/:id", async (req, res) => {
//   try {
//     let { module_name, structure } = req.body;
//     // module_name = module_name.trim().toLowerCase().replace(/\s+/g, "-");
//     // structure = normalizeStructure(structure);

//     const updated = await Permission.findByIdAndUpdate(
//       req.params.id,
//       { module_name, structure },
//       { new: true }
//     );
//     if (!updated) return res.status(404).json({ message: "Permission not found" });

//     // ---- Merge into all roles ----
//     const allRoles = await Role.find({});
//     for (const role of allRoles) {
//       const existingModule = role.permissions.find(p => p.name === module_name);

//       if (existingModule) {
//         existingModule.children = mergePermissions(structure, existingModule.children || []);
//       } else {
//         role.permissions.push({
//           name: module_name,
//           value: false,
//           children: mergePermissions(structure, [])
//         });
//       }

//       await role.save();
//     }

//     res.status(200).json(updated);
//   } catch (error) {
//     console.error("Error updating permission:", error);
//     res.status(500).json({ message: "Server error updating permission" });
//   }
// });

const mergePermissionsForRename = (newStructure = [], oldStructure = []) => {
  const merged = [];

  for (const newNode of newStructure) {
    const existing =
      // match by new name
      oldStructure.find(o => o.name === newNode.name) ||
      // match by old name (coming from frontend)
      oldStructure.find(o => o.name === newNode.oldName);

    if (existing) {
      merged.push({
        name: newNode.name, // updated name
        value: existing.value ?? false,
        children: mergePermissionsForRename(
          newNode.children || [],
          existing.children || []
        )
      });
    } else {
      merged.push({
        name: newNode.name,
        value: false,
        children: mergePermissionsForRename(newNode.children || [], [])
      });
    }
  }

  return merged;
};

// router.put("/:id", async (req, res) => {
//   try {
//     const { module_name, old_module_name, structure } = req.body;

//     // Update the permission document
//     const updated = await Permission.findByIdAndUpdate(
//       req.params.id,
//       { module_name, structure },
//       { new: true }
//     );
//     if (!updated) return res.status(404).json({ message: "Permission not found" });

//     // ---- Update existing modules in all roles ----
//     const allRoles = await Role.find({});
//     for (const role of allRoles) {
//       // Find the module by old name
//       const existingModule = role.permissions.find(p => p.name === old_module_name);

//       if (existingModule) {
//         // Update name and children
//         existingModule.name = module_name; 
//         existingModule.children = mergePermissions(structure, existingModule.children || []);
//         await role.save();
//       }
//       // No need to add new module here; POST route handles that
//     }

//     res.status(200).json(updated);
//   } catch (error) {
//     console.error("Error updating permission:", error);
//     res.status(500).json({ message: "Server error updating permission" });
//   }
// });

router.put("/:id", async (req, res) => {
  try {
    const { module_name, old_module_name, structure } = req.body;

    // Update permission document
    const updated = await Permission.findByIdAndUpdate(
      req.params.id,
      { module_name, structure },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Permission not found" });

    // Update Roles
    const allRoles = await Role.find({});
    for (const role of allRoles) {
      const existingModule = role.permissions.find(p => p.name === old_module_name);

      if (existingModule) {
        existingModule.name = module_name;
        existingModule.children = mergePermissionsForRename(
          structure,
          existingModule.children || []
        );

        await role.save();
      }
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({ message: "Server error updating permission" });
  }
});


module.exports = router;
