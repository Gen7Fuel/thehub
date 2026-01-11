const connectDB = require('../config/db');
const mongoose = require('mongoose');

const Permission = require("../models/Permission");
const Role = require("../models/Role");

const syncRolesWithMasterPermissions = async () => {
  try {
    // 1. Fetch the Source of Truth
    const masterPermissions = await Permission.find({});
    const allRoles = await Role.find({});

    console.log(`Starting sanity check for ${allRoles.length} roles...`);

    for (const role of allRoles) {
      let updatedPermissions = [];
      const seenModules = new Set();

      // 2. Iterate through Master Permissions to rebuild the Role structure
      for (const master of masterPermissions) {
        // Skip if we somehow process the same module name twice from Master
        if (seenModules.has(master.module_name)) continue;
        seenModules.add(master.module_name);

        // Find existing data in the role for this module
        // We take the FIRST one found to handle de-duplication
        const existingModule = role.permissions.find(p => p.name === master.module_name);

        // Reconstruct the module using a recursive deep merge
        const cleanedModule = {
          name: master.module_name,
          value: existingModule ? existingModule.value : false, // Preserve boolean state
          children: syncNodes(master.structure, existingModule ? existingModule.children : [])
        };

        updatedPermissions.push(cleanedModule);
      }

      // 3. Update the Role
      role.permissions = updatedPermissions;
      role.markModified('permissions');
      await role.save();
    }

    console.log("Sanity check completed successfully.");
    return { success: true, message: "Roles synchronized and de-duplicated." };
  } catch (error) {
    console.error("Sanity Check Failed:", error);
    throw error;
  }
};

/**
 * Recursive helper to merge master structure with existing role values
 */
const syncNodes = (masterNodes = [], roleNodes = []) => {
  return masterNodes.map(mNode => {
    // Match by name
    const existingNode = roleNodes.find(r => r.name === mNode.name);

    return {
      name: mNode.name,
      value: existingNode ? existingNode.value : false, // Keep value or default to false
      children: syncNodes(mNode.children || [], existingNode ? existingNode.children : [])
    };
  });
};


async function run() {
  let hadError = false;

  try {
    await connectDB();

    await syncRolesWithMasterPermissions();

  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch {}
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
module.exports = { run };