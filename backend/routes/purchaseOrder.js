const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transactions");
const Fleet = require("../models/Fleet");
const Product = require("../models/Product");
// const Location = require("../models/Location");

// Create a purchase order
// router.post("/", async (req, res) => {
//   const { fleetCardNumber, date, quantity, amount, signature, productCode, stationName, source, customerID, receipt } = req.body;

//   try {
//     const newOrder = new Transaction({
//       fleetCardNumber,
//       date,
//       quantity,
//       amount,
//       signature,
//       productCode,
//       stationName,
//       source,
//       customerID,
//       receipt
//     });

//     const savedOrder = await newOrder.save();
//     res.status(201).json(savedOrder);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to create purchase order." });
//   }
// });
router.post("/", async (req, res) => {
  const {
    fleetCardNumber,
    poNumber,
    date,
    quantity,
    amount,
    signature,
    productCode,
    stationName,
    source,
    receipt,
    customerName,
    driverName,
    vehicleInfo,
  } = req.body;

  try {
    const newOrder = new Transaction({
      source,
      date,
      stationName,
      fleetCardNumber: fleetCardNumber || '', // if empty, save as ''
      poNumber: poNumber || '',              // if empty, save as ''
      quantity,
      amount,
      productCode,
      signature,
      receipt,
      customerName,
      driverName,
      vehicleInfo,
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    if (err && err.code === 11000 && err.keyPattern && (err.keyPattern.poNumber || err.keyPattern.stationName)) {
      return res.status(409).json({ message: "PO number already exists." })
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create purchase order." });
  }
});

// Update a purchase order
router.put("/:id", express.json(), async (req, res) => {
  try {
    const { id } = req.params

    // Only allow these fields to be updated
    const allowed = [
      'fleetCardNumber',
      'poNumber',
      'date',
      'quantity',
      'amount',
      'signature',
      'productCode',
      'stationName',
      'source',
      'customerID',
      'receipt',
      'customerName',
      'driverName',
      'vehicleInfo',
      'vehicleMakeModel',
    ]

    const updates = {}
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key) && req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update." })
    }

    // If changing date, preserve original UTC time for PO
    if (Object.prototype.hasOwnProperty.call(updates, 'date')) {
      const existing = await Transaction.findById(id).select('date source')
      if (!existing) {
        return res.status(404).json({ message: "Purchase order not found." })
      }

      // Parse incoming new date (accepts 'YYYY-MM-DD' or ISO string)
      const raw = updates.date
      let newDateParsed
      if (typeof raw === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          newDateParsed = new Date(`${raw}T00:00:00Z`)
        } else {
          newDateParsed = new Date(raw)
        }
      } else {
        newDateParsed = new Date(raw)
      }
      if (Number.isNaN(newDateParsed.getTime())) {
        return res.status(400).json({ message: "Invalid date format." })
      }

      // For PO only: keep original UTC time component
      if (existing.source === 'PO' && existing.date instanceof Date && !Number.isNaN(existing.date.getTime())) {
        const h = existing.date.getUTCHours()
        const m = existing.date.getUTCMinutes()
        const s = existing.date.getUTCSeconds()
        const ms = existing.date.getUTCMilliseconds()
        const combined = new Date(Date.UTC(
          newDateParsed.getUTCFullYear(),
          newDateParsed.getUTCMonth(),
          newDateParsed.getUTCDate(),
          h, m, s, ms
        ))
        updates.date = combined
      } else {
        // Non-PO or missing original time: just use parsed new date
        updates.date = newDateParsed
      }
    }

    const updatedOrder = await Transaction.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )

    if (!updatedOrder) {
      return res.status(404).json({ message: "Purchase order not found." })
    }

    return res.status(200).json(updatedOrder)
  } catch (err) {
    if (err && err.code === 11000 && err.keyPattern && (err.keyPattern.poNumber || err.keyPattern.stationName)) {
      return res.status(409).json({ message: "PO number already exists." })
    }
    console.error('PUT /api/purchase-orders/:id failed:', err)
    return res.status(500).json({ message: "Failed to update purchase order." })
  }
})
// router.put("/:id", async (req, res) => {
//   const { id } = req.params;
//   const { fleetCardNumber, date, quantity, amount, signature, productCode, stationName, source, customerID } = req.body;

//   try {
//     const updatedOrder = await Transaction.findByIdAndUpdate(
//       id,
//       {
//         fleetCardNumber,
//         date,
//         quantity,
//         amount,
//         signature,
//         productCode,
//         stationName,
//         source,
//         customerID,
//         receipt
//       },
//       { new: true }
//     );

//     if (!updatedOrder) {
//       return res.status(404).json({ message: "Purchase order not found." });
//     }

//     res.status(200).json(updatedOrder);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to update purchase order." });
//   }
// });

// Get all purchase orders with optional date and location filters
// router.get("/", async (req, res) => {
//   const { startDate, endDate, stationName} = req.query;
//   const filter = { source: "PO", stationName };

//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     const end = new Date(endDate);
//     end.setDate(end.getDate() + 1); // Set end date to the next day to include the entire end date
//     filter.date = { $gte: start, $lt: end };
//   }

//   try {
//     // const orders = await Transaction.find(filter)
//     //   .populate('fleet', 'fleetCardNumber driverName customerName customerId vehicleMakeModel')
//     //   .populate('product', 'description')
//     //   .sort({ date: -1 });
//     const orders = await Transaction.find(filter)
//       .select('fleetCardNumber productCode quantity amount signature date receipt')
//       .sort({ date: -1 }); // Sort transactions by date (newest first)

//     const fleetCardNumbers = orders.map(order => order.fleetCardNumber);
//     const productCodes = orders.map(order => order.productCode);

//     // Fetch fleet details (including vehicleMakeModel)
//     const fleets = await Fleet.find({ fleetCardNumber: { $in: fleetCardNumbers } })
//       .select('fleetCardNumber driverName customerName customerID vehicleMakeModel');

//     // Fetch product details
//     const products = await Product.find({ code: { $in: productCodes } })
//       .select('code description');

//     // Convert fleet and product data into lookup maps
//     const fleetMap = Object.fromEntries(fleets.map(f => [f.fleetCardNumber, f]));
//     const productMap = Object.fromEntries(products.map(p => [p.code, p.description]));

//     // Merge data back into orders
//     const ordersWithDetails = orders.map(order => ({
//       ...order.toObject(),
//       driverName: fleetMap[order.fleetCardNumber]?.driverName || null,
//       customerName: fleetMap[order.fleetCardNumber]?.customerName || null,
//       customerID: fleetMap[order.fleetCardNumber]?.customerID || null,
//       vehicleMakeModel: fleetMap[order.fleetCardNumber]?.vehicleMakeModel || null, // Newly added field
//       description: productMap[order.productCode] || null,
//     }));
//     res.status(200).json(ordersWithDetails);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to fetch purchase orders." });
//   }
// });

router.get("/", async (req, res) => {
  const { startDate, endDate, stationName } = req.query;
  const filter = { source: "PO", stationName };

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    filter.date = { $gte: start, $lt: end };
  }

  try {
    const orders = await Transaction.find(filter)
      .select('fleetCardNumber driverName customerName vehicleMakeModel productCode quantity amount signature date receipt poNumber')
      .sort({ date: -1 });

    const fleetCardNumbers = orders
      .filter(o => o.fleetCardNumber) // only get non-empty fleet cards
      .map(order => order.fleetCardNumber);

    const productCodes = orders.map(order => order.productCode);

    // Fetch fleet details for non-empty fleet cards
    const fleets = await Fleet.find({ fleetCardNumber: { $in: fleetCardNumbers } })
      .select('fleetCardNumber driverName customerName customerID vehicleMakeModel');

    // Fetch product details
    const products = await Product.find({ code: { $in: productCodes } })
      .select('code description');

    // Convert fleet and product data into lookup maps
    const fleetMap = Object.fromEntries(fleets.map(f => [f.fleetCardNumber, f]));
    const productMap = Object.fromEntries(products.map(p => [p.code, p.description]));

    const ordersWithDetails = orders.map(order => {
      const fleetData = fleetMap[order.fleetCardNumber] || {};
      
      return {
        ...order.toObject(),
        // If fleetCardNumber exists and fleetData exists, use it; otherwise fallback to transaction's own fields
        driverName: fleetData.driverName || order.driverName || null,
        customerName: fleetData.customerName || order.customerName || null,
        customerID: fleetData.customerID || null,
        vehicleMakeModel: fleetData.vehicleMakeModel || order.vehicleMakeModel || null,
        description: productMap[order.productCode] || null,
      };
    });

    res.status(200).json(ordersWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase orders." });
  }
});

// Validate uniqueness of a PO number for a station
// GET /api/purchase-orders/unique?stationName=...&poNumber=...
router.get('/unique', async (req, res) => {
  try {
    const stationNameRaw = (req.query.stationName || '').toString()
    const poNumberRaw = (req.query.poNumber || '').toString()
    const stationName = stationNameRaw.trim()
    const poNumber = poNumberRaw.trim()

    if (!stationName || !poNumber) {
      return res.status(400).json({ message: 'stationName and poNumber are required' })
    }

    const existing = await Transaction.findOne({ source: 'PO', stationName, poNumber }).select('_id').lean()
    return res.json({ unique: !existing })
  } catch (err) {
    console.error('GET /api/purchase-orders/unique failed:', err)
    return res.status(500).json({ message: 'Failed to validate PO uniqueness' })
  }
})

// Get a single purchase order by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // const order = await Transaction.findById(id)
    //   .populate('fleet', 'fleetCardNumber driverName customerName customerId vehicleMakeModel')
    //   .populate('product', 'description');
    const order = await Transaction.findById(id).select('fleetCardNumber productCode quantity amount signature');

    if (!order) {
      return res.status(404).json({ message: "Purchase order not found." });
    }

    // Fetch fleet details
    const fleet = await Fleet.findOne({ fleetCardNumber: order.fleetCardNumber })
      .select('fleetCardNumber _id driverName customerName customerID vehicleMakeModel');

    // Fetch product details
    const product = await Product.findOne({ code: order.productCode })
      .select('code description');

    // Merge data into a single object
    const orderWithDetails = {
      ...order.toObject(),
      driverName: fleet?.driverName || null,
      customerName: fleet?.customerName || null,
      customerID: fleet?.customerID || null,
      vehicleMakeModel: fleet?.vehicleMakeModel || null,
      description: product?.description || null,
      fleetId: fleet?._id || null,
    };

    // orderWithDetails will always exist here since `order` was found above

    res.status(200).json(orderWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase order." });
  }
});

// Delete a purchase order by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ message: 'ID is required' })

    const deleted = await Transaction.findByIdAndDelete(id)
    if (!deleted) {
      return res.status(404).json({ message: 'Purchase order not found.' })
    }
    return res.status(200).json({ deleted: true, id })
  } catch (err) {
    console.error('DELETE /api/purchase-orders/:id failed:', err)
    return res.status(500).json({ message: 'Failed to delete purchase order.' })
  }
})

module.exports = router;