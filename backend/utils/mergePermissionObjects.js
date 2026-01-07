// Simply clones the frontend permission tree for that module
const _ = require("lodash");
const Role = require("../models/Role");

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

module.exports = getMergedPermissions;