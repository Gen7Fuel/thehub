import { getPg } from "../config/pg.js"; 
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// 3. Now all of your existing require paths will work perfectly without crashing!
const Location = require("../models/Location");
const User = require("../models/User");
const { gasBuddyQueue } = require("../queues/gasBuddyQueue"); 
const { emailQueue } = require("../queues/emailQueue");
const { priceTimeoutQueue } = require("../queues/priceTimeoutQueue");
const currentPriceModel = require("../pg/models/fuelCurrentPrice");
const logsModel = require("../pg/models/fuelPriceLog");


// --- GLOBAL ROUTE EXCEPTIONS CONFIGURATION ---
// Add the specific location IDs (Mongo ID strings) that do not possess physical InfoNet terminal layers
export const SITES_WITHOUT_INFONET = ["687aa45d0d4d01e74f0b0e9e"];

// Bi-directional dictionary to map Frontend Short Codes <-> Database Strings
export const GRADE_MAP = {
  REG: "Regular",
  MID: "Mid Grade",
  PNL: "Premium",
  DSL: "Diesel",
  DYED: "Dyed Diesel",
};

export async function executeRetailPriceUpdate({
  locationId,
  stationName,
  prices,
  postedByUserIdStr,
  userEmail,
  appIo,
}) {
  const db = getPg();
  const now = new Date();
  const dateSK = parseInt(
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`,
    10,
  );
  const currentDayName = now.toLocaleDateString("en-US", { weekday: "long" });

  const locationDoc = await Location.findById(locationId);
  if (!locationDoc) throw new Error("Target location context not found.");

  const hasInfonet = !SITES_WITHOUT_INFONET.includes(locationId);
  const criticalEmails = [
    locationDoc.email,
    ...(locationDoc.managerEmails || []),
  ].filter(Boolean);
  const targetedUsers = await User.find(
    { email: { $in: criticalEmails } },
    "_id email",
  );
  const uniqueUserIds = targetedUsers.map((u) => String(u._id));

  // Retrieve current records
  const existingRows =
    await currentPriceModel.getCurrentPricesBySite(locationId);
  const changedGradesList = [];
  const unchangedGradesList = [];
  let databaseWritesExecutedCount = 0;

  const masterFrontendCodes = Object.keys(GRADE_MAP);

  await db.transaction(async (trx) => {
    for (const frontendCode of masterFrontendCodes) {
      const correspondingDbGradeName = GRADE_MAP[frontendCode];
      const matchingDbRow = existingRows.find(
        (row) =>
          String(row.grade).trim() === String(correspondingDbGradeName).trim(),
      );

      const hasValidPriceRecord =
        matchingDbRow &&
        matchingDbRow.price !== null &&
        matchingDbRow.price !== undefined;
      const currentDbPrice = hasValidPriceRecord
        ? parseFloat(matchingDbRow.price)
        : 0;
      const isNewRecordForSite = !hasValidPriceRecord;
      const targetPriceRaw = prices[frontendCode];

      if (
        (targetPriceRaw === undefined || targetPriceRaw === null) &&
        isNewRecordForSite
      ) {
        continue;
      }

      const parsedTargetPrice =
        targetPriceRaw !== undefined && targetPriceRaw !== null
          ? parseFloat(targetPriceRaw)
          : currentDbPrice;

      const itemStatePayload = {
        gradeId: frontendCode,
        label: correspondingDbGradeName,
        oldPrice: isNewRecordForSite ? null : currentDbPrice,
        newPrice: parsedTargetPrice,
      };

      if (!isNewRecordForSite && currentDbPrice === parsedTargetPrice) {
        unchangedGradesList.push(itemStatePayload);
      } else {
        databaseWritesExecutedCount++;
        changedGradesList.push(itemStatePayload);

        await currentPriceModel.upsertCurrentPrice(
          {
            site: locationId,
            grade: correspondingDbGradeName,
            price: parsedTargetPrice,
            old_price: isNewRecordForSite ? null : currentDbPrice,
            last_updated_by: postedByUserIdStr,
          },
          trx,
        );

        await logsModel.createLog(
          {
            date: dateSK,
            day: currentDayName,
            site: locationId,
            grade: correspondingDbGradeName,
            price: parsedTargetPrice,
            old_price: isNewRecordForSite ? null : currentDbPrice,
            image_url: null,
            infonet_image_url: null,
            posted_by: postedByUserIdStr,
          },
          trx,
        );
      }
    }
  });

  // Background systems (GasBuddy, Email, Sockets)
  try {
    if (locationDoc.gasBuddyStationId) {
      const normalizedPrices = {};
      for (const [feCode, numericPrice] of Object.entries(prices)) {
        if (feCode === "DYED") continue;
        const gasBuddyLabel = GRADE_MAP[feCode];
        if (
          gasBuddyLabel &&
          numericPrice !== undefined &&
          numericPrice !== null
        ) {
          normalizedPrices[gasBuddyLabel] = parseFloat(numericPrice);
        }
      }

      if (Object.keys(normalizedPrices).length > 0) {
        await gasBuddyQueue.add(
          `gasbuddy-sync-${locationId}-${Date.now()}`,
          {
            gasBuddyStationId: locationDoc.gasBuddyStationId,
            stationName,
            prices: normalizedPrices,
          },
          { removeOnComplete: true, removeOnFail: false },
        );
      }
    }
  } catch (err) {
    console.error("Non-blocking operational failure (GasBuddy):", err);
  }

  if (databaseWritesExecutedCount > 0) {
    const storeEmail = locationDoc.email;
    const targetStationName = stationName || locationDoc.stationName;
    const baseCCEmails = Array.isArray(locationDoc.managerEmails)
      ? [
          ...locationDoc.managerEmails,
          "kporter@gen7fuel.com",
          "daksh@gen7fuel.com",
        ]
      : [
            "kporter@gen7fuel.com", 
            "daksh@gen7fuel.com"
        ];
    // 1. Send IMMEDIATE general update alert to store, copying managers & admin
    const initialNoticeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #14532d; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
              🔔 Notice: Fuel Prices Updated
            </h2>
            <p style="color: #166534; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
              New retail prices have just been published for your station location. Please update your system registers immediately.
            </p>
          </div>

          <div style="margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold; width: 120px;">STATION SITE:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">${targetStationName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">STATUS:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #16a34a; font-weight: bold;">Awaiting Bulloch & InfoNet Snapshots</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Please log into the Gen7 Fuel Hub on your station account, finalize the price adjustments on your physical point-of-sale registers, and upload the required Bulloch and InfoNet receipt imagery to complete the audit cycle.
          </p>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Automated operational tracking notification — Gen 7 Fuel Hub System.
            </span>
          </div>
        </div>
      `;
    await emailQueue.add(`immediate-price-notice-${locationId}-${Date.now()}`, {
      to: storeEmail,
      cc: baseCCEmails,
      subject: `Notice: Fuel Prices Updated - ${targetStationName}`,
      html: initialNoticeHtml,
    });

    // -------------------------------------------------------------------------
    // 1. TEMPLATE: 15-Minute Store Reminder Email (Kept your exact style)
    // -------------------------------------------------------------------------
    const storeReminderHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #92400e; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
              ⚠️ Action Required: Complete Fuel Price Update
            </h2>
            <p style="color: #78350f; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
              New retail prices were published for your station 15 minutes ago. This is a friendly reminder to ensure your registers are updated and your confirmation snapshots are uploaded.
            </p>
          </div>

          <div style="margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold; width: 120px;">STATION SITE:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">${targetStationName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">STATUS:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #b45309; font-weight: bold;">Awaiting Bulloch & InfoNet Snapshots</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Please log into the Gen7 Fuel Hub on your station account, and finalize the price adjustments on your registers, and upload the required receipt imagery to resolve this flag.
          </p>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Automated operational tracking reminder — Gen 7 Fuel Hub System.
            </span>
          </div>
        </div>
      `;

    // -------------------------------------------------------------------------
    // 2. TEMPLATE: 30-Minute Admin Escalation Email (Plain & understandable)
    // -------------------------------------------------------------------------
    const adminEscalationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155; line-height: 1.6;">
          <h2 style="color: #dc2626; font-size: 18px; margin-top: 0; font-weight: 800; text-transform: uppercase; tracking-tight">
            🚨 Alert: Price Verification Overdue (30 Mins)
          </h2>

          <p style="font-size: 14px; color: #334155;">
            The pricing change you pushed to <strong>${targetStationName}</strong> remains unverified.
            The store has not uploaded any Bulloch or InfoNet register images to the Hub to complete the fuel price update workflow.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px; margin: 18px 0; font-size: 13px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: bold; width: 110px;">LOCATION:</td>
                <td style="padding: 4px 0; color: #0f172a; font-weight: bold;">${targetStationName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: bold;">ELAPSED TIME:</td>
                <td style="padding: 4px 0; color: #dc2626; font-weight: bold;">30 Minutes</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b; font-weight: bold;">STATUS:</td>
                <td style="padding: 4px 0; color: #475569; font-weight: bold;">Awaiting Register Snapshots</td>
              </tr>
            </table>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 20px;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Automated pricing supervisor log — Gen 7 Fuel Hub Operational Pipeline.
            </span>
          </div>
        </div>
      `;
    // Watchdogs configuration delays
    await priceTimeoutQueue.add(
      `timeout-reminder-${locationId}-${Date.now()}`,
      {
        locationId,
        stationName: targetStationName,
        toEmail: storeEmail,
        ccEmails: baseCCEmails,
        subject: `Reminder: Update Fuel Prices - ${targetStationName}`,
        html: storeReminderHtml,
        hasInfonet,
      },
      { delay: 15 * 60 * 1000, removeOnComplete: true, removeOnFail: true },
    );

    await priceTimeoutQueue.add(
      `timeout-admin-escalation-${locationId}-${Date.now()}`,
      {
        locationId,
        stationName: targetStationName,
        toEmail: userEmail || "Mandy@gen7fuel.com",
        ccEmails: ["kellie@gen7fuel.com", "daksh@gen7fuel.com"],
        // ccEmails: ["daksh@gen7fuel.com"],
        subject: `Alert: Price Verification Overdue - ${targetStationName}`,
        html: adminEscalationHtml,
        hasInfonet,
      },
      { delay: 30 * 60 * 1000, removeOnComplete: true, removeOnFail: true },
    );

    // Marketing compilation blocks
    let marketingRowsHtml = "";

    // Compile changed rows into view engine
    for (const item of changedGradesList) {
      const displayOld =
        item.oldPrice !== null ? `${Number(item.oldPrice).toFixed(4)}¢` : "--";
      marketingRowsHtml += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #1e293b;">${item.label}</td>
            <td style="padding: 12px; font-size: 14px; color: #64748b; text-decoration: line-through;">${displayOld}</td>
            <td style="padding: 12px; font-size: 15px; font-weight: 800; color: #16a34a;">${Number(item.newPrice).toFixed(4)}¢</td>
            <td style="padding: 12px; text-align: right;">
              <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">
                Updated
              </span>
            </td>
          </tr>
        `;
    }

    // Compile unchanged rows into view engine
    for (const item of unchangedGradesList) {
      marketingRowsHtml += `
          <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #64748b;">${item.label}</td>
            <td style="padding: 12px; font-size: 14px; color: #94a3b8;">--</td>
            <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #475569;">${Number(item.newPrice).toFixed(4)}¢</td>
            <td style="padding: 12px; text-align: right;">
              <span style="display: inline-block; background-color: #e2e8f0; color: #475569; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">
                Unchanged
              </span>
            </td>
          </tr>
        `;
    }

    const marketingReportHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 16px; border-radius: 12px 12px 0 0; margin-bottom: 20px;">
            <h3 style="color: #334155; margin: 0 0 4px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              📊 Fuel Price Ledger
            </h3>
            <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 900;">
              ${targetStationName}
            </h2>
          </div>

          <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
            The retail pricing board for this station location has been altered. Here are the comparisons mapping against current vs old prices:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; text-align: left;">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Fuel Grade</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Old Price</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">New Price</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${marketingRowsHtml}
            </tbody>
          </table>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Internal price distribution ledger — Gen 7 Fuel Hub Operational Network.
            </span>
          </div>
        </div>
      `;

    await emailQueue.add(`marketing-price-sync-${locationId}-${Date.now()}`, {
      to: "marketing@gen7fuel.com",
    //   to: "daksh@gen7fuel.com",
      subject: `Fuel Pricing Sync Summary: ${targetStationName}`,
      html: marketingReportHtml,
    });
  }

  if (appIo && uniqueUserIds.length > 0) {
    const socketPayload = {
      stationName,
      locationId,
      changedGrades: changedGradesList,
      unchangedGrades: unchangedGradesList,
      hasStructuralChanges: changedGradesList.length > 0,
      hasInfonet,
    };
    uniqueUserIds.forEach((userId) => {
      appIo.to(userId).emit("retail-price-published", socketPayload);
    });
  }

  return {
    databaseWritesExecutedCount,
    uniqueUserIdsCount: uniqueUserIds.length,
  };
}

// module.exports = { executeRetailPriceUpdate };
