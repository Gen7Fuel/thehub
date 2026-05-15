const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelOrder = require('../../models/fuel/FuelOrder');
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelSupplier = require('../../models/fuel/FuelSupplier');
const FuelRack = require('../../models/fuel/FuelRack');
const { emailQueue } = require('../../queues/emailQueue');
const moment = require('moment-timezone');
// const { processUpcomingOrderNotifications } = require('../../cron_jobs/fuelOrderEODCron');
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

async function processUpcomingOrderNotifications() {

  /**
   * ------------------------------------------------------------
   * 1. MASTER TIMEZONE = PST / Vancouver
   * ------------------------------------------------------------
   * We decide "tomorrow" and "day after tomorrow"
   * using PST so the scheduler behaves consistently.
   */

  const masterTZ = "America/Vancouver";

  const todayPST = moment().tz(masterTZ).startOf('day');

  const tomorrowStr = todayPST
    .clone()
    .add(1, 'days')
    .format('YYYY-MM-DD');

  const dayAfterStr = todayPST
    .clone()
    .add(2, 'days')
    .format('YYYY-MM-DD');

  const targetDates = [tomorrowStr, dayAfterStr];

  /**
   * ------------------------------------------------------------
   * 2. FETCH ORDERS
   * ------------------------------------------------------------
   * We cannot query exact UTC timestamps because every station
   * stores midnight in its OWN timezone converted to UTC.
   *
   * Example:
   * Toronto midnight = 04:00 UTC
   * Vancouver midnight = 07:00 UTC
   *
   * So instead:
   * - fetch upcoming range
   * - compare using station timezone
   */

  const earliestUTC = moment().utc().startOf('day').toDate();
  const latestUTC = moment().utc().add(4, 'days').endOf('day').toDate();

  const allOrders = await FuelOrder.find({
    estimatedDeliveryDate: {
      $gte: earliestUTC,
      $lte: latestUTC
    }
  })
    .populate('station')
    .populate('rack')
    .populate('carrier')
    .populate('supplier');

  /**
   * ------------------------------------------------------------
   * 3. FILTER USING STATION TIMEZONE
   * ------------------------------------------------------------
   */

  const orders = allOrders.filter(order => {

    if (!order.station?.timezone) return false;

    const stationTZ = order.station.timezone;

    const localDate = moment(order.estimatedDeliveryDate)
      .tz(stationTZ)
      .format('YYYY-MM-DD');

    return targetDates.includes(localDate);
  });

  /**
   * ------------------------------------------------------------
   * 4. GROUP BY DATE -> STATION
   * ------------------------------------------------------------
   */

  const grouped = {};

  for (const order of orders) {

    if (!order.station) continue;

    const stationTZ = order.station.timezone;

    const deliveryDate = moment(order.estimatedDeliveryDate)
      .tz(stationTZ)
      .format('YYYY-MM-DD');

    const stationName = order.station.stationName;

    if (!grouped[deliveryDate]) {
      grouped[deliveryDate] = {};
    }

    if (!grouped[deliveryDate][stationName]) {
      grouped[deliveryDate][stationName] = [];
    }

    grouped[deliveryDate][stationName].push(order);
  }

  /**
    * ------------------------------------------------------------
    * 5. HELPER: HTML BUILDER FUNCTION
    * ------------------------------------------------------------
    * Moving this to a helper function so we can call it for 
    * both the Master list and the BC-specific list.
    */
  const buildEmailHtml = (dataGroup, tStr, daStr) => {
    let innerHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
        <h2 style="color: #1a365d; margin-bottom: 4px;">Fuel Delivery Schedule</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0;">
          Deliveries for: <b>${tStr}</b> & <b>${daStr}</b>
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
    `;

    const sortedDates = Object.keys(dataGroup).sort();
    const gradeOrder = ["Regular", "Premium", "Diesel", "Dyed Diesel"];

    for (const date of sortedDates) {
      innerHtml += `<div style="background-color: #f8fafc; padding: 8px 12px; border-radius: 6px; margin-top: 25px;">
                      <span style="font-size: 18px; font-weight: bold; color: #2d3748;">📅 Date: ${date}</span>
                    </div>`;

      const stations = dataGroup[date];
      for (const stationName of Object.keys(stations).sort()) {
        innerHtml += `<div style="margin-left: 10px; margin-top: 15px; border-left: 4px solid #3182ce; padding-left: 12px;">
                        <h3 style="margin: 0; font-size: 16px; color: #2b6cb0;">${stationName}</h3>
                      </div>`;

        for (const order of stations[stationName]) {
          const sortedItems = gradeOrder
            .map(g => order.items.find(i => i.grade === g))
            .filter(i => i && i.ltrs > 0);

          const qtyPills = sortedItems.map(i => `
            <div style="display: inline-block; background: #edf2f7; padding: 4px 8px; border-radius: 4px; margin: 2px 4px 2px 0; font-size: 12px;">
              <b style="color: #4a5568;">${i.grade}:</b> ${i.ltrs.toLocaleString()}L
            </div>
          `).join('');

          innerHtml += `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 10px 0 10px 10px;">
              <table width="100%">
                <tr>
                  <td style="font-weight: bold; font-size: 14px;">PO: ${order.poNumber}</td>
                  <td style="text-align: right; font-size: 13px; color: #718096;">🕒 ${order.estimatedDeliveryWindow?.start || '-'} - ${order.estimatedDeliveryWindow?.end || '-'}</td>
                </tr>
              </table>
              <div style="margin: 8px 0; font-size: 13px; color: #4a5568;">
                <b>Supplier:</b> ${order.supplier?.supplierName || '-'} | <b>Carrier:</b> ${order.carrier?.carrierName || '-'}
                <br/><b>Rack:</b> ${order.rack?.rackName || '-'} (${order.rack?.rackLocation || '-'})
              </div>
              <div style="border-top: 1px dashed #edf2f7; padding-top: 8px; margin-top: 8px;">${qtyPills}</div>
            </div>`;
        }
      }
    }
    innerHtml += `<p style="font-size: 11px; color: #a0aec0; text-align: center; margin-top: 40px;">This is an automated notification from Gen7 Hub Fuel Management System.</p></div>`;
    return innerHtml;
  };

  /**
   * ------------------------------------------------------------
   * 6. PREPARE DATA FOR BOTH EMAILS
   * ------------------------------------------------------------
   */

  // A. Master Group (Everyone - already stored in 'grouped')
  const masterHtml = buildEmailHtml(grouped, tomorrowStr, dayAfterStr);

  // B. BC-Only Group
  const bcGrouped = {};
  const bcOrders = orders.filter(o => o.station?.province === 'British Columbia');

  for (const order of bcOrders) {
    const deliveryDate = moment(order.estimatedDeliveryDate).tz(order.station.timezone).format('YYYY-MM-DD');
    const stationName = order.station.stationName;
    if (!bcGrouped[deliveryDate]) bcGrouped[deliveryDate] = {};
    if (!bcGrouped[deliveryDate][stationName]) bcGrouped[deliveryDate][stationName] = [];
    bcGrouped[deliveryDate][stationName].push(order);
  }

  /**
   * ------------------------------------------------------------
   * 7. SEND BOTH EMAILS TO QUEUE
   * ------------------------------------------------------------
   */

  // 1. Send Master List (All Provinces)
  await emailQueue.add("sendFuelOrderNotification", {
    to: ['Glenn@gpmcholdings.ca', 'kellie@gen7fuel.com', 'Mandy@gen7fuel.com', 'Brian@gpmcholdings.ca', 'kporter@gen7fuel.com'], // Standard recipients list
    cc: ['Ryan@gen7fuel.com', 'nmiller@gen7fuel.com', 'nsporders@nspetroleum.ca'],
    subject: `Upcoming Fuel Deliveries - ${tomorrowStr} & ${dayAfterStr}`,
    html: masterHtml
  });

  // 2. Send BC-Only List (Only if BC orders exist)
  if (bcOrders.length > 0) {
    const bcHtml = buildEmailHtml(bcGrouped, tomorrowStr, dayAfterStr);

    await emailQueue.add("sendFuelOrderNotification", {
      to: ['michelle@gen7fuel.com'], // BC Specific recipients
      subject: `[BC REGION] Upcoming Fuel Deliveries - ${tomorrowStr} & ${dayAfterStr}`,
      html: bcHtml
    });
  }

  return orders.length;
}

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
      .populate('station', 'stationName timezone fuelStationNumber fuelCustomerName address')
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

router.post('/', async (req, res) => {
  try {
    const {
      rackId, supplierId, carrierId,
      orderDate, deliveryDate,
      startTime, endTime,
      isSplit, orders // Each order now contains its own badgeNo
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

    // 2. Process Orders & Group for Email
    let attachments = [];
    let savedOrders = [];
    let badgeGroups = {}; // Logic: { "Badge123": "html string for this badge's orders", ... }

    const formattedDate = formatPDFDate(deliveryDate, false);

    for (const orderData of orders) {
      const station = await Location.findById(orderData.stationId).lean();
      const tz = station?.timezone || 'America/Toronto';
      const stationMidnight = moment.tz(deliveryDate, tz).startOf('day').toDate();

      // Save to MongoDB (Uses the badgeNo from THIS specific order)
      const newOrder = new FuelOrder({
        poNumber: orderData.poNumber,
        orderDate: new Date(orderDate),
        originalDeliveryDate: stationMidnight,
        originalDeliveryWindow: { start: startTime, end: endTime },
        estimatedDeliveryDate: stationMidnight,
        estimatedDeliveryWindow: { start: startTime, end: endTime },
        rack: rackId,
        supplier: supplierId,
        badgeNo: orderData.badgeNo, // Mapping specific badge
        carrier: carrierId,
        station: orderData.stationId,
        items: orderData.items,
        currentStatus: "Created",
        statusHistory: [{ status: "Created", timestamp: new Date() }]
      });
      savedOrders.push(await newOrder.save());

      // Format Grades
      const gradeSummary = orderData.items
        .filter(i => (i.ltrs || 0) > 0)
        .sort((a, b) => {
          const indexA = GRADE_ORDER.indexOf(a.grade);
          const indexB = GRADE_ORDER.indexOf(b.grade);
          return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        })
        .map(item => `${(item.ltrs / 1000).toFixed(0)}K ${item.grade}`)
        .join('<br>');

      // Build the HTML snippet for this specific station order
      const stationHtml = `
        <p style="margin-left: 20px;">
          <b>${station.stationName}</b><br>
          ${gradeSummary}<br>
          <span style="color: red; font-weight: bold;">${orderData.poNumber}</span><br>
          ${formatEmailTime(startTime, endTime)}
        </p>
      `;

      // Group by Badge: Initialize badge section if new, then append station
      if (!badgeGroups[orderData.badgeNo]) {
        badgeGroups[orderData.badgeNo] = `
          <p style="margin-top: 20px;">
            <b><u>Pick Up: ${rack.rackName} ${rack.rackLocation} Terminal - ${supplier.supplierName} Badge (${orderData.badgeNo})</u></b>
          </p>
        `;
      }
      badgeGroups[orderData.badgeNo] += stationHtml;

      // Add to Attachments
      attachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `Fuel Order Form ${orderData.poNumber} ${station.fuelCustomerName} ${formattedDate}.pdf`,
        contentType: "application/pdf",
        contentBytes: orderData.pdfBase64
      });
    }

    // 3. Construct Final Email Body
    const combinedCustomerNames = [...new Set(orders.map(o => o.customerName))].join('/');
    const emailStationSections = Object.values(badgeGroups).join(''); // Joins all badge blocks

    const emailBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Hello Team,</p>
        <p>Here is our load for ${combinedCustomerNames} ${formattedDate}</p>
        ${emailStationSections}
        <p style="margin-top: 20px;">Let me know if you have any questions.</p>
      </div>
    `;

    // 4. Push to Microsoft Graph (Rest of logic remains same)
    const draftPayload = {
      subject: `${formattedDate} ${combinedCustomerNames} Load`,
      body: { contentType: "HTML", content: emailBody },
      toRecipients: (carrier.toEmails || []).map(email => ({ emailAddress: { address: email } })),
      ccRecipients: [
        ...(carrier.ccEmails || []).map(email => ({ emailAddress: { address: email } })),
        ...["brian@gen7fuel.com", "nmiller@gen7fuel.com", "ryan@gen7fuel.com", "nsporders@nspetroleum.ca"].map(email => ({ emailAddress: { address: email } }))
      ],
      attachments: attachments
    };

    // ... MSAL Authentication and POST to Graph ...
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

    const targetMailbox = "nsporders@nspetroleum.ca"; // Production
    // const targetMailbox = "daksh@gen7fuel.com"; // testing
    await client.api(`/users/${targetMailbox}/mailFolders/drafts/messages`).post(draftPayload);

    res.status(201).json({
      message: "Order(s) created and grouped email draft pushed.",
      orders: savedOrders,
      pushedTo: targetMailbox
    });

  } catch (err) {
    console.error("Workflow Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// router.post('/', async (req, res) => {
//   try {
//     const {
//       rackId, supplierId, carrierId,
//       orderDate, deliveryDate,
//       startTime, endTime, badgeNo,
//       isSplit, orders // Array of { stationId, items, poNumber, pdfBase64, customerName }
//     } = req.body;

//     const GRADE_ORDER = ["Regular", "Premium", "Diesel", "Dyed Diesel"];

//     // 1. Duplicate & Logistics Check
//     const poNumbers = orders.map(o => o.poNumber);
//     const existing = await FuelOrder.findOne({ poNumber: { $in: poNumbers } });
//     if (existing) return res.status(400).json({ message: `Duplicate PO: ${existing.poNumber}` });

//     const [rack, supplier, carrier] = await Promise.all([
//       FuelRack.findById(rackId).lean(),
//       FuelSupplier.findById(supplierId).lean(),
//       FuelCarrier.findById(carrierId).lean()
//     ]);

//     // 2. Save Orders and build Email Body sections
//     let emailStationSections = "";
//     let attachments = [];
//     let savedOrders = [];
//     const formattedDate = formatPDFDate(deliveryDate, false);

//     for (const orderData of orders) {
//       const station = await Location.findById(orderData.stationId).lean();

//       const tz = station?.timezone || 'America/Toronto';

//       // Use moment-timezone to pin delivery to the station's local start-of-day
//       const stationMidnight = moment.tz(deliveryDate, tz).startOf('day').toDate();

//       // Save to MongoDB
//       const newOrder = new FuelOrder({
//         poNumber: orderData.poNumber,
//         orderDate: new Date(orderDate),
//         originalDeliveryDate: stationMidnight,
//         originalDeliveryWindow: { start: startTime, end: endTime },
//         estimatedDeliveryDate: stationMidnight,
//         estimatedDeliveryWindow: { start: startTime, end: endTime },
//         rack: rackId,
//         supplier: supplierId,
//         badgeNo,
//         carrier: carrierId,
//         station: orderData.stationId,
//         items: orderData.items,
//         currentStatus: "Created",
//         statusHistory: [{ status: "Created", timestamp: new Date() }]
//       });
//       savedOrders.push(await newOrder.save());

//       // Format Grades for this specific station
//       const gradeSummary = orderData.items
//         .filter(i => (i.ltrs || 0) > 0)
//         .sort((a, b) => {
//           const indexA = GRADE_ORDER.indexOf(a.grade);
//           const indexB = GRADE_ORDER.indexOf(b.grade);
//           return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
//         })
//         .map(item => `${(item.ltrs / 1000).toFixed(0)}K ${item.grade}`)
//         .join('<br>');

//       // Add to Email Body String
//       emailStationSections += `
//         <p>
//           <b>${station.stationName}</b><br>
//           ${gradeSummary}<br>
//           <span style="color: red; font-weight: bold;">${orderData.poNumber}</span><br>
//           ${formatEmailTime(startTime, endTime)}
//         </p>
//       `;

//       // Add to Attachments Array
//       attachments.push({
//         "@odata.type": "#microsoft.graph.fileAttachment",
//         name: `Fuel Order Form NSP ${station.fuelCustomerName} ${formattedDate}.pdf`,
//         contentType: "application/pdf",
//         contentBytes: orderData.pdfBase64
//       });
//     }

//     // 3. Build Final Combined Email
//     const combinedCustomerNames = orders.map(o => o.customerName).join('/');
//     const emailBody = `
//       <div style="font-family: Arial, sans-serif; line-height: 1.5;">
//         <p>Hello Team,</p>
//         <p>Here is our load for ${combinedCustomerNames} ${formattedDate}</p>
//         <p>
//           <b><u>Pick Up: ${rack.rackName} ${rack.rackLocation} Terminal - ${supplier.supplierName} Badge (${badgeNo})</u></b>
//         </p>
//         ${emailStationSections}
//         <p>Let me know if you have any questions.</p>
//       </div>
//     `;

//     const draftPayload = {
//       subject: `${formattedDate} ${combinedCustomerNames} Load`,
//       body: { contentType: "HTML", content: emailBody },
//       toRecipients: (carrier.toEmails || []).map(email => ({ emailAddress: { address: email } })),
//       ccRecipients: [
//         ...(carrier.ccEmails || []).map(email => ({ emailAddress: { address: email } })),
//         ...["kellie@gen7fuel.com", "nmiller@gen7fuel.com", "ryan@gen7fuel.com"].map(email => ({ emailAddress: { address: email } }))
//       ],
//       attachments: attachments
//     };

//     // 4. Push to Microsoft Graph
//     const msalConfig = {
//       auth: {
//         clientId: process.env.AZURE_CLIENT_ID,
//         authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
//         clientSecret: process.env.AZURE_CLIENT_SECRET,
//       }
//     };
//     const cca = new ConfidentialClientApplication(msalConfig);
//     const authRes = await cca.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
//     const client = Client.init({ authProvider: (done) => done(null, authRes.accessToken) });

//     // const targetMailbox = "nsporders@nspetroleum.ca";
//     const targetMailbox = "daksh@gen7fuel.com"; //only for testing
//     await client.api(`/users/${targetMailbox}/mailFolders/drafts/messages`).post(draftPayload);

//     res.status(201).json({
//       message: "Order(s) created and email draft pushed.",
//       orders: savedOrders,
//       pushedTo: targetMailbox
//     });

//   } catch (err) {
//     console.error("Workflow Error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });


router.get('/notify-upcoming', async (req, res) => {
  try {
    const count = await processUpcomingOrderNotifications();
    res.status(200).json({ message: `Queued ${count} notifications.` });
  } catch (error) {
    console.error("Notification Error:", error);
    res.status(500).json({ error: "Failed to queue notifications." });
  }
});


// router.put('/:id', ...)
router.put('/:id', async (req, res) => {
  try {
    const {
      estimatedDeliveryDate,
      estimatedDeliveryWindow,
      items,
      currentStatus,
      // NEW FIELDS
      rack,
      supplier,
      badgeNo,
      carrier
    } = req.body;

    const order = await FuelOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Existing Date Logic...
    if (estimatedDeliveryDate) {
      const station = await Location.findById(order.station).lean();
      const tz = station?.timezone || 'America/Toronto';
      order.estimatedDeliveryDate = moment.tz(estimatedDeliveryDate, tz).startOf('day').toDate();
    }

    // Update Metadata if provided
    if (rack) order.rack = rack;
    if (supplier) order.supplier = supplier;
    if (badgeNo) order.badgeNo = badgeNo;
    if (carrier) order.carrier = carrier; // Even if view-only in UI, keep it here for safety

    if (estimatedDeliveryWindow) order.estimatedDeliveryWindow = estimatedDeliveryWindow;
    if (items) order.items = items;

    // Status History logic...
    if (currentStatus && currentStatus !== order.currentStatus) {
      order.currentStatus = currentStatus;
      order.statusHistory.push({ status: currentStatus, timestamp: new Date() });
    }

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// router.put('/:id', async (req, res) => {
//   try {
//     const { estimatedDeliveryDate, estimatedDeliveryWindow, items, currentStatus } = req.body;

//     const order = await FuelOrder.findById(req.params.id);
//     if (!order) return res.status(404).json({ message: "Order not found" });

//     if (estimatedDeliveryDate) {
//       // Fetch the location to get the station's timezone
//       const station = await Location.findById(order.station).lean();
//       const tz = station?.timezone || 'America/Toronto';

//       // Force the date to be the START of the day in that timezone, then save
//       order.estimatedDeliveryDate = moment.tz(estimatedDeliveryDate, tz).startOf('day').toDate();
//     }

//     if (estimatedDeliveryWindow) order.estimatedDeliveryWindow = estimatedDeliveryWindow;
//     if (items) order.items = items;

//     if (currentStatus && currentStatus !== order.currentStatus) {
//       order.currentStatus = currentStatus;
//       order.statusHistory.push({
//         status: currentStatus,
//         timestamp: new Date() // Actual timestamp of the update
//       });
//     }

//     await order.save();
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

module.exports = router;
// module.exports = {
//   processUpcomingOrderNotifications
// };