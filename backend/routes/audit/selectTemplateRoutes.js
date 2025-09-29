const express = require('express');
const router = express.Router();
const SelectTemplate = require('../../models/audit/selectTemplate');

// Create a new select template
router.post('/', async (req, res) => {
  try {
    const selectTemplate = new SelectTemplate(req.body);
    await selectTemplate.save();
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

// Get a single template (with optional frequency filter)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency } = req.query; // daily / weekly / monthly / all
    const template = await AuditTemplate.findById(id).lean();
    if (!template) return res.status(404).json({ error: 'Not found' });

    let items = template.items || [];
    if (frequency && frequency !== 'all') {
      items = items.filter(item => item.frequency === frequency);
    }

    res.json({ ...template, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
    const template = await SelectTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: 'Not found' });
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
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;