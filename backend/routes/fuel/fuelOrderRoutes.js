const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelOrder = require('../../models/fuel/FuelOrder');
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelSupplier = require('../../models/fuel/FuelSupplier');
const FuelRack = require('../../models/fuel/FuelRack');
const { emailQueue } = require('../../queues/emailQueue');
const { fuelOrderDraftQueue } = require('../../queues/fuelOrderDraftQueue');
const moment = require('moment-timezone');
const { logChange } = require('../../middleware/changeLogger');
// const { processUpcomingOrderNotifications } = require('../../cron_jobs/fuelOrderEODCron');

function buildRetainComment(retainItems) {
  if (!Array.isArray(retainItems)) return '';

  const lines = retainItems
    .map((item) => ({
      grade: String(item?.grade || '').trim(),
      ltrs: Number(item?.ltrs || 0),
    }))
    .filter((item) => item.grade && Number.isFinite(item.ltrs) && item.ltrs > 0)
    .map((item) => `${item.grade}: ${item.ltrs.toLocaleString('en-US')} L`);

  if (!lines.length) return '';
  return `Fuel retained:\n${lines.join('\n')}`;
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatPODatePart = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
};

const getDateOnly = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

const getStationDisplayName = (station) =>
  station?.fuelCustomerName || station?.stationName || station?.site || 'Station';

const buildRetainQuantityLines = (retainItems) =>
  retainItems
    .map((item) => `${item.grade}: ${Number(item.ltrs || 0).toLocaleString('en-US')} L`)
    .join('\n');

async function getRetainPONumber({ sourceOrder, stationId, orderDate }) {
  const sourceStationId = String(sourceOrder.station?._id || sourceOrder.station || '');

  if (String(stationId) === sourceStationId) {
    return {
      poNumber: `${sourceOrder.poNumber}-RET`,
      orderDate: getDateOnly(sourceOrder.orderDate)
    };
  }

  const station = await Location.findById(stationId).select('fuelStationNumber').lean();
  if (!station) {
    const err = new Error('Retain delivery station not found.');
    err.statusCode = 404;
    throw err;
  }

  const basePoNumber = `NSP${formatPODatePart(orderDate)}-${String(station.fuelStationNumber).padStart(2, '0')}-RET`;
  const retainOrders = await FuelOrder.find({
    poNumber: { $regex: `^${escapeRegex(basePoNumber)}(?:-(\\d+))?$` }
  }).select('poNumber').lean();

  const maxRetainNumber = retainOrders.reduce((max, order) => {
    if (order.poNumber === basePoNumber) return Math.max(max, 1);
    const match = String(order.poNumber || '').match(/-RET-(\d+)$/);
    const retainNumber = match ? Number(match[1]) : 0;
    return Number.isFinite(retainNumber) ? Math.max(max, retainNumber) : max;
  }, 0);

  return {
    poNumber: maxRetainNumber > 0 ? `${basePoNumber}-${maxRetainNumber + 1}` : basePoNumber,
    orderDate
  };
}

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
    cc: ['Ryan@gen7fuel.com', 'valerie@gen7fuel.com', 'nmiller@gen7fuel.com', 'nsporders@nspetroleum.ca'],
    // to: 'daksh@gen7fuel.com', // Testing only
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

router.get('/check-existing', async (req, res) => {
  try {
    const { stationId, orderDate } = req.query; // orderDate is "YYYY-MM-DD"

    // 1. Get the station timezone
    const station = await Location.findById(stationId).select('timezone').lean();
    const tz = station?.timezone || 'America/Toronto';

    // orderDate is saved from a date-only string with new Date(orderDate),
    // which stores it at UTC midnight. Check that canonical UTC date window
    // first, and also include the station-local window for older records that
    // may have been saved with localized timestamps.
    const utcStart = moment.utc(orderDate, 'YYYY-MM-DD').startOf('day').toDate();
    const utcEnd = moment.utc(orderDate, 'YYYY-MM-DD').endOf('day').toDate();
    const localStart = moment.tz(orderDate, tz).startOf('day').toDate();
    const localEnd = moment.tz(orderDate, tz).endOf('day').toDate();

    // console.log(`[DEBUG] Checking existing orders for station ${stationId}`);
    // console.log(`[DEBUG] Timezone: ${tz} | Window: ${start.toISOString()} to ${end.toISOString()}`);

    // 3. Query using the localized UTC window
    const existingOrders = await FuelOrder.find({
      station: stationId,
      $or: [
        { orderDate: { $gte: utcStart, $lte: utcEnd } },
        { orderDate: { $gte: localStart, $lte: localEnd } }
      ]
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

    const GRADE_ORDER = ["Regular", "E15", "Premium", "Diesel", "Dyed Diesel"];

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
        ...["brian@gen7fuel.com", "valerie@gen7fuel.com", "ryan@gen7fuel.com", "nsporders@nspetroleum.ca"].map(email => ({ emailAddress: { address: email } }))
      ],
      attachments: attachments
    };

    const targetMailbox = "nsporders@nspetroleum.ca"; // Production
    // const targetMailbox = "daksh@gen7fuel.com"; // testing
    const draftJob = await fuelOrderDraftQueue.add(
      `fuel-order-draft-${Date.now()}`,
      {
        draftPayload,
        targetMailbox,
        summary: `${formattedDate} ${combinedCustomerNames} Load`,
        poNumbers,
      },
    );

    await logChange(req, {
      action: 'create', resourceType: 'fuel-order',
      resourceIds: savedOrders.map((order) => order._id),
      resourceLabel: poNumbers.join(', '), before: null,
      after: savedOrders.map((order) => order.toObject()),
      success: true, statusCode: 201, source: 'fuel-management.create-order',
      bulk: { count: savedOrders.length },
      message: `${savedOrders.length} fuel order${savedOrders.length === 1 ? '' : 's'} created: ${poNumbers.join(', ')}`,
    });

    res.status(201).json({
      message: "Order(s) created and email draft queued.",
      orders: savedOrders,
      draftQueued: true,
      draftJobId: draftJob.id,
      pushedTo: targetMailbox
    });

  } catch (err) {
    console.error("Workflow Error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/retain-po-number', async (req, res) => {
  try {
    const { sourceOrderId, stationId, orderDate } = req.query;

    if (!sourceOrderId || !stationId || !orderDate) {
      return res.status(400).json({ message: 'Missing retain PO lookup fields.' });
    }

    const sourceOrder = await FuelOrder.findById(sourceOrderId).lean();
    if (!sourceOrder) return res.status(404).json({ message: 'Source order not found.' });

    const result = await getRetainPONumber({ sourceOrder, stationId, orderDate });
    res.json(result);
  } catch (err) {
    console.error('Retain PO lookup failed:', err);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/retain', async (req, res) => {
  try {
    const {
      sourceOrderId,
      stationId,
      poNumber: requestedPoNumber,
      orderDate,
      deliveryDate,
      startTime,
      endTime,
      items,
      deliveredItems
    } = req.body;

    if (!sourceOrderId || !stationId || !orderDate || !deliveryDate || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required retain order fields.' });
    }

    const retainItems = Array.isArray(items)
      ? items
          .map((item) => ({
            grade: String(item?.grade || '').trim(),
            ltrs: Number(item?.ltrs || 0)
          }))
          .filter((item) => item.grade && Number.isFinite(item.ltrs) && item.ltrs > 0)
      : [];

    if (!retainItems.length) {
      return res.status(400).json({ message: 'Retain order must include at least one fuel quantity.' });
    }

    const actualDeliveredItems = Array.isArray(deliveredItems)
      ? deliveredItems
          .map((item) => ({
            grade: String(item?.grade || '').trim(),
            ltrs: Math.max(0, Number(item?.ltrs || 0))
          }))
          .filter((item) => item.grade && Number.isFinite(item.ltrs))
      : null;

    const [sourceOrder, station, targetStation] = await Promise.all([
      FuelOrder.findById(sourceOrderId),
      Location.findById(stationId).select('timezone fuelCustomerName stationName site').lean(),
      Location.findById(stationId).select('fuelCustomerName stationName site').lean()
    ]);

    if (!sourceOrder) return res.status(404).json({ message: 'Source order not found.' });
    if (!station) return res.status(404).json({ message: 'Retain delivery station not found.' });

    const sourceStation = await Location.findById(sourceOrder.station)
      .select('fuelCustomerName stationName site')
      .lean();
    const retainPoData = await getRetainPONumber({
      sourceOrder,
      stationId,
      orderDate
    });
    const poNumber = String(requestedPoNumber || retainPoData.poNumber).trim();
    const retainOrderDate = retainPoData.orderDate;

    if (!poNumber) {
      return res.status(400).json({ message: 'Retain PO number is required.' });
    }

    const existing = await FuelOrder.findOne({ poNumber });
    if (existing) return res.status(400).json({ message: `Duplicate PO: ${existing.poNumber}` });

    const tz = station?.timezone || 'America/Toronto';
    const stationMidnight = moment.tz(deliveryDate, tz).startOf('day').toDate();
    const authorName = req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'System User';
    const quantityLines = buildRetainQuantityLines(retainItems);
    const targetStationName = getStationDisplayName(targetStation);
    const sourceStationName = getStationDisplayName(sourceStation);

    const retainOrder = new FuelOrder({
      poNumber,
      orderDate: new Date(retainOrderDate),
      originalDeliveryDate: stationMidnight,
      originalDeliveryWindow: { start: startTime, end: endTime },
      estimatedDeliveryDate: stationMidnight,
      estimatedDeliveryWindow: { start: startTime, end: endTime },
      rack: sourceOrder.rack,
      supplier: sourceOrder.supplier,
      badgeNo: sourceOrder.badgeNo,
      carrier: sourceOrder.carrier,
      station: stationId,
      items: retainItems,
      currentStatus: 'Created',
      statusHistory: [{ status: 'Created', timestamp: new Date() }],
      comments: [{
        text: `Fuel retain order created from ${sourceStationName} (${sourceOrder.poNumber})`,
        author: authorName,
        timestamp: new Date()
      }]
    });

    const sourceBefore = sourceOrder.toObject();
    const savedOrder = await retainOrder.save();
    if (actualDeliveredItems) {
      sourceOrder.items = actualDeliveredItems;
    }
    sourceOrder.currentStatus = 'Delivered';
    sourceOrder.statusHistory.push({ status: 'Delivered', timestamp: new Date() });
    sourceOrder.comments.push({
      text: `Fuel Retain to ${targetStationName} (${poNumber}):\n${quantityLines}`,
      author: authorName,
      timestamp: new Date()
    });
    await sourceOrder.save();

    await logChange(req, {
      action: 'create', resourceType: 'fuel-order', resourceId: savedOrder._id,
      resourceLabel: savedOrder.poNumber, before: null, after: savedOrder.toObject(),
      success: true, statusCode: 201, source: 'fuel-management.workspace',
      message: `Fuel retain order ${savedOrder.poNumber} created from ${sourceOrder.poNumber}`,
    });
    await logChange(req, {
      action: 'update', resourceType: 'fuel-order', resourceId: sourceOrder._id,
      resourceLabel: sourceOrder.poNumber, before: sourceBefore, after: sourceOrder.toObject(),
      success: true, statusCode: 200, source: 'fuel-management.workspace',
      message: `Source fuel order ${sourceOrder.poNumber} updated after retain to ${savedOrder.poNumber}`,
      correlationId: savedOrder._id.toString(),
    });

    res.status(201).json({
      message: 'Retain order created.',
      order: savedOrder
    });
  } catch (err) {
    console.error('Retain order creation failed:', err);
    res.status(500).json({ message: err.message });
  }
});
router.get('/notify-upcoming', async (req, res) => {
  try {
    const count = await processUpcomingOrderNotifications();
    res.status(200).json({ message: `Queued ${count} notifications.` });
  } catch (error) {
    console.error("Notification Error:", error);
    res.status(500).json({ error: "Failed to queue notifications." });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      estimatedDeliveryDate,
      estimatedDeliveryWindow,
      items,
      currentStatus,
      rack,
      supplier,
      badgeNo,
      carrier,
      comment,
      retainItems
    } = req.body;

    const order = await FuelOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const before = order.toObject();

    // Enforce business constraint rule: Cancelled requires a payload comment text block
    if (currentStatus === 'Cancelled' && (!comment || !comment.text.trim())) {
      return res.status(400).json({ message: "A comment reason is strictly required to cancel an order." });
    }

    if (estimatedDeliveryDate) {
      const station = await Location.findById(order.station).lean();
      const tz = station?.timezone || 'America/Toronto';
      order.estimatedDeliveryDate = moment.tz(estimatedDeliveryDate, tz).startOf('day').toDate();
    }

    if (rack) order.rack = rack;
    if (supplier) order.supplier = supplier;
    if (badgeNo) order.badgeNo = badgeNo;
    if (carrier) order.carrier = carrier;

    if (estimatedDeliveryWindow) order.estimatedDeliveryWindow = estimatedDeliveryWindow;
    if (items) order.items = items;

    // Build the author name from the session user middleware context securely
    let authorName = 'System User';
    if (req.user && (req.user.firstName || req.user.lastName)) {
      authorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    }

    // Append standard or reason comments safely to the array history if present
    if (comment && comment.text.trim()) {
      order.comments.push({
        text: comment.text.trim(),
        author: authorName,
        timestamp: new Date()
      });
    }

    const retainComment = buildRetainComment(retainItems);
    if (retainComment) {
      order.comments.push({
        text: retainComment,
        author: authorName,
        timestamp: new Date()
      });
    }

    // Process State Changes
    if (currentStatus && currentStatus !== order.currentStatus) {
      order.currentStatus = currentStatus;
      order.statusHistory.push({ status: currentStatus, timestamp: new Date() });
    }

    await order.save();
    await logChange(req, {
      action: 'update', resourceType: 'fuel-order', resourceId: order._id,
      resourceLabel: order.poNumber, before, after: order.toObject(),
      success: true, statusCode: 200, source: 'fuel-management.workspace',
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
