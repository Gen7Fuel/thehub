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

// router.post('/', async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const auditTemplate = new AuditTemplate({
//       ...req.body,
//       createdBy: userId,
//     });
//     await auditTemplate.save();
//     res.status(201).json(auditTemplate);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

router.post('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description, items = [], sites = [] } = req.body;
    // Initialize lastCheckedHistory for each item
    const processedItems = items.map(item => ({
      category: item.category || "",
      item: item.item || "Untitled",
      status: item.status || "",
      followUp: item.followUp || "",
      assignedTo: item.assignedTo || "",
      frequency: item.frequency || "daily",
      lastCheckedHistory: sites.map(site => ({
        site,
        timestamp: null // or new Date(0) if you prefer
      }))
    }));

    const auditTemplate = new AuditTemplate({
      name,
      description,
      items: processedItems,
      sites,
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

// check from audit instance if availabe then fetch
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

// if available in instances then fetch the items for that instance
router.get('/items', async (req, res) => {
  try {
    const { instanceId, site, templateId } = req.query;
    if (!instanceId) return res.status(400).json({ error: 'Missing instanceId' });
    if (!site || !templateId) return res.status(400).json({ error: 'Missing site or templateId' });

    const items = await AuditItem.find({ instance: instanceId }).lean();
    const templateDoc = await AuditTemplate.findById(templateId).lean();
    if (!templateDoc) return res.status(404).json({ error: 'Template not found' });

        const itemsWithLastChecked = (items || []).map(item => {
      const templateItem = templateDoc.items.find(i => i.item === item.item);
      let lastChecked = null;

      if (templateItem?.lastCheckedHistory?.length) {
        const entry = templateItem.lastCheckedHistory.find(lch => lch.site === site);
        lastChecked = entry ? (entry.timestamp || entry.date) : null;
      }

      return {
        ...item,
        lastChecked, // null if not found
      };
    });
    res.json(itemsWithLastChecked);
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

// fallback fetch from template audits
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { site } = req.query;
    if (!site) return res.status(400).json({ error: "Site is required" });

    // Find template by ID AND check if site exists in template.sites
    const template = await AuditTemplate.findOne({
      _id: id,
      sites: site // only return if site is in the sites array
    }).lean();
    
    if (!template) return res.status(404).json({ error: "Template not found" });

    const items = template.items.map(i => {
      let lastChecked = null;

      if (site && i.lastCheckedHistory) {
        const entry = i.lastCheckedHistory.find(h => h.site === site);
        // Support both .timestamp and .date fields
        lastChecked = entry ? entry.timestamp || entry.date : null;
      }

      return {
        ...i,
        checked: false,
        comment: "",
        photos: [],
        lastChecked, // null if not applicable
      };
    });

    res.json({
      items,
      templateName: template.name,
      sites: template.sites,
      description: template.description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// Updates the instance and items with the latest data from the station end
router.post('/instance', async (req, res) => {
  try {
    const completedBy = req.user._id;
    const { template, site, frequency, periodKey, date, items } = req.body;

    if (!template || !site || !frequency || !date || !items) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Determine frequencies to process
    const frequenciesToProcess = frequency === "all"
      ? Array.from(new Set(items.map(item => item.frequency)))
      : [frequency];


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
        // Find the existing AuditItem in DB for comparison
        const existingItem = await AuditItem.findOne({
          instance: instance._id,
          item: item.item
        }).lean();

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

        //Update the last checked timestamp
        const wasChecked = existingItem?.checked === true;
        const isChecked = item.checked === true;

        if (!wasChecked && isChecked) {
          await AuditTemplate.updateOne(
            { _id: template, "items.item": item.item },
            {
              $set: {
                "items.$[itemElem].lastCheckedHistory.$[siteElem].timestamp": new Date()
              }
            },
            {
              arrayFilters: [
                { "itemElem.item": item.item },
                { "siteElem.site": site } // only update for this site
              ]
            }
          );
        }
      createdInstances.push({ frequency: freq, instanceId: instance._id });
      }
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
  try {
    const { name, description, items: updatedItems, sites: updatedSites } = req.body;

    const template = await AuditTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found' });

    const existingSites = template.sites || [];
    const newSites = updatedSites.filter(site => !existingSites.includes(site));

    // 1️⃣ Update template-level fields
    template.name = name;
    template.description = description;
    template.sites = updatedSites;

    // 2️⃣ Merge items
    const mergedItems = updatedItems.map(updatedItem => {
      const existingItem = template.items.find(i => i.item === updatedItem.item);

      // If the item exists, keep its lastCheckedHistory
      const lastCheckedHistory = existingItem?.lastCheckedHistory || [];

      // Add lastCheckedHistory for any new sites
      newSites.forEach(site => {
        if (!lastCheckedHistory.some(lch => lch.site === site)) {
          lastCheckedHistory.push({ site, timestamp: null });
        }
      });

      return {
        ...updatedItem,
        lastCheckedHistory,
      };
    });

    template.items = mergedItems;

    await template.save();
    res.json(template);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
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