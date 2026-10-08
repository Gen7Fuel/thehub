const { getPermissionMap } = require('./permissionStore');

/**
 * Whether a user effectively has a permission, given its numeric permId.
 * A per-user override wins; otherwise the role's setting applies; otherwise no.
 * (Same rule the other routes use; `user.role` must be populated.)
 */
function hasEffectiveAccess(user, permId) {
  if (!user || !permId) return false;
  const override = user.customPermissionsArray?.find((p) => p.permId === permId);
  if (override !== undefined) return !!override.value;
  const setting = user.role?.permissionsArray?.find((p) => p.permId === permId);
  return setting ? !!setting.value : false;
}

/** Same check by permission name, e.g. "accounting.cashRecIntacctEntry". */
function userHasPermission(user, name) {
  return hasEffectiveAccess(user, getPermissionMap().get(name));
}

module.exports = { hasEffectiveAccess, userHasPermission };
