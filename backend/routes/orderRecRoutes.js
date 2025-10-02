const express = require('express');
const router = express.Router();
const OrderRec = require('../models/OrderRec');
const Vendor = require('../models/Vendor');
const CycleCount = require('../models/CycleCount');
const { getUPC_barcode } = require('../services/sqlService');

// Get all
router.get('/', async (req, res) => {
  try {
    const { site, vendor, date } = req.query;
    const query = {};

    if (site) query.site = site;
    if (vendor) query.vendor = vendor;
    if (date) {
      // Expecting date in 'YYYY-MM-DD' format
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orderRecs = await OrderRec.find(query).sort({ createdAt: -1 });
    res.json( orderRecs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all with optional startDate and endDate filtering
router.get('/range', async (req, res) => {
  try {
    const { site, vendor, startDate, endDate } = req.query;
    const query = {};

    if (site) query.site = site;
    if (vendor) query.vendor = vendor;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const orderRecs = await OrderRec.find(query).sort({ createdAt: -1 });

    // Status keys and their matching values
    const statusKeys = {
      created: "Created",
      completed: "Completed",
      placed: "Placed",
      delivered: "Delivered",
      invoice_received: "Invoice Received"
    };

    // Initialize result object
    const categorized = {
      created: [],
      completed: [],
      placed: [],
      delivered: [],
      invoice_received: []
    };

    orderRecs.forEach(rec => {
      // Find the key that matches the currentStatus
      const key = Object.keys(statusKeys).find(
        k => (rec.currentStatus || "").toLowerCase() === statusKeys[k].toLowerCase()
      );
      if (key) {
        categorized[key].push(rec);
      } else {
        // If currentStatus doesn't match, default to "created"
        categorized.created.push(rec);
      }
    });

    res.json(categorized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const orderRec = await OrderRec.findById(req.params.id);
    if (!orderRec) return res.status(404).json({ message: 'Not found' });
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// Update item completion
router.put('/:id/item/:catIdx/:itemIdx', async (req, res) => {
  try {
    const { completed, isChanged } = req.body;
    const orderRec = await OrderRec.findById(req.params.id);
    if (!orderRec) return res.status(404).json({ message: 'Not found' });

    const catIdx = Number(req.params.catIdx);
    const itemIdx = Number(req.params.itemIdx);

    // Validate indices
    if (
      !orderRec.categories ||
      catIdx < 0 ||
      catIdx >= orderRec.categories.length ||
      !orderRec.categories[catIdx].items ||
      itemIdx < 0 ||
      itemIdx >= orderRec.categories[catIdx].items.length
    ) {
      return res.status(400).json({ message: 'Invalid category or item index' });
    }

    const category = orderRec.categories[catIdx];
    const item = category.items[itemIdx];
    item.completed = completed;

    // Update category completion
    category.completed = category.items.every(i => i.completed);

    // Update orderRec completion
    orderRec.completed = orderRec.categories.every(c => c.completed);

    orderRec.markModified('categories'); // Ensure Mongoose tracks changes
    
    const status = "Completed";

    if(orderRec.completed){
      orderRec.currentStatus = status;
      let statusEntry = orderRec.statusHistory.find(e => e.status === status);
      if (!statusEntry) {
        // Add new status with current timestamp
        orderRec.statusHistory.push({ status, timestamp: new Date() });
      } else {
        // Moving forward in hierarchy → update timestamp
        statusEntry.timestamp = new Date();
      }
    } else {
      orderRec.currentStatus = "Created";
    }
    
    await orderRec.save();
    const io = req.app.get("io");
    if (io){
      io.emit("orderUpdated", orderRec);
    }

    const site = orderRec.site;
    if (category.name !== "Station Supplies"){
      if (item.completed){
        // Updating Cycle Count Flag and creating new entry (if dosen't exists)
        if (isChanged && item.gtin) {
          const existing = await CycleCount.findOne({ site, gtin: item.gtin });

          if (existing) {
            // Update existing entry
            existing.flagged = true;
            await existing.save();
            console.log("Updated existing CycleCount:", existing.upc);
          } 
          else {
            const existing_site = await CycleCount.find({ gtin: item.gtin }).limit(1);
            
            if (existing_site.length === 1){
              // Push new entry using existing information from other sites
              const newCycleCount = new CycleCount({
                site,
                upc: existing_site[0].upc,
                name: item.itemName || "", // product name from categories.items
                category: category.name,
                grade: "C",
                foh: 0,
                boh: 0,
                flagged: true,
                gtin: existing_site[0].gtin,
                upc_barcode: existing_site[0].upc_barcode,
                updatedAt: new Date("2025-09-18T00:00:00Z"), // store UTC
                flaggedAt: new Date(),
              });
              await newCycleCount.save();
              console.log("Created existing new CycleCount:", newCycleCount.upc);
            } else {
              // Push new entry by Checking from the sql server if the item is listed there, if not then keep upc_barcode and upc empty
              let itembook_upc_barcode = ""
              let itembook_upc = ""
              const itembook = await getUPC_barcode(item.gtin)
              if (itembook.length > 0) {
                itembook_upc = itembook[0].UPC;
                itembook_upc_barcode = itembook[0].UPC_A_12_digits;
              } 
              console.log('upc_barcode',itembook_upc_barcode)
              const newCycleCount = new CycleCount({
                site,
                upc: itembook_upc,
                name: item.itemName || "", // product name from categories.items
                category: category.name,
                grade: "C",
                foh: 0,
                boh: 0,
                flagged: true,
                gtin: item.gtin,
                upc_barcode: itembook_upc_barcode,
                updatedAt: new Date("2025-09-18T00:00:00Z"), // store UTC
                flaggedAt: new Date(),
              });
              await newCycleCount.save();
              console.log("Created brand new CycleCount:", newCycleCount.upc);
            }
          }
        } else { // if it is not changed then update it to false and if not existing then create a new entry
          const existing = await CycleCount.findOne({ site, gtin: item.gtin });

          if (existing) {
            // Update existing entry
            existing.flagged = false;
            await existing.save();
            console.log("Updated existing CycleCount with false:", existing.upc);
          } 
          else {
            const existing_site = await CycleCount.find({ gtin: item.gtin }).limit(1);
              
            if (existing_site.length === 1){
              // Push new entry using existing information from other sites
              const newCycleCount = new CycleCount({
                site,
                upc: existing_site[0].upc,
                name: item.itemName || "", // product name from categories.items
                category: category.name,
                grade: "C",
                foh: 0,
                boh: 0,
                flagged: false,
                gtin: existing_site[0].gtin,
                upc_barcode: existing_site[0].upc_barcode,
                updatedAt: new Date("2025-09-18T00:00:00Z"), // store UTC
              });
              await newCycleCount.save();
              console.log("Created existing new CycleCount with false:", newCycleCount.upc);
            } else {
              // Push new entry by Checking from the sql server if the item is listed there, if not then keep upc_barcode and upc empty
              const itembook_upc_barcode = ""
              const itembook_upc = ""
              const itembook = await getUPC_barcode(item.gtin)
              if (itembook.length > 0) {
                itembook_upc = itembook[0].UPC;
                itembook_upc_barcode = itembook[0].UPC_A_12_digits;
              } 

            
              const newCycleCount = new CycleCount({
                site,
                upc: itembook_upc,
                name: item.itemName || "", // product name from categories.items
                category: category.name,
                grade: "C",
                foh: 0,
                boh: 0,
                flagged: false,
                gtin: item.gtin,
                upc_barcode: itembook_upc_barcode,
                updatedAt: new Date("2025-09-18T00:00:00Z"), // store UTC
              });
              await newCycleCount.save();
              console.log("Created brand new CycleCount with false:", newCycleCount.upc);
            }
          }
        }
      }
    } 

    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update one
router.put('/:id', async (req, res) => {
  try {
    const update = {};
    if ('categories' in req.body) update.categories = req.body.categories;
    if ('orderPlaced' in req.body) update.orderPlaced = req.body.orderPlaced;
    if ('delivered' in req.body) update.delivered = req.body.delivered;

    const orderRec = await OrderRec.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!orderRec) return res.status(404).json({ message: 'Not found' });
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// router.put('/:id', async (req, res) => {
//   try {
//     const { categories } = req.body;
//     const orderRec = await OrderRec.findByIdAndUpdate(
//       req.params.id,
//       { categories },
//       { new: true }
//     );
//     if (!orderRec) return res.status(404).json({ message: 'Not found' });
//     res.json(orderRec);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// Create one
router.post('/', async (req, res) => {
  try {
    let { categories, site, vendor, email, includeStationSupplies } = req.body;

    console.log('includeStationSupplies:', includeStationSupplies);
    console.log('Looking for vendor:', { _id: vendor, location: site });

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: 'Categories are required.' });
    }
    if (!site) {
      return res.status(400).json({ message: 'Site is required.' });
    }
    if (!vendor) {
      return res.status(400).json({ message: 'Vendor is required.' });
    }

    // If includeStationSupplies is true, fetch vendor and append station supplies
    if (includeStationSupplies) {
      const vendorDoc = await Vendor.findOne({ _id: vendor, location: site });
      if (vendorDoc && vendorDoc.station_supplies && vendorDoc.station_supplies.length > 0) {
        categories.push({
          number: (categories.length + 1).toString(),
          name: 'Station Supplies',
          items: vendorDoc.station_supplies.map(supply => ({
            gtin: supply.upc,
            vin: supply.vin,
            itemName: supply.name,
            size: supply.size,
            onHandQty: 0,
            forecast: 0,
            minStock: 0,
            itemsToOrder: 0,
            unitInCase: 0,
            casesToOrder: 0,
            onHandQtyOld: 0,
            casesToOrderOld: 0,
          })),
        });
      }

      console.log('Found vendorDoc:', vendorDoc);
    }


    // Set onHandQtyOld and casesToOrderOld for each item
    const categoriesWithOld = categories.map(category => ({
      ...category,
      items: category.items.map(item => ({
        ...item,
        onHandQtyOld: item.onHandQty,
        casesToOrderOld: item.casesToOrder,
      })),
    }));

    const orderRec = new OrderRec({ categories: categoriesWithOld, site, vendor, email, 
      currentStatus: "Created", statusHistory: [{ status: "Created", timestamp: new Date() }], 
      comments: [] });
    await orderRec.save();
    const io = req.app.get("io");
    if (io){
      // console.log("Emitting orderCreated for", orderRec._id);
      io.emit("orderCreated", orderRec);
    }
    
    // Notify all SSE clients about the update
    // broadcastSSE(req.app, "orderUpdated", orderRec);

    res.status(201).json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// router.post('/', async (req, res) => {
//   try {
//     const { categories, site, vendor, email } = req.body;
//     if (!categories || !Array.isArray(categories) || categories.length === 0) {
//       return res.status(400).json({ message: 'Categories are required.' });
//     }
//     if (!site) {
//       return res.status(400).json({ message: 'Site is required.' });
//     }
//     if (!vendor) {
//       return res.status(400).json({ message: 'Vendor is required.' });
//     }

//     // Set onHandQtyOld and casesToOrderOld for each item
//     const categoriesWithOld = categories.map(category => ({
//       ...category,
//       items: category.items.map(item => ({
//         ...item,
//         onHandQtyOld: item.onHandQty,
//         casesToOrderOld: item.casesToOrder,
//       })),
//     }));

//     const orderRec = new OrderRec({ categories: categoriesWithOld, site, vendor, email });
//     await orderRec.save();
//     res.status(201).json(orderRec);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// PATCH /api/order-rec/:id
router.patch('/:id', async (req, res) => {
  try {
    const { extraItemsNote } = req.body;
    const orderRec = await OrderRec.findByIdAndUpdate(
      req.params.id,
      { extraItemsNote },
      { new: true }
    );
    if (!orderRec) return res.status(404).json({ error: 'Order rec not found' });
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update extra items note' });
  }
});

// Delete an order rec by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await OrderRec.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Order rec not found.' });
    }
    const io = req.app.get("io");
    if (io){
      // console.log("Emitting orderDeleted for", deleted._id);
      io.emit("orderDeleted", deleted);
    }
    res.json({ success: true, message: 'Order rec deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order rec.' });
  }
});

// Update order status
const STATUS_HIERARCHY = ["Created", "Completed", "Placed", "Delivered", "Invoice Received"];

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const orderRec = await OrderRec.findById(req.params.id);
    if (!orderRec) return res.status(404).json({ message: 'Not found' });

    const currentStatus = orderRec.currentStatus || "Created";
    const currentIndex = STATUS_HIERARCHY.indexOf(currentStatus);
    const newIndex = STATUS_HIERARCHY.indexOf(status);

    // Update current status
    orderRec.currentStatus = status;

    // Ensure "Created" exists with proper timestamp
    let createdEntry = orderRec.statusHistory.find(e => e.status === "Created");
    if (!createdEntry) {
      orderRec.statusHistory.unshift({ status: "Created", timestamp: orderRec.createdAt });
    } else if (!createdEntry.timestamp) {
      createdEntry.timestamp = orderRec.createdAt;
    }

    // Find or create entry for the new status
    let statusEntry = orderRec.statusHistory.find(e => e.status === status);
    if (!statusEntry) {
      // Add new status with current timestamp
      orderRec.statusHistory.push({ status, timestamp: new Date() });
    } else if (newIndex > currentIndex) {
      // Moving forward in hierarchy → update timestamp
      statusEntry.timestamp = new Date();
    }
    
    // If status is "Placed", update vendor lastPlacedOrder
    if (status === "Placed" && orderRec.vendor) {
      await Vendor.findOneAndUpdate(
        { _id: orderRec.vendor, location: orderRec.site },
        { lastPlacedOrder: new Date() }
      );
    }

    await orderRec.save();

    res.json(orderRec);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});



// Adding comments
router.post('/:id/comments', async (req, res) => {
  try {
    const { text, author } = req.body;
    const orderRec = await OrderRec.findById(req.params.id);
    if (!orderRec)  return res.status(404).json({ message: 'Not found' });

    orderRec.comments.push({ text, author, timestamp: new Date() });
    await orderRec.save();
    
    // Notify all SSE clients about the update
    // broadcastSSE(req.app, "orderUpdated", orderRec);

    res.json(orderRec);
  } catch (err) {
    console.error("Error adding comment:", err); // Log full error
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;