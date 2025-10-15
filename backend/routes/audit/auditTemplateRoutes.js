const express = require('express');
const router = express.Router();
const AuditTemplate = require('../../models/audit/auditTemplate');
const AuditInstance = require('../../models/audit/auditInstance');
const AuditItem = require('../../models/audit/auditItem');
const OrderRec = require('../../models/OrderRec');
const Vendor = require('../../models/Vendor');

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

// ---ADDING/CREATING NEW TEMPLATE ----
router.post('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description, items = [], sites = [] } = req.body;

    // Initialize items
    const processedItems = items.map(item => ({
      category: item.category || "",
      item: item.item || "Untitled",
      status: item.status || "",
      followUp: item.followUp || "",
      assignedTo: item.assignedTo || "",
      frequency: item.frequency || "daily",
      suppliesVendor: item.vendor,
      assignedSites: item.assignedSites && item.assignedSites.length > 0
        ? item.assignedSites.map(siteEntry => ({
            site: siteEntry.site,
            assigned: siteEntry.assigned || false,
            issueRaised: siteEntry.issueRaised || false,
            lastChecked: siteEntry.lastChecked || null
          }))
        : sites.map(site => ({
            site,
            assigned: false,
            issueRaised: false,
            lastChecked: null   // <-- replaces lastCheckedHistory
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
    console.error(err);
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
    console.log(template);
    console.log(frequency);
    console.log(periodKey);
    if (!template || !site || !frequency) return res.status(400).json({ error: 'Missing params' });

    let key = periodKey;
    if (!key && date) key = getPeriodKey(frequency, date);

    const instance = await AuditInstance.findOne({ template, site, frequency, periodKey: key }).lean();
    console.log(instance);
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

    // Fetch all items for the given instance
    const items = await AuditItem.find({ instance: instanceId }).lean();
    // Fetch the template for site info and assignedSites
    const templateDoc = await AuditTemplate.findById(templateId).lean();
    if (!templateDoc) return res.status(404).json({ error: 'Template not found' });

    const itemsWithLastChecked = (items || []).map(item => {
      const templateItem = templateDoc.items.find(i => i.item === item.item);
      let lastChecked = null;

      // Updated: get lastChecked from assignedSites for the current site
      const assignedSite = templateItem?.assignedSites?.find(s => s.site === site);
      if (assignedSite) {
        lastChecked = assignedSite.lastChecked || null;
      }

      return {
        ...item,
        lastChecked, // now taken from assignedSites
        assignedSite, // pass the assignedSite info 
      };
    });
    res.json(itemsWithLastChecked);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: err.message });
  }
});


// -- GET ITEMS WHICH HAVE ISSUE RAISED--
// router.get('/open-issues', async (req, res) => {
//   try {
//     const { site } = req.query;
//     if (!site) return res.status(400).json({ error: "Missing site" });

//     // 1️⃣ Find all instances for the site
//     const instances = await AuditInstance.find({ site }).select('_id').lean();
//     const instanceIds = instances.map(inst => inst._id);

//     if (!instanceIds.length) {
//       return res.json({ items: [] }); // No instances, return empty array
//     }

//     // 2️⃣ Find all AuditItems for these instances with issueRaised = true
//     const items = await AuditItem.find({
//       instance: { $in: instanceIds },
//       issueRaised: true
//     }).lean();

//     // 3️⃣ Map items to return relevant info
//     const formattedItems = items.map(item => {
//       // Determine lastUpdated based on currentIssueStatus
//       let lastUpdated = null;
//       if (item.issueStatus && item.issueStatus.length > 0 && item.currentIssueStatus) {
//         const statusObj = item.issueStatus.find(s => s.status === item.currentIssueStatus);
//         if (statusObj) lastUpdated = statusObj.timestamp;
//       }

//       return {
//         item: item.item,
//         category: item.category,
//         comment: item.comment,
//         photos: item.photos,
//         currentIssueStatus: item.currentIssueStatus || "Created",
//         lastUpdated, // timestamp of current status
//         instance: item.instance,
//         frequency: item.frequency,
//         assignedTo: item.assignedTo,
//       };
//     });

//     res.json({ items: formattedItems });
//   } catch (err) {
//     console.error("Error fetching open issues:", err);
//     res.status(500).json({ error: err.message });
//   }
// });
// -- GET OPEN ISSUES --
// Supports both station (site-based) and interface (assignedTo filtering)
// GET /api/audit/open-issues?site=...&assignedTo=...
router.get("/open-issues", async (req, res) => {
  try {
    const { site, assignedTo } = req.query;

    if (!site) {
      return res.status(400).json({ error: "Missing site" });
    }

    // 1️⃣ Find all instances for the site
    const instances = await AuditInstance.find({ site }).select("_id").lean();
    const instanceIds = instances.map((inst) => inst._id);

    if (!instanceIds.length) {
      return res.json({ items: [] }); // No instances, return empty array
    }

    // 2️⃣ Build base query
    const query = {
      instance: { $in: instanceIds },
      issueRaised: true,
      currentIssueStatus: { $ne: "Resolved" },
    };

    // Add department filter if provided
    if (assignedTo && assignedTo !== "All") {
      query.assignedTo = assignedTo;
    }

    // 3️⃣ Find AuditItems
    const items = await AuditItem.find(query).lean();

    // 4️⃣ Map items to clean response
    const formattedItems = items.map((item) => {
      let lastUpdated = null;
      if (item.issueStatus && item.issueStatus.length > 0 && item.currentIssueStatus) {
        const statusObj = item.issueStatus.find(
          (s) => s.status === item.currentIssueStatus
        );
        if (statusObj) lastUpdated = statusObj.timestamp;
      }

      return {
        _id: item._id,
        item: item.item,
        category: item.category,
        comment: item.comment,
        photos: item.photos,
        currentIssueStatus: item.currentIssueStatus || "Created",
        lastUpdated,
        instance: item.instance,
        frequency: item.frequency,
        assignedTo: item.assignedTo,
      };
    });

    res.json({ items: formattedItems });
  } catch (err) {
    console.error("Error fetching open issues:", err);
    res.status(500).json({ error: err.message });
  }
});


// -- UPDATE ISSUE STATUS --
router.put('/issues/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Created", "In Progress", "Resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const item = await AuditItem.findById(id);
    if (!item) return res.status(404).json({ error: "Item not found" });

    item.currentIssueStatus = status;

    // update history
    let issueStatus = item.issueStatus || [];
    const existing = issueStatus.find(s => s.status === status);
    if (existing) {
      existing.timestamp = new Date();
    } else {
      issueStatus.push({ status, timestamp: new Date() });
    }
    item.issueStatus = issueStatus;

    // 🔹 if resolved, mark issueRaised false in audit template 
    // Not marking issue resolved in Audit Item to store history of items when they were marked as an issue.
    if (status === "Resolved") {
      // item.issueRaised = false;

      // Fetch AuditInstance to get template ID
      if (item.instance) {
        const instance = await AuditInstance.findById(item.instance).lean();
        console.log('instance:',item.instance);
        console.log('template:',instance.template);
        if (instance?.template) {
          await AuditTemplate.updateOne(
            { _id: instance.template },
            {
              $set: {
                "items.$[itemElem].assignedSites.$[siteElem].issueRaised": false,
              },
            },
            {
              arrayFilters: [
                { "itemElem.item": item.item },
                { "siteElem.site": instance.site },
              ],
            }
          );
        }
      }
    }

    await item.save();

    res.json({ message: "Status updated", item });
  } catch (err) {
    console.error("Error updating issue status:", err);
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

// -- FETCH TEMPLATE FOR EDITING --
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { site } = req.query;

    if (!id) return res.status(400).json({ error: "Missing template ID" });

    let template = await AuditTemplate.findOne({ _id: id }).lean();
    if (!template) return res.status(404).json({ error: "Template not found" });

    console.log("Fetched template:", template.name);

    let items = template.items.map(i => {
      // find assignedSite for this site
      const assignedSite = i.assignedSites?.find(s => s.site === site);

      // lastChecked now comes from assignedSite.lastChecked
      const lastChecked = assignedSite?.lastChecked || null;

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

    if (!template || !site || !frequency || !date || !items) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const frequenciesToProcess = frequency === "all"
      ? Array.from(new Set(items.map(item => item.frequency)))
      : [frequency];

    const createdInstances = [];

    for (const freq of frequenciesToProcess) {
      const periodKey = getPeriodKey(freq, date);

      let instance = await AuditInstance.findOne({ template, site, frequency: freq, periodKey });

      if (!instance) {
        instance = await AuditInstance.create({ template, site, frequency: freq, periodKey, completedBy, completedAt: new Date() });
      } else {
        instance.completedBy = completedBy;
        instance.completedAt = new Date();
        await instance.save();
      }

      const itemsForFreq = items.filter(item => item.frequency === freq);

      for (const item of itemsForFreq) {
        const existingItem = await AuditItem.findOne({ instance: instance._id, item: item.item });

        let updateFields = {
          category: item.category,
          item: item.item,
          status: item.status,
          followUp: item.followUp,
          assignedTo: item.assignedTo,
          checked: item.checked,
          photos: item.photos,
          comment: item.comment,
          instance: instance._id,
          frequency: item.frequency || freq,
          issueRaised: item.issueRaised,
          requestOrder: item.requestOrder,
          suppliesVendor: item.suppliesVendor,
          currentIssueStatus: item.issueRaised === true ? "Created" : undefined,
        };

        // Only set checkedAt when it goes from unchecked → checked
        if (item.checked && !existingItem?.checked) {
          updateFields.checkedAt = new Date();
        } else if (existingItem?.checkedAt) {
          // keep the previous checkedAt if it already existed
          updateFields.checkedAt = existingItem.checkedAt;
        }

        // ---- Update issueStatus array in AuditItem ----
        if (item.issueRaised === true) {
          let issueStatus = existingItem?.issueStatus || [];
          const createdStatus = issueStatus.find(s => s.status === "Created");
          if (createdStatus) {
            createdStatus.timestamp = new Date(); // update timestamp
          } else {
            issueStatus.push({ status: "Created", timestamp: new Date() });
          }
          updateFields.issueStatus = issueStatus;
        }

        await AuditItem.updateOne(
          { instance: instance._id, item: item.item },
          { $set: updateFields },
          { upsert: true }
        );
        console.log(`AuditItem updated: ${item.item}, issueRaised=${item.issueRaised}`);


        // Update lastChecked in template if newly checked
        if (!existingItem?.checked && item.checked) {
          await AuditTemplate.updateOne(
            { _id: template, "items.item": item.item },
            { $set: { "items.$[itemElem].assignedSites.$[siteElem].lastChecked": new Date() } },
            { arrayFilters: [{ "itemElem.item": item.item }, { "siteElem.site": site }] }
          );
        }

        // Update issueRaised flag in template
        await AuditTemplate.updateOne(
          { _id: template },
          {
            $set: {
              "items.$[itemElem].assignedSites.$[siteElem].issueRaised": item.issueRaised === true
            }
          },
          { arrayFilters: [{ "itemElem.item": item.item }, { "siteElem.site": site }] }
        );


        createdInstances.push({ frequency: freq, instanceId: instance._id });
        
        // // Handle requestOrder logic
        // if (item.requestOrder === true) {
        //   const vendorDoc = await Vendor.findOne({ name: item.suppliesVendor, location: site });

        //   if (vendorDoc && vendorDoc.station_supplies && vendorDoc.station_supplies.length > 0) {
        //     // Build the order categories array (only Station Supplies)
        //     const categories = [
        //       {
        //         number: "5001",
        //         name: "Station Supplies",
        //         items: vendorDoc.station_supplies.map(supply => ({
        //           gtin: supply.upc,
        //           vin: supply.vin,
        //           itemName: supply.name,
        //           size: supply.size,
        //           onHandQty: 0,
        //           casesToOrderOld: 0,
        //           completed: false,
        //         })),
        //         completed: false,
        //       },
        //     ];

        //     // Create and save new OrderReconciliation record
        //     const orderRec = new OrderRec({
        //       categories,
        //       site,
        //       vendor: vendorDoc._id,
        //       email: "julie@gen7fuel.com", // Person handling the station supplies orders
        //       currentStatus: "Created",
        //       statusHistory: [{ status: "Created", timestamp: new Date() }],
        //       comments: [],
        //     });

        //     await orderRec.save();
        // ----------------- Handle requestOrder logic -----------------
        if (item.requestOrder === true && !existingItem?.orderCreated) {
          const vendorDoc = await Vendor.findOne({ name: item.suppliesVendor, location: site });

          if (vendorDoc && vendorDoc.station_supplies && vendorDoc.station_supplies.length > 0) {
            const categories = [
              {
                number: "5001",
                name: "Station Supplies",
                items: vendorDoc.station_supplies.map(supply => ({
                  gtin: supply.upc,
                  vin: supply.vin,
                  itemName: supply.name,
                  size: supply.size,
                  onHandQty: 0,
                  casesToOrderOld: 0,
                  completed: false,
                })),
                completed: false,
              },
            ];

            const orderRec = new OrderRec({
              categories,
              site,
              vendor: vendorDoc._id,
              email: "julie@gen7fuel.com",
              currentStatus: "Created",
              statusHistory: [{ status: "Created", timestamp: new Date() }],
              comments: [],
            });

            await orderRec.save();

            // Update the audit item to mark order as created
            await AuditItem.updateOne(
              { instance: instance._id, item: item.item },
              { $set: { orderCreated: true } }
            );

            // Optional: emit a socket event if you’re using real-time updates
            const io = req.app.get("io");
            if (io) io.emit("orderCreated", orderRec);

            console.log(`✅ Order created for vendor ${vendorDoc.name} at site ${site}:`, orderRec._id);
          } else {
            console.log(`⚠️ No station_supplies found for vendor ${item.suppliesVendor} at site ${site}`);
          }
        }

      }
    }


    res.json({ message: "Audit saved successfully", instances: createdInstances });

  } catch (err) {
    console.error("Error saving audit instance:", err);
    res.status(500).json({ error: err.message });
  }
});


// --UPDATE AN EXISTING TEMPLATE--
router.put('/:id', async (req, res) => {
  try {
    const { name, description, items: updatedItems, sites: updatedSites } = req.body;


    const template = await AuditTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Not found' });

    const existingSites = template.sites || [];
    const newSites = updatedSites.filter(site => !existingSites.includes(site));
    const removedSites = existingSites.filter(site => !updatedSites.includes(site));
    console.log("New sites to add:", newSites);
    console.log("Sites removed:", removedSites);

    // 1️⃣ Update template-level fields
    template.name = name;
    template.description = description;
    template.sites = updatedSites;

    // 2️⃣ Merge items
    const mergedItems = updatedItems.map(updatedItem => {
      const existingItem = template.items.find(i => i.item === updatedItem.item);

      let assignedSites = existingItem?.assignedSites || [];

      updatedSites.forEach(site => {
        const existingSite = assignedSites.find(s => s.site === site);
        const frontendSite = updatedItem.assignedSites?.find(s => s.site === site);

        if (existingSite) {
          // Update existing site with frontend values
          existingSite.assigned = frontendSite?.assigned ?? existingSite.assigned;
          existingSite.lastChecked = frontendSite?.lastChecked ?? existingSite.lastChecked;
          existingSite.issueRaised = frontendSite?.issueRaised ?? existingSite.issueRaised;
        } else {
          // Add new site
          assignedSites.push({
            site,
            assigned: frontendSite?.assigned ?? false,
            issueRaised: frontendSite?.issueRaised ?? false,
            lastChecked: frontendSite?.lastChecked ?? null
          });
        }
      });

      // Remove sites no longer in updatedSites
      if (removedSites.length > 0) {
        assignedSites = assignedSites.filter(s => updatedSites.includes(s.site));
      }

      console.log(`Merged item: ${updatedItem.item}`);
      return {
        ...updatedItem,                // override with new values (including vendor)
        suppliesVendor: updatedItem.vendor ?? existingItem?.suppliesVendor ?? "", // ensure vendor is saved
        assignedSites,
      };
    });


    template.items = mergedItems;

    await template.save();
    console.log("Template updated successfully:", template._id);
    res.json(template);
  } catch (err) {
    console.error("Error updating template:", err);
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