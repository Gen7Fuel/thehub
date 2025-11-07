/**
 * Permission action types
 */
const PERMISSION_ACTIONS = {
  VIEW: 'view',
  EDIT: 'edit',
  CREATE: 'create',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  IMPORT: 'import',
  MANAGE: 'manage'
};

/**
 * Permission value types
 */
const PERMISSION_VALUE_TYPES = {
  BOOLEAN: 'boolean',
  LIST: 'list', // Represents array of IDs
  STRING: 'string',
  NUMBER: 'number',
  OBJECT: 'object'
};

/**
 * Default module structure templates
 */
const MODULE_TEMPLATES = {
  CRUD_MODULE: {
    view: true,
    create: true,
    edit: true,
    delete: true
  },
  
  VIEW_EXPORT_MODULE: {
    view: true,
    export: true
  },
  
  APPROVAL_MODULE: {
    view: true,
    create: true,
    approve: true
  },
  
  MANAGED_LIST_MODULE: "list" // For site-specific permissions
};

/**
 * Validation helpers
 */
const ValidationHelpers = {
  /**
   * Validate permission path format
   */
  isValidPath: (path) => {
    if (!path || typeof path !== 'string') return false;
    const pathRegex = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;
    return pathRegex.test(path);
  },

  /**
   * Validate permission value
   */
  isValidValue: (value) => {
    const validTypes = ['boolean', 'string', 'number'];
    const valueType = typeof value;
    
    if (validTypes.includes(valueType)) return true;
    if (Array.isArray(value)) return true;
    if (valueType === 'object' && value !== null) return true;
    
    return false;
  },

  /**
   * Get path depth
   */
  getPathDepth: (path) => {
    return path.split('.').length;
  },

  /**
   * Get parent path
   */
  getParentPath: (path) => {
    const parts = path.split('.');
    return parts.slice(0, -1).join('.');
  },

  /**
   * Get leaf name from path
   */
  getLeafName: (path) => {
    const parts = path.split('.');
    return parts[parts.length - 1];
  }
};

module.exports = {
  PERMISSION_ACTIONS,
  PERMISSION_VALUE_TYPES,
  MODULE_TEMPLATES,
  ValidationHelpers
};