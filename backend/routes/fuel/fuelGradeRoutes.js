const express = require('express');
const mongoose = require('mongoose');
const FuelGrade = require('../../models/fuel/FuelGrade');
const { ensureCstoreFuelTypes } = require('../../services/fuelGradePosMapping');
const { hasEffectiveAccess } = require('../../middleware/authMiddleware');
const { getPermissionMap } = require('../../utils/permissionStore');
const { logChange } = require('../../middleware/changeLogger');

const router = express.Router();
const editableFields = ['name', 'shortName', 'color', 'sortOrder', 'active', 'cstoreFuelTypes'];
const gradePermission = 'fuelManagement.manage.grades';
const optionsPermissions = [
  'fuelManagement.manage', 'fuelManagement.createOrder', 'fuelManagement.workspace', 'fuelManagement.orderPipeline',
  'fuelManagement.volume', 'fuelManagement.statistics',
];

function canAccessGrades(req, permission) {
  const permissionId = getPermissionMap().get(permission);
  return !!(req.user && permissionId && hasEffectiveAccess(req.user, req.user.role, permissionId));
}

router.get('/options', async (req, res) => {
  if (!optionsPermissions.some(permission => canAccessGrades(req, permission))) {
    return res.status(403).json({ message: 'Access denied for fuel grade options.' });
  }
  try {
    res.json(await FuelGrade.find({}, 'key name shortName color active -_id').sort({ sortOrder: 1, key: 1 }).lean());
  } catch (error) {
    console.error('Fuel grade options failed:', error);
    res.status(500).json({ message: 'Failed to load fuel grade options.' });
  }
});

router.use((req, res, next) => {
  if (!canAccessGrades(req, gradePermission)) {
    return res.status(403).json({ message: `Access denied for ${gradePermission}` });
  }
  next();
});

function handleWriteError(res, error) {
  if (error.code === 11000) {
    if (error.keyPattern?.cstoreFuelTypes) {
      return res.status(409).json({ message: 'That CStore fuel type code is already assigned to another grade.' });
    }
    return res.status(409).json({ message: 'A fuel grade with that key already exists.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message });
  }
  console.error('Fuel grade write failed:', error);
  return res.status(500).json({ message: 'Failed to save fuel grade.' });
}

function validCstoreFuelTypes(codes) {
  return codes === undefined || (Array.isArray(codes) && codes.every(code => typeof code === 'string'));
}

router.get('/', async (req, res) => {
  try {
    await ensureCstoreFuelTypes();
    res.json(await FuelGrade.find().sort({ sortOrder: 1, key: 1 }).lean());
  } catch (error) {
    console.error('Fuel grade list failed:', error);
    res.status(500).json({ message: 'Failed to load fuel grades.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, shortName, color, sortOrder, cstoreFuelTypes } = req.body ?? {};
    if (!validCstoreFuelTypes(cstoreFuelTypes)) {
      return res.status(400).json({ message: 'CStore fuel types must be an array of codes.' });
    }
    await ensureCstoreFuelTypes();
    const grade = await FuelGrade.create({ key: name, name, shortName, color, sortOrder, cstoreFuelTypes: cstoreFuelTypes ?? [] });
    await logChange(req, {
      action: 'create', resourceType: 'fuel-grade', resourceId: grade._id,
      resourceLabel: grade.name, before: null, after: grade.toObject(),
      success: true, statusCode: 201, source: 'fuel-management.manage.grades',
    });
    res.status(201).json(grade);
  } catch (error) {
    handleWriteError(res, error);
  }
});

router.patch('/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Invalid fuel grade ID.' });
  }

  const fields = Object.keys(req.body ?? {});
  if (!fields.length || fields.some((field) => !editableFields.includes(field))) {
    return res.status(400).json({ message: 'Provide editable fuel grade fields. The grade key is permanent.' });
  }
  if (!validCstoreFuelTypes(req.body.cstoreFuelTypes)) {
    return res.status(400).json({ message: 'CStore fuel types must be an array of codes.' });
  }

  try {
    await ensureCstoreFuelTypes();
    const grade = await FuelGrade.findById(req.params.id);
    if (!grade) return res.status(404).json({ message: 'Fuel grade not found.' });

    const before = grade.toObject();
    grade.set(req.body);
    await grade.save();
    await logChange(req, {
      action: 'update', resourceType: 'fuel-grade', resourceId: grade._id,
      resourceLabel: grade.name, before, after: grade.toObject(),
      success: true, statusCode: 200, source: 'fuel-management.manage.grades',
    });
    res.json(grade);
  } catch (error) {
    handleWriteError(res, error);
  }
});

module.exports = router;
