const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelOrder = require('../../models/fuel/FuelOrder');
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelSupplier = require('../../models/fuel/FuelSupplier');
const FuelRack = require('../../models/fuel/FuelRack');
const { ConfidentialClientApplication } = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");

// Helper to format time for email body (e.g., 6-8pm)
const formatEmailTime = (start, end) => {
  const getH = (t) => {
    const h = parseInt(t.split(':')[0]);
    return `${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`;
  };
  return `${getH(start)}-${getH(end)} delivery`;
};

/**
 * Helper to format: April 10th, 2026 or April 10th
 * Identical to frontend logic for consistency.
 */
const formatPDFDate = (dateStr, includeYear = true) => {
  if (!dateStr) return "";

  // Ensure we don't have timezone shifts by adding mid-day time
  // Using T12:00:00 helps avoid the date jumping back a day in certain environments
  const date = new Date(dateStr + 'T12:00:00');

  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();

  // Add ordinal suffix (st, nd, rd, th)
  const getSuffix = (d) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  if (includeYear) {
    // April 10, 2026
    return `${month} ${day}, ${year}`;
  } else {
    // April 10th
    return `${month} ${day}${getSuffix(day)}`;
  }
};

// Also adding the day-of-week helper for your "Friday April 10th" requirement
const formatEmailDayDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr + 'T12:00:00');
  const dayName = date.toLocaleString('en-US', { weekday: 'long' });
  return `${dayName} ${formatPDFDate(dateStr, false)}`;
};

// routes/fuelOrders.js
router.get('/workspace-orders', async (req, res) => {
  try {
    const { stationId, date } = req.query;

    if (!stationId || !date) {
      return res.status(400).json({ message: "Station ID and Date are required" });
    }

    // Use UTC to match how MongoDB stores the dates from your post route
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const orders = await FuelOrder.find({
      station: stationId,
      $or: [
        // Case A: Scheduled for today
        { estimatedDeliveryDate: { $gte: start, $lte: end } },
        // Case B: Originally for today, but moved elsewhere
        { originalDeliveryDate: { $gte: start, $lte: end } }
      ]
    })
      // Mapped to match your Schema exactly (removing 'Id' suffix)
      .populate('carrier', 'carrierName')
      .populate('supplier', 'supplierName')
      .populate('rack', 'rackName rackLocation')
      .lean();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// fuelOrderRoutes.js
// fuelOrderRoutes.js
router.get('/check-existing', async (req, res) => {
  try {
    const { stationId, orderDate } = req.query;

    const start = new Date(orderDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(orderDate);
    end.setUTCHours(23, 59, 59, 999);

    const existingOrders = await FuelOrder.find({
      station: stationId,
      orderDate: { $gte: start, $lte: end }
    }).select('originalDeliveryDate poNumber');

    res.json({
      count: existingOrders.length,
      existingOrders: existingOrders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// router.post('/', async (req, res) => {
//   try {
//     const {
//       stationId, rackId, supplierId, carrierId,
//       items, poNumber, orderDate, deliveryDate,
//       startTime, endTime, badgeNo
//     } = req.body;

//     // 1. Check for duplicate PO Number
//     const existing = await FuelOrder.findOne({ poNumber });
//     if (existing) {
//       return res.status(400).json({ message: "An order with this PO Number already exists." });
//     }

//     // 2. Map frontend data to the new FuelOrder schema
//     const newOrder = new FuelOrder({
//       poNumber,
//       orderDate: new Date(orderDate),
//       // Schema uses 'originalDeliveryDate'
//       originalDeliveryDate: new Date(deliveryDate),
//       // Schema uses 'originalDeliveryWindow'
//       originalDeliveryWindow: {
//         start: startTime,
//         end: endTime
//       },
//       // Initialize estimates with original values for now
//       estimatedDeliveryDate: new Date(deliveryDate),
//       estimatedDeliveryWindow: {
//         start: startTime,
//         end: endTime
//       },
//       rack: rackId,
//       supplier: supplierId,
//       badgeNo: badgeNo,
//       carrier: carrierId,
//       station: stationId,
//       items,
//       currentStatus: "Created",
//       // History initialized with the creation timestamp
//       statusHistory: [
//         { status: "Created", timestamp: new Date() }
//       ]
//     });

//     const savedOrder = await newOrder.save();
//     res.status(201).json(savedOrder);
//   } catch (err) {
//     console.error("Save Order Error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

// routes/fuelOrders.js

router.post('/', async (req, res) => {
  try {
    const {
      stationId, rackId, supplierId, carrierId,
      items, poNumber, orderDate, deliveryDate,
      startTime, endTime, badgeNo, pdfBase64
    } = req.body;

    // 1. Existing Duplicate Check
    const existing = await FuelOrder.findOne({ poNumber });
    if (existing) return res.status(400).json({ message: "Duplicate PO Number." });

    // 2. Fetch related names for the email body
    const [station, rack, supplier] = await Promise.all([
      Location.findById(stationId).lean(),
      FuelRack.findById(rackId).lean(),
      FuelSupplier.findById(supplierId).lean()
    ]);

    // 3. Save Order to MongoDB
    const newOrder = new FuelOrder({
      poNumber,
      orderDate: new Date(orderDate),
      originalDeliveryDate: new Date(deliveryDate),
      originalDeliveryWindow: { start: startTime, end: endTime },
      estimatedDeliveryDate: new Date(deliveryDate),
      estimatedDeliveryWindow: { start: startTime, end: endTime },
      rack: rackId,
      supplier: supplierId,
      badgeNo,
      carrier: carrierId,
      station: stationId,
      items,
      currentStatus: "Created",
      statusHistory: [{ status: "Created", timestamp: new Date() }]
    });
    const savedOrder = await newOrder.save();

    // --- START EMAIL DRAFT LOGIC ---

    // A. Format Grades for Body (e.g., 43K Regular)
    const gradeSummary = items.map(item => {
      const kValue = (item.ltrs / 1000).toFixed(0);
      return `${kValue}K ${item.grade}`;
    }).join('\n');

    const formattedDate = formatPDFDate(deliveryDate, false); // "Friday April 10th"
    const customerName = station.fuelCustomerName;

    // B. Build Email Payload
    const emailBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Hello Team,</p>
        
        <p>Here is our load for ${customerName} ${formattedDate}</p>
        
        <p>Please let me know if you have any questions.</p>
        
        <p>
          <b><u>${rack.rackName} ${rack.rackLocation} Terminal ${supplier.supplierName} (${badgeNo})</u></b><br>
          
          <b>${station.stationName}</b><br>
          
          ${gradeSummary.replace(/\n/g, '<br>')}<br>
          
          <span style="color: red; font-weight: bold;">${poNumber}</span><br>
          
          ${formatEmailTime(startTime, endTime)}
        </p>
        
        <p>Let me know if you have any questions.</p>
      </div>
    `;

    const draftPayload = {
      subject: `${formattedDate} ${customerName} Load`,
      body: { contentType: "HTML", content: emailBody },
      toRecipients: [{ emailAddress: { address: "daksh@gen7fuel.com" } }],
      // Note: PDF attachment logic assumes you pass the buffer from your backend PDF generator
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: `Fuel Order Form NSP ${customerName} ${formattedDate}.pdf`,
          contentType: "application/pdf",
          contentBytes: pdfBase64 // Use the base64 string directly here
        }
      ]
    };

    // C. Create Draft via Microsoft Graph
    const msalConfig = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
      }
    };
    const cca = new ConfidentialClientApplication(msalConfig);
    const authRes = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"]
    });
    const client = Client.init({ authProvider: (done) => done(null, authRes.accessToken) });
    // Create draft in the user's mailbox
    // Change this line
    await client.api('/users/daksh@gen7fuel.com/mailFolders/drafts/messages').post(draftPayload);
    // Try sending directly to yourself as a test
    // const directSend = {
    //   message: draftPayload, // Your existing object goes here
    //   saveToSentItems: "true"
    // };

    // try {
    //   await client.api('/users/daksh@gen7fuel.com/sendMail').post(directSend);
    //   console.log("Email sent successfully! Permissions are correct.");
    // } catch (sendErr) {
    //   console.error("Direct send also failed. This is a permission/licensing issue.");
    //   throw sendErr;
    // }
    res.status(201).json({
      message: "Order created and email draft pushed to Outlook.",
      order: savedOrder
    });

  } catch (err) {
    console.error("Workflow Error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      estimatedDeliveryDate,
      estimatedDeliveryWindow,
      items,
      currentStatus
    } = req.body;

    const order = await FuelOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // 1. Handle Rescheduling
    if (estimatedDeliveryDate) order.estimatedDeliveryDate = estimatedDeliveryDate;
    if (estimatedDeliveryWindow) order.estimatedDeliveryWindow = estimatedDeliveryWindow;

    // 2. Handle Quantity Updates
    if (items) order.items = items;

    // 3. Handle Status Update + History
    if (currentStatus && currentStatus !== order.currentStatus) {
      order.currentStatus = currentStatus;
      order.statusHistory.push({
        status: currentStatus,
        timestamp: new Date()
      });
    }

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;