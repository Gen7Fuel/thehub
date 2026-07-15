const express = require("express");
const router = express.Router();
const { DateTime } = require("luxon");
const Transaction = require("../models/Transactions");
const Fleet = require("../models/Fleet");
const Product = require("../models/Product");
const TIMEZONE = "America/Toronto";
const Location = require("../models/Location");
const { pushNotification } = require("../services/notificationService");
const { emailQueue } = require('../queues/emailQueue');
const { getPermissionMap } = require('../utils/permissionStore');

const escapeHtml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Helper: check if a user has effective access to a permId
function hasEffectiveAccess(user, role, permId) {
  const userOverride = user.customPermissionsArray?.find(p => p.permId === permId);
  if (userOverride !== undefined) return userOverride.value;
  if (role && role.permissionsArray) {
    const roleSetting = role.permissionsArray.find(p => p.permId === permId);
    return roleSetting ? roleSetting.value : false;
  }
  return false;
}

// Derive a "YYYY-MM-DD" business date string from a raw request value
const toDateStr = (raw) => String(raw).slice(0, 10);

// Legacy bridge: keep `date` (Date, required) populated for PO docs so other
// consumers that still read `Transaction.date` (e.g. AR-check aggregation,
// which spans both PO and Kardpoll) keep working. Noon UTC keeps the derived
// instant on the same local calendar day for all Canadian station timezones
// (UTC-4..-8) — do not reuse this trick for non-Canadian sites.
const dateStrToLegacyDate = (dateStr) => new Date(`${dateStr}T12:00:00.000Z`);

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
  let {
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
    vehicleMakeModel,
    licensePlate,
    purchaseType,
    itemsDescription,
  } = req.body;

  try {
    // Fleet upsert + change-notification (owned by backend so comparison happens before update)
    if (fleetCardNumber) {
      try {
        const existingFleet = await Fleet.findOne({ fleetCardNumber }).lean();
        const normalize = (v) => (v || '').trim().toLowerCase();

        const fieldMap = [
          { label: 'Customer Name', submitted: customerName,     stored: existingFleet?.customerName },
          { label: 'Driver Name',   submitted: driverName,       stored: existingFleet?.driverName },
          { label: 'Make & Model',  submitted: vehicleMakeModel, stored: existingFleet?.vehicleMakeModel },
          { label: 'License Plate', submitted: licensePlate,     stored: existingFleet?.numberPlate },
        ];

        const changes = existingFleet
          ? fieldMap.filter(f => normalize(f.submitted) !== normalize(f.stored))
          : [];

        if (existingFleet) {
          await Fleet.findOneAndUpdate(
            { fleetCardNumber },
            { customerName, driverName, vehicleMakeModel, numberPlate: licensePlate }
          );
        } else {
          await Fleet.create({ fleetCardNumber, customerName, driverName, vehicleMakeModel, numberPlate: licensePlate });
        }

        if (changes.length > 0) {
          const changesHtml = changes.map(f =>
            `<tr>
              <td><strong>${escapeHtml(f.label)}</strong></td>
              <td>${escapeHtml(f.stored || '(empty)')}</td>
              <td>&#8594;</td>
              <td>${escapeHtml(f.submitted || '(empty)')}</td>
            </tr>`
          ).join('');

          await emailQueue.add('poCustomerInfoChanged', {
            to: 'ar@gen7fuel.com',
            cc: 'mohammad@gen7fuel.com',
            subject: `Customer Info Changed on PO — ${stationName}`,
            html: `
              <p>Customer information was changed on a PO submission at <strong>${escapeHtml(stationName)}</strong>.</p>
              <h3>Changed Fields</h3>
              <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px">
                <thead><tr><th align="left">Field</th><th align="left">Was</th><th></th><th align="left">Now</th></tr></thead>
                <tbody>${changesHtml}</tbody>
              </table>
              <h3>Full Submitted Values</h3>
              <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px">
                <tr><td><strong>Site</strong></td><td>${escapeHtml(stationName)}</td></tr>
                <tr><td><strong>Fleet Card</strong></td><td>${escapeHtml(fleetCardNumber)}</td></tr>
                <tr><td><strong>Customer Name</strong></td><td>${escapeHtml(customerName)}</td></tr>
                <tr><td><strong>Driver Name</strong></td><td>${escapeHtml(driverName)}</td></tr>
                <tr><td><strong>Make &amp; Model</strong></td><td>${escapeHtml(vehicleMakeModel)}</td></tr>
                <tr><td><strong>License Plate</strong></td><td>${escapeHtml(licensePlate)}</td></tr>
              </table>`,
          });
        }
      } catch (fleetErr) {
        console.error('Fleet upsert / change-notification failed:', fleetErr);
        // Non-fatal — PO save continues
      }
    }

    let dateStr;
    let legacyDate = date;
    if (source === 'PO') {
      dateStr = date ? toDateStr(date) : DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');
      legacyDate = dateStrToLegacyDate(dateStr);
    }

    const newOrder = new Transaction({
      source,
      date: legacyDate,
      dateStr,
      stationName,
      fleetCardNumber: fleetCardNumber || '',
      poNumber: poNumber || '',
      quantity: quantity ?? 0,
      amount,
      productCode: productCode || '',
      signature,
      receipt,
      customerName,
      driverName,
      vehicleMakeModel: vehicleMakeModel || '',
      licensePlate: licensePlate || '',
      purchaseType: purchaseType || 'fuel',
      itemsDescription: itemsDescription || '',
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
      'requestReceipt',
      'customerName',
      'driverName',
      'vehicleMakeModel',
      'licensePlate',
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

    // If changing date, require a valid "YYYY-MM-DD" string and the po.changeDate permission
    if (Object.prototype.hasOwnProperty.call(updates, 'date')) {
      const dateStr = toDateStr(updates.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ message: "Invalid date format." })
      }

      const permissionMap = getPermissionMap();
      const permId = permissionMap.get('po.changeDate');
      if (!permId || !hasEffectiveAccess(req.user, req.user.role, permId)) {
        return res.status(403).json({ message: "You do not have permission to change the PO date." });
      }

      updates.dateStr = dateStr
      updates.date = dateStrToLegacyDate(dateStr)
    }

    const updatedOrder = await Transaction.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updates },
      { new: true, runValidators: true }
    )

    if (!updatedOrder) {
      return res.status(404).json({ message: "Purchase order not found." })
    }

    if (updates.requestReceipt === true) {
      Location.findOne({ stationName: updatedOrder.stationName }, 'email stationName').lean()
        .then(location => {
          if (!location?.email) return
          const redirectUrl = `https://app.gen7fuel.com/po/list`
          return pushNotification({
            io: null,
            recipientEmails: [location.email],
            bccEmails: ['mohammad@gen7fuel.com'],
            slug: 'po-receipt-requested',
            subject: `🧾 Receipt Required – ${location.stationName} – PO #${updatedOrder.poNumber || updatedOrder._id}`,
            fieldValues: {
              site: location.stationName,
              poNumber: updatedOrder.poNumber || String(updatedOrder._id),
              customerName: updatedOrder.customerName || '',
              amount: (updatedOrder.amount || 0).toFixed(2),
              date: updatedOrder.dateStr || new Date(updatedOrder.date).toLocaleDateString('en-CA', { timeZone: 'UTC' }),
              redirectUrl,
            },
            type: 'system',
          })
        })
        .catch(e => console.error('PO receipt notification error:', e))
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
  const { startDate, endDate, stationName, site } = req.query;
  // Accept `site` as an alias for `stationName` — Desk calls this endpoint
  // with either name depending on the page. Without this, a `site=`-only
  // request silently drops the station filter (Mongoose omits an `undefined`
  // key), returning every station's POs instead of just the selected one.
  const stationFilter = stationName || site;
  const filter = { source: "PO", deletedAt: null };
  if (stationFilter) filter.stationName = stationFilter;

  if (startDate && endDate) {
    // Backward compatibility: pre-migration docs have no dateStr, so match
    // those against the old Date-range logic instead of excluding them.
    const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const start = isYmd(startDate)
      ? DateTime.fromISO(`${startDate}T00:00:00`, { zone: TIMEZONE }).toJSDate()
      : new Date(startDate);
    const end = isYmd(endDate)
      ? DateTime.fromISO(`${endDate}T00:00:00`, { zone: TIMEZONE }).plus({ days: 1 }).toJSDate()
      : new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1));

    filter.$or = [
      { dateStr: { $gte: toDateStr(startDate), $lte: toDateStr(endDate) } },
      { dateStr: { $exists: false }, date: { $gte: start, $lt: end } },
    ];
  }

  try {
    const orders = await Transaction.find(filter)
      .select('fleetCardNumber driverName customerName vehicleMakeModel licensePlate productCode quantity amount signature date dateStr receipt poNumber requestReceipt')
      .sort({ date: -1, _id: -1 });

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

    const existing = await Transaction.findOne({ source: 'PO', stationName, poNumber, deletedAt: null }).select('_id').lean()
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
    const order = await Transaction.findOne({ _id: id, deletedAt: null }).select('fleetCardNumber productCode quantity amount signature');

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

// Soft-delete a purchase order by ID — flags the doc instead of removing it so a
// mistaken delete (site managers now have this access) can be fixed at the DB level.
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ message: 'ID is required' })

    const deleted = await Transaction.findOneAndUpdate(
      { _id: id, source: 'PO', deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
      { new: true }
    )
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