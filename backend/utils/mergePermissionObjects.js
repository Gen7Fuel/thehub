// Simply clones the frontend permission tree for that module
const _ = require("lodash");

// rolePermissions: permissions from frontend (for this module)
// templatePermissions: full template structure (only for structure reference)
function mergeRolePermissions(rolePermissions, templatePermissions) {
  // We don't really need the template unless you want to enforce structure
  // For now, just clone rolePermissions to prevent mutation
  return _.cloneDeep(rolePermissions || []);
}

module.exports = mergeRolePermissions;