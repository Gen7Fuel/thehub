const express = require('express');
const router = express.Router();
const AuditTemplate = require('../../models/audit/auditTemplate');
const AuditInstance = require('../../models/audit/auditInstance');
const AuditItem = require('../../models/audit/auditItem');
const OrderRec = require('../../models/OrderRec');
const Vendor = require('../../models/Vendor');
// const { sendEmail } = require('../../utils/emailService');
const SelectTemplate = require('../../models/audit/selectTemplate');
const { emailQueue } = require('../../queues/emailQueue');


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
      statusTemplate: item.status || "",
      followUpTemplate: item.followUp || "",
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

//--GET ALL THE ITEMS--
router.get("/items-full", async (req, res) => {
  try {
    const { templateId, site, date, frequency } = req.query;
    if (!templateId || !site || !frequency || !date)
      return res.status(400).json({ error: "Missing required params" });

    const templateDoc = await AuditTemplate.findById(templateId).lean();
    if (!templateDoc) return res.status(404).json({ error: "Template not found" });

    const frequencies =
      frequency === "all" ? ["daily", "weekly", "monthly"] : [frequency];

    const freqOrder = { daily: 1, weekly: 2, monthly: 3 };

    // fetch items for all frequencies in parallel
    const itemsPerFrequency = await Promise.all(
      frequencies.map(async (freq) => {
        const periodKey = getPeriodKey(freq, new Date(date));

        // 1️⃣ try fetch instance
        const instance = await AuditInstance.findOne({
          template: templateId,
          site,
          frequency: freq,
          periodKey,
        }).lean();

        let items = [];

        if (instance) {
          // 1a️⃣ fetch items from instance
          const instanceItems = await AuditItem.find({ instance: instance._id }).lean();

          items = instanceItems.map((item) => {
            const templateItem = templateDoc.items.find((i) => i.item === item.item);
            const assignedSite = templateItem?.assignedSites?.find((s) => s.site === site);
            return {
              ...item,
              lastChecked: assignedSite?.lastChecked || null,
              assignedSite,
              frequency: freq,
            };
          });
        } else {
          // 1b️⃣ fallback to template items
          const templateItems = templateDoc.items
            .filter((i) => i.frequency === freq)
            .map((i) => ({
              ...i,
              checked: false,
              comment: "",
              photos: [],
              assignedSite: i.assignedSites?.find((s) => s.site === site),
              lastChecked: i.assignedSites?.find((s) => s.site === site)?.lastChecked || null,
              frequency: freq,
            }));

          // filter same way as your template GET route
          items = site
            ? templateItems.filter((i) => i.assignedSite?.assigned && !i.assignedSite?.issueRaised)
            : templateItems;
        }

        return items;
      })
    );

    // merge all frequencies
    const allItems = itemsPerFrequency.flat();

    // sort like in your frontend
    const sortedItems = allItems.sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return freqOrder[a.frequency] - freqOrder[b.frequency];
    });

    res.json({
      items: sortedItems,
      templateName: templateDoc.name,
      sites: templateDoc.sites,
      description: templateDoc.description,
    });
  } catch (err) {
    console.error("Error fetching items-full:", err);
    res.status(500).json({ error: err.message });
  }
});

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
router.post('/instance', async (req, res) => {
  try {
    const completedBy = req.user._id;
    const { template, site, frequency, periodKey, date, items } = req.body;
    const io = req.app.get("io");
    if (!template || !site || !frequency || !date || !items) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const frequenciesToProcess = frequency === "all"
      ? Array.from(new Set(items.map(item => item.frequency)))
      : [frequency];

    const createdInstances = [];
    const allUpdatedItems = []; // 🔹 collect updated items for response & socket emit

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
          statusTemplate: item.statusTemplate,
          followUpTemplate: item.followUpTemplate,
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
          updateFields.checkedAt = existingItem.checkedAt;
        }

        // // ---- Update issueStatus array in AuditItem ----
        // if (item.issueRaised === true) {
        //   let issueStatus = existingItem?.issueStatus || [];
        //   const createdStatus = issueStatus.find(s => s.status === "Created");
        //   if (createdStatus) {
        //     createdStatus.timestamp = new Date();
        //   } else {
        //     issueStatus.push({ status: "Created", timestamp: new Date() });
        //   }
        //   updateFields.issueStatus = issueStatus;
        //   if (io && item.issueRaised !== existingItem?.issueRaised) {
        //     io.emit("issueUpdated", {
        //       template,
        //       site,
        //       item: item.item,
        //       category: item.category,
        //       action: item.issueRaised ? "created" : "resolved",
        //       updatedAt: new Date(),
        //     });
        //   }
        // }
                // ---- Handle issueRaised logic ----
        if (item.issueRaised === true) {
          let issueStatus = existingItem?.issueStatus || [];
          const createdStatus = issueStatus.find(
            (s) => s.status === "Created"
          );
          if (createdStatus) {
            createdStatus.timestamp = new Date();
          } else {
            issueStatus.push({ status: "Created", timestamp: new Date() });
          }
          updateFields.issueStatus = issueStatus;

          // 🔹 Emit socket event when issue raised/created
          if (io && item.issueRaised !== existingItem?.issueRaised) {
            io.emit("issueUpdated", {
              template,
              site,
              item: item.item,
              category: item.category,
              action: "created",
              updatedAt: new Date(),
            });
          }

          // 🔹 Send email only when issueRaised goes from false → true
          if (item.issueRaised === true && existingItem?.issueRaised !== true) {
            try {
              const assignedTemplate = await SelectTemplate.findOne({
                name: "Assigned To",
              });

              if (assignedTemplate && assignedTemplate.options?.length > 0) {
                // Match by assignedTo text
                const match = assignedTemplate.options.find(
                  (opt) => opt.text === item.assignedTo
                );

                if (match && match.email) {
                  const to = match.email;
                  // const subject = `Issue Raised for site ${site}`;
                  // const text = `An issue has been raised for site ${site}.\n\nChecklist: ${item.item}\nCategory: ${item.category}\n\nPlease review the issue in the Hub under Station Audit Interface.`;
                  // const html = `
                  //   <h2>Issue Raised</h2>
                  //   <p><strong>Site:</strong> ${site}</p>
                  //   <p><strong>Checklist:</strong> ${item.item}</p>
                  //   <p><strong>Category:</strong> ${item.category}</p>
                  //   <p>Please review the issue in the Hub under Station Audit Interface.</p>
                  // `;
                  const subject = `⚠️ Issue Raised for Site ${site}`;
                  const text = `An issue has been raised for site ${site}.
                  Checklist: ${item.item}
                  Category: ${item.category}

                  Please review the issue in the Hub under Station Audit Interface.`;

                  const html = `
                    <div style="
                      font-family: 'Segoe UI', Arial, sans-serif;
                      background-color: #f7f9fc;
                      padding: 30px;
                    ">
                      <div style="
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.08);
                        overflow: hidden;
                      ">
                        <!-- Header -->
                        <div style="
                          background-color: #d32f2f;
                          color: #ffffff;
                          text-align: center;
                          padding: 16px 0;
                        ">
                          <h1 style="margin: 0; font-size: 22px;">🚨 Issue Raised Alert</h1>
                        </div>

                        <!-- Body -->
                        <div style="padding: 24px 30px;">
                          <p style="font-size: 16px; color: #333;">
                            An issue has been raised for the following site:
                          </p>

                          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <tr>
                              <td style="padding: 8px; font-weight: bold; color: #555;">🏪 Site:</td>
                              <td style="padding: 8px; color: #222;">${site}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px; font-weight: bold; color: #555;">🧾 Checklist:</td>
                              <td style="padding: 8px; color: #222;">${item.item}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px; font-weight: bold; color: #555;">📂 Category:</td>
                              <td style="padding: 8px; color: #222;">${item.category}</td>
                            </tr>
                          </table>

                          <div style="
                            margin-top: 24px;
                            background-color: #fff3cd;
                            border-left: 6px solid #ffc107;
                            padding: 16px;
                            border-radius: 8px;
                          ">
                            <p style="margin: 0; color: #856404; font-size: 15px;">
                              ⚠️ Please review this issue in the <strong>Hub → Station Audit Interface</strong> as soon as possible.
                            </p>
                          </div>

                          <div style="text-align: center; margin-top: 30px;">
                            <a href="https://app.gen7fuel.com/audit/interface/open-issues" 
                              style="
                                background-color: #1976d2;
                                color: #ffffff;
                                padding: 12px 22px;
                                text-decoration: none;
                                font-weight: 600;
                                border-radius: 6px;
                                display: inline-block;
                                font-size: 15px;
                              ">
                              🔗 Open Station Audit Interface
                            </a>
                          </div>

                          <p style="color: #777; font-size: 13px; margin-top: 32px; text-align: center;">
                            This is an automated message from the Gen7Fuel Hub Audit System.<br>
                            Please do not reply to this email.
                          </p>
                        </div>
                      </div>
                    </div>
                  `;
                  const cc = ["daksh@gen7fuel.com", "ana@gen7fuel.com"]; 

                  await emailQueue.add("sendIssueEmail", { to, subject, text, html, cc });
                  console.log(`📨 Email queued for ${to}`);
                } else {
                  console.warn(
                    `⚠️ No matching Assigned To email found for "${item.assignedTo}"`
                  );
                }
              } else {
                console.warn("⚠️ Assigned To template not found");
              }
            } catch (emailErr) {
              console.error("❌ Error sending issueRaised email:", emailErr);
            }
          }
        }

        await AuditItem.updateOne(
          { instance: instance._id, item: item.item },
          { $set: updateFields },
          { upsert: true }
        );
        console.log(`AuditItem updated: ${item.item}, issueRaised=${item.issueRaised}`);

        // Track lastChecked per item
        let lastCheckedValue = null;

        // Update lastChecked in template if newly checked
        if (!existingItem?.checked && item.checked) {
          lastCheckedValue = new Date();

          await AuditTemplate.updateOne(
            { _id: template, "items.item": item.item },
            { $set: { "items.$[itemElem].assignedSites.$[siteElem].lastChecked": lastCheckedValue } },
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

        // Handle requestOrder logic
        if (item.requestOrder === true && !existingItem?.orderCreated) {
          const vendorDoc = await Vendor.findOne({ name: item.suppliesVendor, location: site });

          if (vendorDoc && vendorDoc.station_supplies?.length > 0) {
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
              email: "orders@gen7fuel.com",
              currentStatus: "Created",
              statusHistory: [{ status: "Created", timestamp: new Date() }],
              comments: [],
            });

            await orderRec.save();
            if (io) io.emit("orderCreated", orderRec);

            await AuditItem.updateOne(
              { instance: instance._id, item: item.item },
              { $set: { orderCreated: true } }
            );

            item.orderCreated = true;
            console.log(`✅ Order created for vendor ${vendorDoc.name} at site ${site}`);
          }
        }

        createdInstances.push({ frequency: freq, instanceId: instance._id });

        // 🔹 Add this item (with lastChecked + orderCreated) to payload
        allUpdatedItems.push({
          ...item,
          lastChecked: lastCheckedValue,
          orderCreated: item.orderCreated || false,
        });
      }
    }
    if (io) {
      io.emit("auditUpdated", {
        template,
        site,
        frequencies: frequenciesToProcess,
        updatedItems: allUpdatedItems,
        updatedAt: new Date(),
      });
    }

    res.json({
      message: "Audit saved successfully",
      instances: createdInstances,
      updatedItems: allUpdatedItems,
    });
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