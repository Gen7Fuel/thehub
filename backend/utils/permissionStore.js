const Permission = require("../models/Permission");

let globalPermissionMap = new Map();

function buildPermissionMap(permissionDocs) {
  const map = new Map();
  function walk(node, currentPath) {
    const fullPath = `${currentPath}.${node.name}`;
    map.set(fullPath, node.permId);
    if (node.children?.length) {
      for (const child of node.children) walk(child, fullPath);
    }
  }
  for (const perm of permissionDocs) {
    map.set(perm.module_name, perm.module_permId);
    if (perm.structure?.length) {
      for (const rootNode of perm.structure) walk(rootNode, perm.module_name);
    }
  }
  return map;
}

const initializePermissionMap = async () => {
  try {
    const allMasterPermissions = await Permission.find({}).lean();
    globalPermissionMap = buildPermissionMap(allMasterPermissions);
    console.log("✅ Global Permission Map Initialized");
  } catch (err) {
    console.error("❌ Failed to initialize permission map:", err);
  }
};

const getPermissionMap = () => globalPermissionMap;

// Using CommonJS exports
module.exports = {
  initializePermissionMap,
  getPermissionMap
};