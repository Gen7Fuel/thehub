const PermissionRegistry = require('../models/PermissionRegistry');

class PermissionRegistryService {
  /**
   * Get the current permission registry
   */
  static async getRegistry() {
    return await PermissionRegistry.getCurrentRegistry();
  }

  /**
   * Get a specific permission value by path
   */
  static async getPermission(path) {
    const registry = await PermissionRegistry.getCurrentRegistry();
    return this.getValueByPath(registry.registry, path);
  }

  /**
   * Check if a permission exists
   */
  static async hasPermission(path) {
    const value = await this.getPermission(path);
    return value !== undefined;
  }

  /**
   * Get all permissions for a module
   */
  static async getModulePermissions(moduleName) {
    const registry = await PermissionRegistry.getCurrentRegistry();
    return registry.registry[moduleName] || {};
  }

  /**
   * Get all module names
   */
  static async getModules() {
    const registry = await PermissionRegistry.getCurrentRegistry();
    return Object.keys(registry.registry);
  }

  /**
   * Validate permission structure
   */
  static validatePermissionValue(value) {
    // Allow boolean, string, number, or array
    const validTypes = ['boolean', 'string', 'number'];
    const valueType = typeof value;
    
    if (validTypes.includes(valueType)) {
      return true;
    }
    
    if (Array.isArray(value)) {
      return true;
    }
    
    // Allow objects for nested structures
    if (valueType === 'object' && value !== null) {
      return true;
    }
    
    return false;
  }

  /**
   * Get nested value by dot notation path
   */
  static getValueByPath(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested value by dot notation path
   */
  static setValueByPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
    return obj;
  }

  /**
   * Delete nested value by dot notation path
   */
  static deleteValueByPath(obj, path) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      return current && current[key] ? current[key] : null;
    }, obj);
    
    if (target && target.hasOwnProperty(lastKey)) {
      delete target[lastKey];
      return true;
    }
    return false;
  }

  /**
   * Get all permission paths in the registry
   */
  static async getAllPermissionPaths() {
    const registry = await PermissionRegistry.getCurrentRegistry();
    return this.extractAllPaths(registry.registry);
  }

  /**
   * Recursively extract all paths from nested object
   */
  static extractAllPaths(obj, prefix = '') {
    const paths = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively get paths for nested objects
        paths.push(...this.extractAllPaths(value, currentPath));
      } else {
        // This is a leaf node (actual permission)
        paths.push(currentPath);
      }
    }
    
    return paths;
  }

  /**
   * Initialize default registry if none exists
   */
  static async initializeDefaultRegistry() {
    const existingRegistry = await PermissionRegistry.findOne({});
    
    if (!existingRegistry) {
      const defaultRegistry = {
        cycleCount: {
          sitePicker: { view: true, edit: true },
          summary: { view: true, export: true }
        },
        orders: { create: true, approve: true },
        managedSites: "list"
      };
      
      return await PermissionRegistry.create({
        registry: defaultRegistry,
        metadata: {
          description: 'Default permission registry'
        }
      });
    }
    
    return existingRegistry;
  }
}

module.exports = PermissionRegistryService;