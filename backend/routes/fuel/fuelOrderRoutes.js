const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelOrder = require('../../models/fuel/FuelOrder');
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelSupplier = require('../../models/fuel/FuelSupplier');
const FuelRack = require('../../models/fuel/FuelRack');
const moment = require('moment-timezone');
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

router.get('/workspace-orders', async (req, res) => {
  try {
    const { stationId, date } = req.query; // date is "YYYY-MM-DD"

    if (!stationId || !date) {
      return res.status(400).json({ message: "Station ID and Date are required" });
    }

    // 1. Fetch station to get its local timezone
    const station = await Location.findById(stationId).select('timezone').lean();
    const tz = station?.timezone || 'America/Toronto';

    // 2. Create a 24-hour window based on the STATION'S wall clock
    const start = moment.tz(date, tz).startOf('day').toDate();
    const end = moment.tz(date, tz).endOf('day').toDate();

    const orders = await FuelOrder.find({
      station: stationId,
      $or: [
        { estimatedDeliveryDate: { $gte: start, $lte: end } },
        { originalDeliveryDate: { $gte: start, $lte: end } }
      ]
    })
      .populate('carrier supplier rack')
      .populate('station', 'stationName timezone')
      .lean();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// // routes/fuelOrders.js
// router.get('/workspace-orders', async (req, res) => {
//   try {
//     const { stationId, date } = req.query;

//     if (!stationId || !date) {
//       return res.status(400).json({ message: "Station ID and Date are required" });
//     }

//     // Use UTC to match how MongoDB stores the dates from your post route
//     const start = new Date(date);
//     start.setUTCHours(0, 0, 0, 0);
//     const end = new Date(date);
//     end.setUTCHours(23, 59, 59, 999);

//     const orders = await FuelOrder.find({
//       station: stationId,
//       $or: [
//         // Case A: Scheduled for today
//         { estimatedDeliveryDate: { $gte: start, $lte: end } },
//         // Case B: Originally for today, but moved elsewhere
//         { originalDeliveryDate: { $gte: start, $lte: end } }
//       ]
//     })
//       // Mapped to match your Schema exactly (removing 'Id' suffix)
//       .populate('carrier', 'carrierName')
//       .populate('supplier', 'supplierName')
//       .populate('rack', 'rackName rackLocation')
//       .populate('station', 'stationName fuelStationNumber fuelCustomerName address')
//       .lean();

//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// fuelOrderRoutes.js
// fuelOrderRoutes.js
router.get('/check-existing', async (req, res) => {
  try {
    const { stationId, orderDate } = req.query; // orderDate is "YYYY-MM-DD"

    // 1. Get the station timezone
    const station = await Location.findById(stationId).select('timezone').lean();
    const tz = station?.timezone || 'America/Toronto';

    // 2. Define the start and end of that day in the STATION's timezone
    // .startOf('day') gives 00:00:00.000 in local time
    // .endOf('day') gives 23:59:59.999 in local time
    const start = moment.tz(orderDate, tz).startOf('day').toDate();
    const end = moment.tz(orderDate, tz).endOf('day').toDate();

    // console.log(`[DEBUG] Checking existing orders for station ${stationId}`);
    // console.log(`[DEBUG] Timezone: ${tz} | Window: ${start.toISOString()} to ${end.toISOString()}`);

    // 3. Query using the localized UTC window
    const existingOrders = await FuelOrder.find({
      station: stationId,
      orderDate: { $gte: start, $lte: end }
    }).select('originalDeliveryDate poNumber');

    res.json({
      count: existingOrders.length,
      existingOrders: existingOrders
    });
  } catch (err) {
    console.error(err);
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

// router.post('/', async (req, res) => {
//   try {
//     const {
//       stationId, rackId, supplierId, carrierId,
//       items, poNumber, orderDate, deliveryDate,
//       startTime, endTime, badgeNo, pdfBase64
//     } = req.body;

//     // 1. Existing Duplicate Check
//     const existing = await FuelOrder.findOne({ poNumber });
//     if (existing) return res.status(400).json({ message: "Duplicate PO Number." });

//     // 2. Fetch related names for the email body
//     const [station, rack, supplier, carrier] = await Promise.all([
//       Location.findById(stationId).lean(),
//       FuelRack.findById(rackId).lean(),
//       FuelSupplier.findById(supplierId).lean(),
//       FuelCarrier.findById(carrierId).lean()
//     ]);

//     // 3. Save Order to MongoDB
//     const newOrder = new FuelOrder({
//       poNumber,
//       orderDate: new Date(orderDate),
//       originalDeliveryDate: new Date(deliveryDate),
//       originalDeliveryWindow: { start: startTime, end: endTime },
//       estimatedDeliveryDate: new Date(deliveryDate),
//       estimatedDeliveryWindow: { start: startTime, end: endTime },
//       rack: rackId,
//       supplier: supplierId,
//       badgeNo,
//       carrier: carrierId,
//       station: stationId,
//       items,
//       currentStatus: "Created",
//       statusHistory: [{ status: "Created", timestamp: new Date() }]
//     });
//     const savedOrder = await newOrder.save();

//     // --- START EMAIL DRAFT LOGIC ---

//     // A. Format Grades for Body (e.g., 43K Regular)
//     const gradeSummary = items.map(item => {
//       const kValue = (item.ltrs / 1000).toFixed(0);
//       return `${kValue}K ${item.grade}`;
//     }).join('\n');

//     const formattedDate = formatPDFDate(deliveryDate, false); // "Friday April 10th"
//     const customerName = station.fuelCustomerName;

//     // B. Build Email Payload
//     const emailBody = `
//       <div style="font-family: Arial, sans-serif; line-height: 1.5;">
//         <p>Hello Team,</p>

//         <p>Here is our load for ${customerName} ${formattedDate}</p>

//         <p>Please let me know if you have any questions.</p>

//         <p>
//           <b><u>Pick Up: ${rack.rackName} ${rack.rackLocation} Terminal - ${supplier.supplierName} Badge (${badgeNo})</u></b><br>

//           <b>${station.stationName}</b><br>

//           ${gradeSummary.replace(/\n/g, '<br>')}<br>

//           <span style="color: red; font-weight: bold;">${poNumber}</span><br>

//           ${formatEmailTime(startTime, endTime)}
//         </p>

//         <p>Let me know if you have any questions.</p>
//       </div>
//     `;
//     // B. Build Email Payload
//     const permanentCcEmails = [
//       "kellie@gen7fuel.com",
//       "nmiller@gen7fuel.com",
//       "ryan@gen7fuel.com"
//     ];
//     // Fallback to a default if the station doesn't have one set
//     const targetMailbox = "daksh@gen7fuel.com" || "daksh@gen7fuel.com";

//     const draftPayload = {
//       subject: `${formattedDate} ${customerName} Load`,
//       body: { contentType: "HTML", content: emailBody },

//       // Map the carrier's 'toEmails' array to the Graph API format
//       toRecipients: (carrier.toEmails || []).map(email => ({
//         emailAddress: { address: email }
//       })),

//       // Combine carrier's 'ccEmails' with your 3 permanent placeholders
//       ccRecipients: [
//         ...(carrier.ccEmails || []).map(email => ({
//           emailAddress: { address: email }
//         })),
//         ...permanentCcEmails.map(email => ({
//           emailAddress: { address: email }
//         }))
//       ],

//       attachments: [
//         {
//           "@odata.type": "#microsoft.graph.fileAttachment",
//           name: `Fuel Order Form NSP ${customerName} ${formattedDate}.pdf`,
//           contentType: "application/pdf",
//           contentBytes: pdfBase64
//         }
//       ]
//     };

//     // C. Create Draft via Microsoft Graph
//     const msalConfig = {
//       auth: {
//         clientId: process.env.AZURE_CLIENT_ID,
//         authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
//         clientSecret: process.env.AZURE_CLIENT_SECRET,
//       }
//     };
//     const cca = new ConfidentialClientApplication(msalConfig);
//     const authRes = await cca.acquireTokenByClientCredential({
//       scopes: ["https://graph.microsoft.com/.default"]
//     });
//     const client = Client.init({ authProvider: (done) => done(null, authRes.accessToken) });

//     // Create draft in the target user's mailbox
//     await client
//       .api(`/users/${targetMailbox}/mailFolders/drafts/messages`)
//       .post(draftPayload);

//     // Sending the email directly
//     // const directSend = {
//     //   message: draftPayload, // Your existing object goes here
//     //   saveToSentItems: "true"
//     // };

//     // try {
//     //   await client.api('/users/daksh@gen7fuel.com/sendMail').post(directSend);
//     //   console.log("Email sent successfully! Permissions are correct.");
//     // } catch (sendErr) {
//     //   console.error("Direct send also failed. This is a permission/licensing issue.");
//     //   throw sendErr;
//     // }

//     res.status(201).json({
//       message: "Order created and email draft pushed to Outlook.",
//       order: savedOrder,
//       pushedTo: targetMailbox
//     });

//   } catch (err) {
//     console.error("Workflow Error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

router.post('/', async (req, res) => {
  try {
    const {
      rackId, supplierId, carrierId,
      orderDate, deliveryDate,
      startTime, endTime, badgeNo,
      isSplit, orders // Array of { stationId, items, poNumber, pdfBase64, customerName }
    } = req.body;

    const GRADE_ORDER = ["Regular", "Premium", "Diesel", "Dyed Diesel"];

    // 1. Duplicate & Logistics Check
    const poNumbers = orders.map(o => o.poNumber);
    const existing = await FuelOrder.findOne({ poNumber: { $in: poNumbers } });
    if (existing) return res.status(400).json({ message: `Duplicate PO: ${existing.poNumber}` });

    const [rack, supplier, carrier] = await Promise.all([
      FuelRack.findById(rackId).lean(),
      FuelSupplier.findById(supplierId).lean(),
      FuelCarrier.findById(carrierId).lean()
    ]);

    // 2. Save Orders and build Email Body sections
    let emailStationSections = "";
    let attachments = [];
    let savedOrders = [];
    const formattedDate = formatPDFDate(deliveryDate, false);

    for (const orderData of orders) {
      const station = await Location.findById(orderData.stationId).lean();

      const tz = station?.timezone || 'America/Toronto';

      // Use moment-timezone to pin delivery to the station's local start-of-day
      const stationMidnight = moment.tz(deliveryDate, tz).startOf('day').toDate();

      // Save to MongoDB
      const newOrder = new FuelOrder({
        poNumber: orderData.poNumber,
        orderDate: new Date(orderDate),
        originalDeliveryDate: stationMidnight,
        originalDeliveryWindow: { start: startTime, end: endTime },
        estimatedDeliveryDate: stationMidnight,
        estimatedDeliveryWindow: { start: startTime, end: endTime },
        rack: rackId,
        supplier: supplierId,
        badgeNo,
        carrier: carrierId,
        station: orderData.stationId,
        items: orderData.items,
        currentStatus: "Created",
        statusHistory: [{ status: "Created", timestamp: new Date() }]
      });
      savedOrders.push(await newOrder.save());

      // Format Grades for this specific station
      const gradeSummary = orderData.items
        .filter(i => (i.ltrs || 0) > 0)
        .sort((a, b) => {
          const indexA = GRADE_ORDER.indexOf(a.grade);
          const indexB = GRADE_ORDER.indexOf(b.grade);
          return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        })
        .map(item => `${(item.ltrs / 1000).toFixed(0)}K ${item.grade}`)
        .join('<br>');

      // Add to Email Body String
      emailStationSections += `
        <p>
          <b>${station.stationName}</b><br>
          ${gradeSummary}<br>
          <span style="color: red; font-weight: bold;">${orderData.poNumber}</span><br>
          ${formatEmailTime(startTime, endTime)}
        </p>
      `;

      // Add to Attachments Array
      attachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `Fuel Order Form NSP ${station.fuelCustomerName} ${formattedDate}.pdf`,
        contentType: "application/pdf",
        contentBytes: orderData.pdfBase64
      });
    }

    // 3. Build Final Combined Email
    const combinedCustomerNames = orders.map(o => o.customerName).join('/');
    const emailBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Hello Team,</p>
        <p>Here is our load for ${combinedCustomerNames} ${formattedDate}</p>
        <p>
          <b><u>Pick Up: ${rack.rackName} ${rack.rackLocation} Terminal - ${supplier.supplierName} Badge (${badgeNo})</u></b>
        </p>
        ${emailStationSections}
        <p>Let me know if you have any questions.</p>
      </div>
    `;

    const draftPayload = {
      subject: `${formattedDate} ${combinedCustomerNames} Load`,
      body: { contentType: "HTML", content: emailBody },
      toRecipients: (carrier.toEmails || []).map(email => ({ emailAddress: { address: email } })),
      ccRecipients: [
        ...(carrier.ccEmails || []).map(email => ({ emailAddress: { address: email } })),
        ...["kellie@gen7fuel.com", "nmiller@gen7fuel.com", "ryan@gen7fuel.com"].map(email => ({ emailAddress: { address: email } }))
      ],
      attachments: attachments
    };

    // 4. Push to Microsoft Graph
    const msalConfig = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
      }
    };
    const cca = new ConfidentialClientApplication(msalConfig);
    const authRes = await cca.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
    const client = Client.init({ authProvider: (done) => done(null, authRes.accessToken) });

    // const targetMailbox = "nsporders@nspetroleum.ca";
    const targetMailbox = "daksh@gen7fuel.com"; //only for testing
    await client.api(`/users/${targetMailbox}/mailFolders/drafts/messages`).post(draftPayload);

    res.status(201).json({
      message: "Order(s) created and email draft pushed.",
      orders: savedOrders,
      pushedTo: targetMailbox
    });

  } catch (err) {
    console.error("Workflow Error:", err);
    res.status(500).json({ message: err.message });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const { estimatedDeliveryDate, estimatedDeliveryWindow, items, currentStatus } = req.body;

    const order = await FuelOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (estimatedDeliveryDate) {
      // Fetch the location to get the station's timezone
      const station = await Location.findById(order.station).lean();
      const tz = station?.timezone || 'America/Toronto';

      // Force the date to be the START of the day in that timezone, then save
      order.estimatedDeliveryDate = moment.tz(estimatedDeliveryDate, tz).startOf('day').toDate();
    }

    if (estimatedDeliveryWindow) order.estimatedDeliveryWindow = estimatedDeliveryWindow;
    if (items) order.items = items;

    if (currentStatus && currentStatus !== order.currentStatus) {
      order.currentStatus = currentStatus;
      order.statusHistory.push({
        status: currentStatus,
        timestamp: new Date() // Actual timestamp of the update
      });
    }

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// router.put('/:id', async (req, res) => {
//   try {
//     const {
//       estimatedDeliveryDate,
//       estimatedDeliveryWindow,
//       items,
//       currentStatus
//     } = req.body;

//     const order = await FuelOrder.findById(req.params.id);
//     if (!order) return res.status(404).json({ message: "Order not found" });

//     // 1. Handle Rescheduling
//     if (estimatedDeliveryDate) order.estimatedDeliveryDate = estimatedDeliveryDate;
//     if (estimatedDeliveryWindow) order.estimatedDeliveryWindow = estimatedDeliveryWindow;

//     // 2. Handle Quantity Updates
//     if (items) order.items = items;

//     // 3. Handle Status Update + History
//     if (currentStatus && currentStatus !== order.currentStatus) {
//       order.currentStatus = currentStatus;
//       order.statusHistory.push({
//         status: currentStatus,
//         timestamp: new Date()
//       });
//     }

//     await order.save();
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

module.exports = router;