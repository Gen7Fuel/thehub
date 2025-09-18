const express = require('express');
const router = express.Router();
const AuditTemplate = require('../../models/audit/auditTemplate');
const AuditInstance = require('../../models/audit/audit');

// GET /api/audit/category-options
router.get('/category-options', async (req, res) => {
  try {
    const template = await SelectTemplate.findOne({ name: "Category" });
    if (!template) {
      return res.status(404).json({ message: "Category template not found" });
    }
    res.json(template.options); // Return only the options array
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Template CRUD ---

// Create a new template
// router.post('/', async (req, res) => {
//   try {
//     const template = await AuditTemplate.create(req.body);
//     res.status(201).json(template);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

router.post('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const auditTemplate = new AuditTemplate({
      ...req.body,
      createdBy: userId,
    });
    await auditTemplate.save();
    res.status(201).json(auditTemplate);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all templates
router.get('/', async (req, res) => {
  const templates = await AuditTemplate.find();
  res.json(templates);
});

// ------- Instance Routes ---------

// Get all templates FOR A SITE
router.get('/templates', async (req, res) => {
  const { site } = req.query;
  if (!site) return res.status(400).json({ error: "Missing site" });
  const templates = await AuditTemplate.find({ sites: site });
  res.json(templates);
});

// Get today's instance for a template and site
router.get('/instance', async (req, res) => {
  const { template, site, date } = req.query;
  if (!template || !site || !date) return res.status(400).json({ error: "Missing params" });
  // Normalize date to midnight
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const instance = await AuditInstance.findOne({ template, site, date: d });
  res.json(instance);
});

// Create or update an audit instance (upsert)
router.post('/instance', async (req, res) => {
  try {
    const { template, site, date, items, completedBy } = req.body;
    if (!template || !site || !date || !items) return res.status(400).json({ error: "Missing fields" });
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const updated = await AuditInstance.findOneAndUpdate(
      { template, site, date: d },
      {
        template,
        site,
        date: d,
        items,
        completedBy,
        completedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single template
router.get('/:id', async (req, res) => {
  const template = await AuditTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ error: 'Not found' });
  res.json(template);
});

// Update a template (name/description, not items)
router.put('/:id', async (req, res) => {
  const template = await AuditTemplate.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name, description: req.body.description, items: req.body.items, sites: req.body.sites },
    { new: true }
  );
  if (!template) return res.status(404).json({ error: 'Not found' });
  res.json(template);
});

// Delete a template
router.delete('/:id', async (req, res) => {
  const template = await AuditTemplate.findByIdAndDelete(req.params.id);
  if (!template) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// --- Template Items CRUD ---

// Add an item to a template
router.post('/:id/items', async (req, res) => {
  const { text, required } = req.body;
  const template = await AuditTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  template.items.push({ text, required });
  await template.save();
  res.status(201).json(template);
});

// Update an item in a template
router.put('/:id/items/:itemId', async (req, res) => {
  const { text, required } = req.body;
  const template = await AuditTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const item = template.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (text !== undefined) item.text = text;
  if (required !== undefined) item.required = required;
  await template.save();
  res.json(template);
});

// Delete an item from a template
router.delete('/:id/items/:itemId', async (req, res) => {
  const template = await AuditTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const item = template.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  item.remove();
  await template.save();
  res.json(template);
});




module.exports = router;