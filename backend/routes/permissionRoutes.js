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
// router.post("/", async (req, res) => {
//   try {
//     let { module_name, structure } = req.body;
//     // module_name = module_name.trim().toLowerCase().replace(/\s+/g, "-");
//     // structure = normalizeStructure(structure);

//     const exists = await Permission.findOne({ module_name });
//     if (exists) {
//       return res.status(400).json({ message: "Module name already exists" });
//     }

//     const newPermission = new Permission({ module_name, structure });
//     await newPermission.save();

//     // ---- Merge into all existing roles ----
//     const allRoles = await Role.find({});
//     for (const role of allRoles) {
//       // find existing module node
//       const existingModule = role.permissions.find(p => p.name === module_name);

//       if (existingModule) {
//         // merge structure preserving values
//         existingModule.children = mergePermissions(structure, existingModule.children || []);
//       } else {
//         // new module entirely
//         role.permissions.push({
//           name: module_name,
//           value: false,
//           children: mergePermissions(structure, [])
//         });
//       }

//       await role.save();
//     }

//     res.status(201).json(newPermission);
//   } catch (error) {
//     console.error("Error creating permission:", error);
//     res.status(500).json({ message: "Server error creating permission" });
//   }
// });

router.post("/", async (req, res) => {
  try {
    let { module_name, structure } = req.body;

    // 1️⃣ Check if module already exists
    const exists = await Permission.findOne({ module_name });
    if (exists) {
      return res.status(400).json({ message: "Module name already exists" });
    }

    // 2️⃣ Calculate the next module_permId (5000 series logic)
    // We look for the highest module_permId currently in the database
    const lastModule = await Permission.findOne().sort({ module_permId: -1 });
    
    // If no modules exist, start at 5000. Otherwise, add 5000 to the last base.
    const nextModuleId = lastModule ? lastModule.module_permId + 5000 : 5000;

    // 3️⃣ Create the new Permission Module
    const newPermission = new Permission({ 
      module_name, 
      structure, 
      module_permId: nextModuleId 
    });

    // The pre-validate hook in Permission model will now trigger 
    // and assign permIds to the children based on this nextModuleId.
    await newPermission.save();

    // 4️⃣ Extract all newly generated permIds from the saved structure
    const newPermIds = [];
    newPermIds.push(newPermission.module_permId); // Add the root ID

    const extractIds = (nodes) => {
      for (const node of nodes) {
        if (node.permId) newPermIds.push(node.permId);
        if (node.children?.length) extractIds(node.children);
      }
    };
    extractIds(newPermission.structure);

    // 5️⃣ Update all existing Roles to include these new IDs
    // New permissions default to 'false' for all existing roles
    const newRoleEntries = newPermIds.map(id => ({
      permId: id,
      value: false
    }));

    await Role.updateMany(
      {}, 
      { 
        $push: { 
          permissionsArray: { $each: newRoleEntries } 
        } 
      }
    );

    /**
     * NOTE: We do NOT need to update User customPermissionsArray here.
     * Users only store overrides. Since the module is brand new, 
     * no user could have an override for it yet.
     */

    res.status(201).json({
      message: "Module created and synced with roles",
      data: newPermission
    });

  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({ message: "Server error creating permission", error: error.message });
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


// const mergePermissionsForRename = (newStructure = [], oldStructure = []) => {
//   return newStructure.map(newNode => {
//     // Try to find matching old node by name OR by the oldName property
//     const existing = oldStructure.find(o => 
//       o.name === newNode.name || (newNode.oldName && o.name === newNode.oldName)
//     );

//     return {
//       name: newNode.name,
//       value: existing ? existing.value : false, // Preserve existing checkbox state
//       children: mergePermissionsForRename(
//         newNode.children || [],
//         existing ? existing.children : []
//       )
//     };
//   });
// };

// router.put("/:id", async (req, res) => {
//   try {
//     const { module_name, old_module_name, structure } = req.body;

//     // 1. Update the Master Permission document
//     const updatedMaster = await Permission.findByIdAndUpdate(
//       req.params.id,
//       { module_name, structure },
//       { new: true }
//     );
//     if (!updatedMaster) return res.status(404).json({ message: "Permission not found" });

//     // 2. Fetch all Master permissions to ensure we have the full current state
//     const allMasterPermissions = await Permission.find({});
//     const allRoles = await Role.find({});

//     const updatePromises = allRoles.map(async (role) => {
//       const updatedPermissions = [];
//       const seenNames = new Set();

//       // We reconstruct the role's permissions based on EVERY master permission
//       for (const master of allMasterPermissions) {
//         if (seenNames.has(master.module_name)) continue;
//         seenNames.add(master.module_name);

//         // Try to find the existing role data
//         // Check for the NEW name OR the OLD name to bridge the gap during a rename
//         const existing = role.permissions.find(p => 
//           p.name === master.module_name || p.name === old_module_name
//         );

//         updatedPermissions.push({
//           name: master.module_name,
//           value: existing ? existing.value : false,
//           children: mergePermissionsForRename(
//             master.structure, 
//             existing ? existing.children : []
//           )
//         });
//       }

//       role.permissions = updatedPermissions;
//       role.markModified('permissions');
//       return role.save();
//     });

//     await Promise.all(updatePromises);
//     res.status(200).json(updatedMaster);

//   } catch (error) {
//     console.error("Critical Update Error:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });


router.put("/:id", async (req, res) => {
  try {
    const { module_name, structure } = req.body;

    // 1️⃣ Update the Permission Module
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ message: "Permission not found" });

    permission.module_name = module_name;
    permission.structure = structure;
    
    // The pre-validate hook in your model automatically handles permId assignment
    // We save first so we can work with the finalized IDs
    await permission.save(); 
    permission.markModified("structure");

    // 2️⃣ Get the "Source of Truth" for THIS module only
    const currentModuleIds = new Set();
    currentModuleIds.add(permission.module_permId); // The module root ID

    const extractIds = (nodes) => {
      for (const node of nodes) {
        if (node.permId) currentModuleIds.add(node.permId);
        if (node.children?.length) extractIds(node.children);
      }
    };
    extractIds(permission.structure);

    /**
     * Now we need to know which IDs belong to this module range 
     * based on your 5000-block logic.
     */
    const rangeMin = permission.module_permId;
    const rangeMax = permission.module_permId + 4999;

    // 3️⃣ Update All Roles
    const roles = await Role.find({});
    const rolePromises = roles.map(async (role) => {
      // Create a map of current permissions to preserve existing Boolean values
      const rolePermMap = new Map(role.permissionsArray.map(p => [p.permId, p.value]));

      // A: Filter out IDs that were deleted from THIS module range
      // (Leave IDs from other modules untouched)
      let updatedArray = role.permissionsArray.filter(p => {
        const isFromThisModule = p.permId >= rangeMin && p.permId <= rangeMax;
        if (!isFromThisModule) return true; // Keep other modules
        return currentModuleIds.has(p.permId); // Keep only if still in this module
      });

      // B: Add new IDs that don't exist in the role yet
      currentModuleIds.forEach(pid => {
        const alreadyHasIt = updatedArray.some(p => p.permId === pid);
        if (!alreadyHasIt) {
          updatedArray.push({ permId: pid, value: false }); // New perms default to false
        }
      });

      role.permissionsArray = updatedArray;
      role.markModified('permissionsArray');
      return role.save();
    });

    // 4️⃣ Update All Users (Custom Overrides)
    const users = await User.find({ "customPermissionsArray.0": { $exists: true } });
    const userPromises = users.map(async (user) => {
      // Users only store overrides, so we only need to DELETE orphaned IDs
      const initialCount = user.customPermissionsArray.length;
      
      user.customPermissionsArray = user.customPermissionsArray.filter(p => {
        const isFromThisModule = p.permId >= rangeMin && p.permId <= rangeMax;
        if (!isFromThisModule) return true; // Keep other modules
        return currentModuleIds.has(p.permId); // Remove if deleted from module
      });

      if (user.customPermissionsArray.length !== initialCount) {
        user.markModified('customPermissionsArray');
        return user.save();
      }
    });

    await Promise.all([...rolePromises, ...userPromises]);

    res.status(200).json({
      message: "Permission and associated Roles/Users synced successfully",
      data: permission
    });

  } catch (error) {
    console.error("Permission Sync Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
