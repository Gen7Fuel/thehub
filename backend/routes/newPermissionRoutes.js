const express = require('express');
const router = express.Router();
const PermissionRegistry = require('../models/PermissionRegistry');
const { authenticateToken, requirePermission } = require('../middleware/auth'); // Adjust path as needed

// Helper function to validate permission path
const validatePermissionPath = (path) => {
  if (!path || typeof path !== 'string') return false;
  const pathRegex = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;
  return pathRegex.test(path);
};

// GET /api/permission-registry - Get the current permission registry
router.get('/', authenticateToken, async (req, res) => {
  try {
    const registry = await PermissionRegistry.getCurrentRegistry();
    res.json({
      success: true,
      data: registry
    });
  } catch (error) {
    console.error('Error fetching permission registry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission registry',
      error: error.message
    });
  }
});

// GET /api/permission-registry/structure - Get just the registry structure
router.get('/structure', authenticateToken, async (req, res) => {
  try {
    const registry = await PermissionRegistry.getCurrentRegistry();
    res.json({
      success: true,
      data: registry.registry
    });
  } catch (error) {
    console.error('Error fetching permission structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission structure',
      error: error.message
    });
  }
});

// POST /api/permission-registry/permission - Create or update a permission
router.post('/permission', authenticateToken, async (req, res) => {
  try {
    const { path, value, description } = req.body;
    
    // Validate input
    if (!validatePermissionPath(path)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permission path format'
      });
    }
    
    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: 'Permission value is required'
      });
    }
    
    const registry = await PermissionRegistry.getCurrentRegistry();
    await registry.updatePermission(path, value, req.user.id);
    
    if (description) {
      registry.metadata.description = description;
      await registry.save();
    }
    
    res.json({
      success: true,
      message: 'Permission created/updated successfully',
      data: registry.registry
    });
  } catch (error) {
    console.error('Error creating/updating permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update permission',
      error: error.message
    });
  }
});

// PUT /api/permission-registry/permission/:path - Update a specific permission
router.put('/permission/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0]; // Get the wildcard path
    const { value } = req.body;
    
    if (!validatePermissionPath(path)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permission path format'
      });
    }
    
    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: 'Permission value is required'
      });
    }
    
    const registry = await PermissionRegistry.getCurrentRegistry();
    await registry.updatePermission(path, value, req.user.id);
    
    res.json({
      success: true,
      message: 'Permission updated successfully',
      data: registry.registry
    });
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permission',
      error: error.message
    });
  }
});

// DELETE /api/permission-registry/permission/:path - Delete a permission
router.delete('/permission/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0]; // Get the wildcard path
    
    if (!validatePermissionPath(path)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permission path format'
      });
    }
    
    const registry = await PermissionRegistry.getCurrentRegistry();
    const result = await registry.deletePermission(path, req.user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Permission path not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Permission deleted successfully',
      data: registry.registry
    });
  } catch (error) {
    console.error('Error deleting permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete permission',
      error: error.message
    });
  }
});

// POST /api/permission-registry/bulk - Bulk update permissions
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        message: 'Operations must be an array'
      });
    }
    
    const registry = await PermissionRegistry.getCurrentRegistry();
    
    for (const operation of operations) {
      const { action, path, value } = operation;
      
      if (!validatePermissionPath(path)) {
        return res.status(400).json({
          success: false,
          message: `Invalid permission path format: ${path}`
        });
      }
      
      if (action === 'create' || action === 'update') {
        await registry.updatePermission(path, value, req.user.id);
      } else if (action === 'delete') {
        await registry.deletePermission(path, req.user.id);
      } else {
        return res.status(400).json({
          success: false,
          message: `Invalid action: ${action}`
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Bulk operations completed successfully',
      data: registry.registry
    });
  } catch (error) {
    console.error('Error performing bulk operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk operations',
      error: error.message
    });
  }
});

module.exports = router;