const moment = require('moment-timezone');
const FuelOrder = require('../models/Fuel/FuelOrder');
const emailQueue = require('../queues/emailQueue');

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

  const earliestUTC = todayPST.clone().add(1, 'days').startOf('day').utc().toDate();

  const latestUTC = todayPST.clone().add(3, 'days').endOf('day').utc().toDate();

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
   * 5. BUILD EMAIL HTML
   * ------------------------------------------------------------
   */

  let html = `
    <h2>Upcoming Fuel Deliveries</h2>
    <p>
      This notification includes deliveries scheduled for:
      <b>${tomorrowStr}</b> and <b>${dayAfterStr}</b>
    </p>
    <hr/>
  `;

  const sortedDates = Object.keys(grouped).sort();

  for (const date of sortedDates) {

    html += `
      <h2 style="margin-top:30px;">
        Delivery Date: ${date}
      </h2>
    `;

    const stations = grouped[date];

    for (const stationName of Object.keys(stations).sort()) {

      html += `
        <h3 style="margin-top:20px;">
          Station: ${stationName}
        </h3>
      `;

      for (const order of stations[stationName]) {

        const itemsHtml = order.items
          .map(i => `
            <li>
              ${i.grade}: ${i.ltrs.toLocaleString()} L
            </li>
          `)
          .join('');

        html += `
          <div style="
            border:1px solid #ddd;
            border-radius:8px;
            padding:12px;
            margin-bottom:16px;
          ">
            <p><b>PO Number:</b> ${order.poNumber}</p>

            <p>
              <b>Window:</b>
              ${order.estimatedDeliveryWindow?.start || '-'}
              -
              ${order.estimatedDeliveryWindow?.end || '-'}
            </p>

            <p><b>Supplier:</b> ${order.supplier?.supplierName || '-'}</p>

            <p>
              <b>Rack:</b>
              ${order.rack?.rackName || '-'}
              (${order.rack?.rackLocation || '-'})
            </p>

            <p><b>Carrier:</b> ${order.carrier?.carrierName || '-'}</p>

            <p><b>Order Details:</b></p>

            <ul>
              ${itemsHtml}
            </ul>
          </div>
        `;
      }
    }
  }

  /**
   * ------------------------------------------------------------
   * 6. SEND EMAIL
   * ------------------------------------------------------------
   */

  const emailData = {
    to: ['daksh@gen7fuel.com'],
    cc: ['daksh@gen7fuel.com'],
    subject: `Upcoming Fuel Deliveries - ${tomorrowStr} & ${dayAfterStr}`,
    html
  };

  await emailQueue.add(
    "sendFuelOrderNotification",
    emailData
  );

  return orders.length;
}

module.exports = {
  processUpcomingOrderNotifications
};