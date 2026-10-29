const express = require('express');
const router = express.Router();
const SelectTemplate = require('../../models/audit/selectTemplate');
const AuditTemplate = require('../../models/audit/auditTemplate');
const { logChange } = require('../../middleware/changeLogger');

// Create a new select template
router.post('/', async (req, res) => {
  try {
    const selectTemplate = new SelectTemplate(req.body);
    await selectTemplate.save();
    await logChange(req, {
      action: 'create', resourceType: 'audit-select-template', resourceId: selectTemplate._id,
      success: true, statusCode: 201, after: selectTemplate.toObject(),
      resourceLabel: selectTemplate.name, source: 'station-audit.templates',
      diffOptions: { redactedTerms: ['email', 'cc'] },
    });
    res.status(201).json(selectTemplate);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all select templates
router.get('/', async (req, res) => {
  try {
    const templates = await SelectTemplate.find();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single select template by ID
router.get('/:id', async (req, res) => {
  try {
    const template = await SelectTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a select template by ID
router.put('/:id', async (req, res) => {
  try {
    const previous = await SelectTemplate.findById(req.params.id).lean();
    if (!previous) return res.status(404).json({ message: 'Not found' });
    const template = await SelectTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    await logChange(req, {
      action: 'update', resourceType: 'audit-select-template', resourceId: template._id,
      success: true, statusCode: 200, before: previous, after: template.toObject(),
      resourceLabel: template.name, source: 'station-audit.templates',
      diffOptions: { redactedTerms: ['email', 'cc'] },
    });
    res.json(template);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a select template by ID
router.delete('/:id', async (req, res) => {
  try {
    const template = await SelectTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: 'Not found' });
    await logChange(req, {
      action: 'delete', resourceType: 'audit-select-template', resourceId: template._id,
      success: true, statusCode: 200, before: template.toObject(),
      resourceLabel: template.name, source: 'station-audit.templates',
      diffOptions: { redactedTerms: ['email', 'cc'] },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
