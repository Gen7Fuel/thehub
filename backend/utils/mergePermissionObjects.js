// Simply clones the frontend permission tree for that module
const _ = require("lodash");
const Role = require("../models/Role");
const Permission = require("../models/Permission");

// rolePermissions: permissions from frontend (for this module)
// templatePermissions: full template structure (only for structure reference)
// async function getMergedPermissions(user) {
//   if (!user.role) return user.custom_permissions;

//   const role = await Role.findById(user.role);
//   if (!role) return user.custom_permissions;

//   // Custom merge function that merges permission trees
//   const mergePermissionNodes = (roleNodes = [], userNodes = []) => {
//     const roleMap = _.keyBy(roleNodes, "name");
//     const userMap = _.keyBy(userNodes, "name");

//     return _.map(roleMap, (rNode) => {
//       const uNode = userMap[rNode.name];

//       const merged = _.mergeWith(_.cloneDeep(rNode), uNode, (objValue, srcValue, key) => {
//         if (key === "value") return _.isBoolean(srcValue) ? srcValue : objValue;
//         if (key === "children") return mergePermissionNodes(objValue || [], srcValue || []);
//         return undefined;
//       });

//       return merged;
//     });
//   };
//   return mergePermissionNodes(role.permissions || [], user.custom_permissions || [])
// }
async function getMergedPermissions(user) {
  if (!user.role) return user.custom_permissions;

  const role = await Role.findById(user.role);
  if (!role) return user.custom_permissions;

  // Recursive function that uses the ROLE as the skeleton
  const syncAndMerge = (roleNodes = [], userNodes = []) => {
    return roleNodes.map((rNode) => {
      // Find if the user has an override for THIS specific node
      const uNode = userNodes.find(u => u.name === rNode.name);

      return {
        name: rNode.name,
        // Use user value if it exists, otherwise use role value
        value: (uNode && typeof uNode.value === 'boolean') ? uNode.value : rNode.value,
        // Recursively merge children using the role's children as the skeleton
        children: syncAndMerge(rNode.children || [], uNode ? uNode.children : [])
      };
    });
  };

  return syncAndMerge(role.permissions || [], user.custom_permissions || []);
}

// 1. Define the helper function at the TOP of the file (or import it)
/**
 * Recursively merges values from the flat role permissions array into the permission tree structure.
 * This is a synchronous utility function.
 */
function hydrateTreeValues(structure, roleValuesMap) {
  if (!structure || !Array.isArray(structure)) return [];

  return structure.map((node) => {
    // Convert Mongoose document to plain object to avoid circular logic
    const plainNode = node.toObject ? node.toObject() : node;

    // Create the hydrated node with the value from the Map
    const hydratedNode = {
      ...plainNode,
      value: roleValuesMap.get(plainNode.permId) ?? false,
    };

    // Recursively handle children
    if (hydratedNode.children && hydratedNode.children.length > 0) {
      hydratedNode.children = hydrateTreeValues(hydratedNode.children, roleValuesMap);
    }

    return hydratedNode;
  });
}

/**
 * Recursively flattens a hydrated permission tree into a flat array of { permId, value }.
 */
function flattenHydratedTree(nodes, result = []) {
  for (const node of nodes) {
    // 1. Push the current node's ID and value
    if (node.permId) {
      result.push({
        permId: node.permId,
        value: !!node.value // Ensure it's a boolean
      });
    }

    // 2. Recurse into children
    if (node.children && node.children.length > 0) {
      flattenHydratedTree(node.children, result);
    }
  }
  return result;
}

async function getMergedPermissionsTreeArray(user) {
  // 1. Fetch data
  const [allMasterPermissions, role] = await Promise.all([
    Permission.find({}).sort({ module_name: 1 }),
    user.role ? Role.findById(user.role).lean() : Promise.resolve(null)
  ]);

  const mergedValuesMap = new Map();

  // 2. Map Role values
  if (role && role.permissionsArray) {
    role.permissionsArray.forEach(p => mergedValuesMap.set(p.permId, p.value));
  }

  // 3. Map User Overrides
  if (user.customPermissionsArray && user.customPermissionsArray.length > 0) {
    user.customPermissionsArray.forEach(p => mergedValuesMap.set(p.permId, p.value));
  }

  // 4. Hydrate into the tree format the frontend expects
  const mergedPermissionsTree = allMasterPermissions.map(module => ({
    name: module.module_name,
    permId: module.module_permId, // Extra info, won't break the frontend
    value: mergedValuesMap.get(module.module_permId) ?? false,
    children: hydrateTreeValues(module.structure, mergedValuesMap)
  }));

  return mergedPermissionsTree;
}

module.exports = { getMergedPermissions, hydrateTreeValues, flattenHydratedTree, getMergedPermissionsTreeArray };