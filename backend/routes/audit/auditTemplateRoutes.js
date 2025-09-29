const express = require('express');
const router = express.Router();
const AuditTemplate = require('../../models/audit/auditTemplate');
const AuditInstance = require('../../models/audit/auditInstance');
const AuditItem = require('../../models/audit/auditItem');

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
// router.get('/instance', async (req, res) => {
//   const { template, site, date } = req.query;
//   if (!template || !site || !date) return res.status(400).json({ error: "Missing params" });
//   // Normalize date to midnight
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   const instance = await AuditInstance.findOne({ template, site, date: d });
//   res.json(instance);
// });

const getPeriodKey = (frequency, date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (frequency === 'daily') return d.toISOString().slice(0, 10);

  if (frequency === 'weekly') {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }

  if (frequency === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return null;
};

router.get('/instance', async (req, res) => {
  try {
    const { template, site, frequency, periodKey, date } = req.query;
    if (!template || !site || !frequency) return res.status(400).json({ error: 'Missing params' });

    let key = periodKey;
    if (!key && date) key = getPeriodKey(frequency, date);

    const instance = await AuditInstance.findOne({ template, site, frequency, periodKey: key }).lean();
    res.json(instance || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/items', async (req, res) => {
  try {
    const { instanceId } = req.query;
    if (!instanceId) return res.status(400).json({ error: 'Missing instanceId' });

    const items = await AuditItem.find({ instance: instanceId });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Create or update an audit instance (upsert)
// router.post('/instance', async (req, res) => {
//   try {
//     const { template, site, date, items, completedBy } = req.body;
//     if (!template || !site || !date || !items) return res.status(400).json({ error: "Missing fields" });
//     const d = new Date(date);
//     d.setHours(0, 0, 0, 0);

//     const updated = await AuditInstance.findOneAndUpdate(
//       { template, site, date: d },
//       {
//         template,
//         site,
//         date: d,
//         items,
//         completedBy,
//         completedAt: new Date()
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );
//     res.json(updated);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// GET /api/audit/:id → return template items (frontend handles instance/fallback logic)

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency } = req.query;

    const template = await AuditTemplate.findById(id).lean();
    if (!template) return res.status(404).json({ error: "Template not found" });

    // Return all template items; frontend can filter by frequency
    const items = template.items.map(i => ({
      ...i,
      checked: false,
      comment: "",
      photos: [],
    }));

    res.json({ items, templateName: template.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


router.post('/instance', async (req, res) => {
  try {
    const { template, site, frequency, periodKey, date, items, completedBy } = req.body;

    if (!template || !site || !frequency || !date || !items) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Determine frequencies to process
    const frequenciesToProcess = frequency === "all"
      ? Array.from(new Set(items.map(item => item.frequency)))
      : [frequency];
    console.log(frequenciesToProcess)
    console.log("items received:", JSON.stringify(items, null, 2));
    console.log("frequencies mapped:", items.map(item => item.frequency));


    const createdInstances = [];

    for (const freq of frequenciesToProcess) {
      const periodKey = getPeriodKey(freq, date);

      // Check for existing AuditInstance (unique key)
      let instance = await AuditInstance.findOne({
        template,
        site,
        frequency: freq,
        periodKey,
      });

      if (!instance) {
        // Create new instance if not found
        instance = await AuditInstance.create({
          template,
          site,
          frequency: freq,
          periodKey,
          completedBy,
          completedAt: new Date(),
        });
      } else {
        // Optionally update metadata if already exists
        instance.completedBy = completedBy;
        instance.completedAt = new Date();
        await instance.save();
      }

      // Now handle AuditItems for this instance
      const itemsForFreq = items.filter(item => item.frequency === freq);

      for (const item of itemsForFreq) {
        await AuditItem.updateOne(
          { instance: instance._id, item: item.item }, // unique pair
          {
            $set: {
              category: item.category,
              item: item.item,
              status: item.status,
              followUp: item.followUp,
              assignedTo: item.assignedTo,
              checked: item.checked,
              photos: item.photos,
              comment: item.comment,
              lastChecked: item.lastChecked,
              instance: instance._id,
              frequency: item.frequency || freq,
            },
          },
          { upsert: true } // create if doesn’t exist
        );
      }

      createdInstances.push({ frequency: freq, instanceId: instance._id });
    }

    res.json({
      message: "Audit saved successfully",
      instances: createdInstances,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
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