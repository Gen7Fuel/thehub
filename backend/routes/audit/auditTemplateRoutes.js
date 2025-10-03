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
      })),
      assignedSites: item.assignedSites && item.assignedSites.length > 0
      ? item.assignedSites
      : sites.map(site => ({
          site,
          assigned: false,
          issueRaised: false,
          issueStatus: []
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
// router.get('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { site } = req.query;
//     let items = []
//     let template = []

//     // Find template by ID AND check if site exists in template.sites
//     if (site){
//       template = await AuditTemplate.findOne({
//         _id: id,
//         sites: site // only return if site is in the sites array
//       }).lean();
      
//       if (!template) return res.status(404).json({ error: "Template not found" });

//       items = template.items.map(i => {
//         let lastChecked = null;

//         if (site && i.lastCheckedHistory) {
//           const entry = i.lastCheckedHistory.find(h => h.site === site);
//           // Support both .timestamp and .date fields
//           lastChecked = entry ? entry.timestamp || entry.date : null;
//         }

//         return {
//           ...i,
//           checked: false,
//           comment: "",
//           photos: [],
//           lastChecked, // null if not applicable
//         };
//       });
//     } else { 
//       // Check only by template id for edit template checklist
//       template = await AuditTemplate.findOne({
//         _id: id,
//       }).lean();
//       if (!template) return res.status(404).json({ error: "Template not found" });
//       items = template.items
//     }

//     res.json({
//       items,
//       templateName: template.name,
//       sites: template.sites,
//       description: template.description,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { site } = req.query;

    if (!id) return res.status(400).json({ error: "Missing template ID" });

    let template = await AuditTemplate.findOne({ _id: id }).lean();
    if (!template) return res.status(404).json({ error: "Template not found" });

    console.log("Fetched template:", template.name);

    let items = template.items.map(i => {
      let lastChecked = null;

      // find lastChecked for the current site
      if (site && i.lastCheckedHistory) {
        const entry = i.lastCheckedHistory.find(h => h.site === site);
        lastChecked = entry ? entry.timestamp || entry.date : null;
      }

      // find assignedSite for this site
      const assignedSite = i.assignedSites?.find(s => s.site === site);

      return {
        ...i,
        lastChecked,
        checked: false,
        comment: "",
        photos: [],
        assignedSite, // pass the assignedSite info
      };
    });

    if (site) {
      // Filter items: only assigned to this site and issueRaised is false
      items = items.filter(i => {
        const assignedSite = i.assignedSite;
        if (!assignedSite) return false;
        if (!assignedSite.assigned) return false;
        if (assignedSite.issueRaised) return false;
        return true;
      });
    }

    console.log(`Filtered items for site "${site}":`, items.length);

    res.json({
      items,
      templateName: template.name,
      sites: template.sites,
      description: template.description,
    });

  } catch (err) {
    console.error("Error fetching template:", err);
    res.status(500).json({ error: err.message });
  }
});



// Updates the instance and items with the latest data from the station end
// router.post('/instance', async (req, res) => {
//   try {
//     const completedBy = req.user._id;
//     const { template, site, frequency, periodKey, date, items } = req.body;
//     console.log(items)

//     if (!template || !site || !frequency || !date || !items) {
//       return res.status(400).json({ error: "Missing fields" });
//     }

//     // Determine frequencies to process
//     const frequenciesToProcess = frequency === "all"
//       ? Array.from(new Set(items.map(item => item.frequency)))
//       : [frequency];


//     const createdInstances = [];

//     for (const freq of frequenciesToProcess) {
//       const periodKey = getPeriodKey(freq, date);

//       // Check for existing AuditInstance (unique key)
//       let instance = await AuditInstance.findOne({
//         template,
//         site,
//         frequency: freq,
//         periodKey,
//       });

//       if (!instance) {
//         // Create new instance if not found
//         instance = await AuditInstance.create({
//           template,
//           site,
//           frequency: freq,
//           periodKey,
//           completedBy,
//           completedAt: new Date(),
//         });
//       } else {
//         // Optionally update metadata if already exists
//         instance.completedBy = completedBy;
//         instance.completedAt = new Date();
//         await instance.save();
//       }

//       // Now handle AuditItems for this instance
//       const itemsForFreq = items.filter(item => item.frequency === freq);

//       for (const item of itemsForFreq) {
//         // Find the existing AuditItem in DB for comparison
//         const existingItem = await AuditItem.findOne({
//           instance: instance._id,
//           item: item.item
//         }).lean();

//         await AuditItem.updateOne(
//           { instance: instance._id, item: item.item }, // unique pair
//           {
//             $set: {
//               category: item.category,
//               item: item.item,
//               status: item.status,
//               followUp: item.followUp,
//               assignedTo: item.assignedTo,
//               checked: item.checked,
//               photos: item.photos,
//               comment: item.comment,
//               lastChecked: item.lastChecked,
//               instance: instance._id,
//               frequency: item.frequency || freq,
//             },
//           },
//           { upsert: true } // create if doesn’t exist
//         );

//         //Update the last checked timestamp
//         const wasChecked = existingItem?.checked === true;
//         const isChecked = item.checked === true;

//         if (!wasChecked && isChecked) {
//           await AuditTemplate.updateOne(
//             { _id: template, "items.item": item.item },
//             {
//               $set: {
//                 "items.$[itemElem].lastCheckedHistory.$[siteElem].timestamp": new Date()
//               }
//             },
//             {
//               arrayFilters: [
//                 { "itemElem.item": item.item },
//                 { "siteElem.site": site } // only update for this site
//               ]
//             }
//           );
//         }
//       createdInstances.push({ frequency: freq, instanceId: instance._id });
//       }
//     }  
//     res.json({
//       message: "Audit saved successfully",
//       instances: createdInstances,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });


// Update a template (name/description, not items)
// router.put('/:id', async (req, res) => {
//   try {
//     const { name, description, items: updatedItems, sites: updatedSites } = req.body;

//     const template = await AuditTemplate.findById(req.params.id);
//     if (!template) return res.status(404).json({ error: 'Not found' });

//     const existingSites = template.sites || [];
//     const newSites = updatedSites.filter(site => !existingSites.includes(site));

//     // 1️⃣ Update template-level fields
//     template.name = name;
//     template.description = description;
//     template.sites = updatedSites;

//     // 2️⃣ Merge items
//     const mergedItems = updatedItems.map(updatedItem => {
//       const existingItem = template.items.find(i => i.item === updatedItem.item);

//       // If the item exists, keep its lastCheckedHistory
//       const lastCheckedHistory = existingItem?.lastCheckedHistory || [];

//       // Add lastCheckedHistory for any new sites
//       newSites.forEach(site => {
//         if (!lastCheckedHistory.some(lch => lch.site === site)) {
//           lastCheckedHistory.push({ site, timestamp: null });
//         }
//       });

//       return {
//         ...updatedItem,
//         lastCheckedHistory,
//       };
//     });

//     template.items = mergedItems;

//     await template.save();
//     res.json(template);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// Updates the instance and items with the latest data from the station end
router.post('/instance', async (req, res) => {
  try {
    const completedBy = req.user._id;
    const { template, site, frequency, periodKey, date, items } = req.body;

    console.log("Received items:", items);

    if (!template || !site || !frequency || !date || !items) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const frequenciesToProcess = frequency === "all"
      ? Array.from(new Set(items.map(item => item.frequency)))
      : [frequency];

    const createdInstances = [];

    for (const freq of frequenciesToProcess) {
      const periodKey = getPeriodKey(freq, date);
      console.log(`Processing frequency: ${freq}, periodKey: ${periodKey}`);

      let instance = await AuditInstance.findOne({ template, site, frequency: freq, periodKey });

      if (!instance) {
        instance = await AuditInstance.create({ template, site, frequency: freq, periodKey, completedBy, completedAt: new Date() });
        console.log(`Created new instance: ${instance._id}`);
      } else {
        instance.completedBy = completedBy;
        instance.completedAt = new Date();
        await instance.save();
        console.log(`Updated existing instance: ${instance._id}`);
      }

      const itemsForFreq = items.filter(item => item.frequency === freq);

      for (const item of itemsForFreq) {
        console.log(`Processing item: ${item.item}`);

        const existingItem = await AuditItem.findOne({ instance: instance._id, item: item.item }).lean();

        // Update AuditItem
        await AuditItem.updateOne(
          { instance: instance._id, item: item.item },
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
              issueRaised: item.issueRaised,
            },
          },
          { upsert: true }
        );
        console.log(`AuditItem updated: ${item.item}`);

        // Update lastCheckedHistory in template if newly checked
        if (!existingItem?.checked && item.checked) {
          await AuditTemplate.updateOne(
            { _id: template, "items.item": item.item },
            { $set: { "items.$[itemElem].lastCheckedHistory.$[siteElem].timestamp": new Date() } },
            { arrayFilters: [{ "itemElem.item": item.item }, { "siteElem.site": site }] }
          );
          console.log(`lastCheckedHistory updated for item: ${item.item}`);
        }

        // ----- TEMPLATE ISSUE UPDATE (single update per item) -----
        if (item.issueRaised === true) {
          const templateDoc = await AuditTemplate.findOne({ _id: template });
          if (templateDoc) {
            const itemElem = templateDoc.items.find(i => i.item === item.item);
            if (itemElem) {
              const siteElem = itemElem.assignedSites.find(s => s.site === site);
              if (siteElem) {
                siteElem.issueRaised = true;

                const createdStatus = siteElem.issueStatus.find(s => s.status === "Created");
                if (createdStatus) {
                  // Update timestamp only
                  createdStatus.timestamp = new Date();
                } else {
                  // Push new created status
                  siteElem.issueStatus.push({ status: "Created", timestamp: new Date() });
                }

                await templateDoc.save();
                console.log(`Template issueRaised set and Created status updated for item: ${item.item}`);
              }
            }
          }
        } else if (item.issueRaised === false) {
          await AuditTemplate.updateOne(
            { _id: template },
            { $set: { "items.$[itemElem].assignedSites.$[siteElem].issueRaised": false } },
            { arrayFilters: [{ "itemElem.item": item.item }, { "siteElem.site": site }] }
          );
          console.log(`Reset issueRaised flag for item: ${item.item}`);
        }


        createdInstances.push({ frequency: freq, instanceId: instance._id });
      }
    }

    res.json({ message: "Audit saved successfully", instances: createdInstances });

  } catch (err) {
    console.error("Error saving audit instance:", err);
    res.status(500).json({ error: err.message });
  }
});



router.put('/:id', async (req, res) => {
  try {
    const { name, description, items: updatedItems, sites: updatedSites } = req.body;

    const template = await AuditTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found' });

    const existingSites = template.sites || [];
    const newSites = updatedSites.filter(site => !existingSites.includes(site));
    const removedSites = existingSites.filter(site => !updatedSites.includes(site)); // ⬅ sites removed by user
    console.log("newsites:",newSites)
    console.log("removed:",removedSites)
    

    // 1️⃣ Update template-level fields
    template.name = name;
    template.description = description;
    template.sites = updatedSites;

    // 2️⃣ Merge items
    const mergedItems = updatedItems.map(updatedItem => {
      const existingItem = template.items.find(i => i.item === updatedItem.item);

      // Preserve lastCheckedHistory
      const lastCheckedHistory = existingItem?.lastCheckedHistory || [];

      // Add lastCheckedHistory for any new sites
      newSites.forEach(site => {
        if (!lastCheckedHistory.some(lch => lch.site === site)) {
          lastCheckedHistory.push({ site, timestamp: null });
        }
      });

      // Preserve or build assignedSites
      let assignedSites = existingItem?.assignedSites || [];

      // Add new sites
      updatedSites.forEach(site => {
        if (!assignedSites.some(s => s.site === site)) {
          assignedSites.push({
            site,
            assigned: false,
            issueRaised: false, // default for new site
            issueStatus: []     // default for new site
          });
        }
      });

      // Remove sites that no longer exist in updatedSites
      if (removedSites.length > 0) {
        assignedSites = assignedSites.filter(s => updatedSites.includes(s.site));
      }

      return {
        ...updatedItem,
        lastCheckedHistory,
        assignedSites,
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