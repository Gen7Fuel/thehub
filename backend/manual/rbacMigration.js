/**
 * RBAC Migration Script (FINAL VERSION)
 * - Module itself is treated as a permission node (e.g., "Accounting" -> 5000)
 * - Sequential permIds for children (e.g., "Accounting.Invoices" -> 5001)
 * - Populates flat arrays: permissionsArray (Roles) and customPermissionsArray (Users)
 */

const mongoose = require("mongoose");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const User = require("../models/User");

/* ------------------------------------------------------------------ */
/* 1️⃣ Assign permIds sequentially within module range                */
/* ------------------------------------------------------------------ */
function assignPermIdsSequential(nodes, moduleBaseId) {
  let maxUsedId = moduleBaseId;

  // Deep search for the highest ID already assigned in this tree
  function findMax(treeNodes) {
    for (const node of treeNodes) {
      if (node.permId && node.permId > maxUsedId) {
        maxUsedId = node.permId;
      }
      if (node.children?.length) findMax(node.children);
    }
  }

  // Assign IDs to any node (at any depth) missing one
  function assign(treeNodes) {
    for (const node of treeNodes) {
      if (!node.permId) {
        maxUsedId += 1;
        node.permId = maxUsedId;
      }
      if (node.children?.length) assign(node.children);
    }
  }

  findMax(nodes);
  assign(nodes);
}

/* ------------------------------------------------------------------ */
/* 2️⃣ Migrate permission modules                                      */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* 2️⃣ Migrate permission modules (STRICT SAVE VERSION)               */
/* ------------------------------------------------------------------ */
async function migratePermissionTrees() {
  const permissions = await Permission.find();
  let baseModuleId = 5000;

  for (const perm of permissions) {
    if (!perm.module_permId) {
      perm.module_permId = baseModuleId;
      baseModuleId += 5000;
    }

    if (perm.structure?.length) {
      // 1. Assign the IDs in the nested objects
      assignPermIdsSequential(perm.structure, perm.module_permId);

      // 2. IMPORTANT: Tell Mongoose that the deep structure has changed
      // Without this, Level 2+ children often don't persist to MongoDB
      perm.markModified("structure");
    }

    await perm.save();
    console.log(`✔ Permission module "${perm.module_name}" saved to DB.`);
  }

  return permissions;
}

/* ------------------------------------------------------------------ */
/* 3️⃣ Build path-based permission map (RECURSIVE)                    */
/* ------------------------------------------------------------------ */
function buildPermissionMap(permissionDocs) {
  const map = new Map();

  function walk(node, currentPath) {
    // Build the dot-notation path: e.g. "Accounting.Invoices.Delete"
    const fullPath = `${currentPath}.${node.name}`;

    if (map.has(fullPath)) {
      console.warn(`⚠️ Warning: Duplicate path detected: ${fullPath}`);
    }

    map.set(fullPath, node.permId);

    if (node.children?.length) {
      for (const child of node.children) {
        walk(child, fullPath);
      }
    }
  }

  for (const perm of permissionDocs) {
    // Treat the Module Name itself as the root permission
    map.set(perm.module_name, perm.module_permId);

    // Map all nested children under the module name
    if (perm.structure?.length) {
      for (const rootNode of perm.structure) {
        walk(rootNode, perm.module_name);
      }
    }
  }

  return map;
}

/* ------------------------------------------------------------------ */
/* 4️⃣ Flatten tree into flat array                                   */
/* ------------------------------------------------------------------ */
function flattenPermissionTree(node, permissionMap, currentPath, out = []) {
  // If currentPath is empty, we are at the module root
  const fullPath = currentPath ? `${currentPath}.${node.name}` : node.name;

  const permId = permissionMap.get(fullPath);

  if (!permId) {
    console.error(`❌ Missing permId for path: ${fullPath}. Check if this exists in the Permission model.`);
  } else {
    out.push({ permId, value: node.value ?? false });
  }

  // Recurse to the very bottom of the tree
  if (node.children?.length) {
    for (const child of node.children) {
      flattenPermissionTree(child, permissionMap, fullPath, out);
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* 5️⃣ Migrate Roles                                                  */
/* ------------------------------------------------------------------ */
async function migrateRoles(permissionMap) {
  const roles = await Role.find();

  for (const role of roles) {
    if (!role.permissions?.length) continue;

    const flattened = [];

    for (const moduleTree of role.permissions) {
      // Re-package the module as a node to include it in the flat array
      const moduleNode = {
        name: moduleTree.name,
        value: moduleTree.value ?? false, // Typically, if a role has the module, the root node is true
        children: moduleTree.children || [],
      };

      // Start flattening with empty path because the node.name IS the module name
      flattenPermissionTree(moduleNode, permissionMap, "", flattened);
    }

    role.permissionsArray = flattened;
    await role.save();
    console.log(`✔ Role migrated: ${role.role_name} (${flattened.length} IDs mapped)`);
  }
}

/* ------------------------------------------------------------------ */
/* 6️⃣ Migrate Users                                                  */
/* ------------------------------------------------------------------ */
async function migrateUsers(permissionMap) {
  const users = await User.find({
    custom_permissions: { $exists: true, $ne: [] },
  });

  for (const user of users) {
    const flattened = [];

    for (const moduleTree of user.custom_permissions) {
      const moduleNode = {
        name: moduleTree.name,
        value: moduleTree.value ?? false,
        children: moduleTree.children || [],
      };
      flattenPermissionTree(moduleNode, permissionMap, "", flattened);
    }

    user.customPermissionsArray = flattened;
    await user.save();
    console.log(`✔ User migrated: ${user.email} (${flattened.length} custom overrides)`);
  }
}

/* ------------------------------------------------------------------ */
/* 7️⃣ Runner                                                          */
/* ------------------------------------------------------------------ */
async function runMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🚀 Starting RBAC migration (ID-based)...\n");

    // Phase 1: Update Permission Model and assign all IDs
    const permissionDocs = await migratePermissionTrees();

    // Phase 2: Build Lookup Map
    const permissionMap = buildPermissionMap(permissionDocs);

    console.log("\n--- DEBUG: Sample Mappings ---");
    const samples = Array.from(permissionMap.entries()).slice(0, 15);
    console.table(samples.map(([path, id]) => ({ "Permission Path": path, "Assigned ID": id })));
    console.log("------------------------------\n");

    // Phase 3: Migrate Roles and Users using the Map
    await migrateRoles(permissionMap);
    await migrateUsers(permissionMap);

    console.log("\n🎉 RBAC migration completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();