const cron = require("node-cron");
const moment = require("moment-timezone");
const Location = require("../models/Location");
const { CashSummary } = require("../models/CashSummaryNew");
const { parseSftReport } = require("../utils/parseSftReport");

const OFFICE_SFTP_API_BASE = "http://24.50.55.130:5000";

let isCronRunning = false;

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const _fetch =
      typeof fetch !== "undefined"
        ? fetch
        : (await import("node-fetch")).default;
    return await _fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function norm(v) {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Extracts a Date object from filenames containing a 12-digit timestamp: YYYYMMDDHHmm
 */
function extractDateFromName(filename) {
  if (!filename) return null;
  const m = filename.match(/\s(\d{12})\s/);
  if (!m) return null;
  const ts = m[1];
  const y = Number(ts.slice(0, 4));
  const mo = Number(ts.slice(4, 6)) - 1;
  const d = Number(ts.slice(6, 8));
  const h = Number(ts.slice(8, 10));
  const mi = Number(ts.slice(10, 12));
  return new Date(y, mo, d, h, mi);
}

/**
 * Normalizes a given date to midnight (00:00:00) in the specified target timezone,
 * returning a standard JS Date representing that exact UTC moment.
 */
function normalizeDateToStoreTimezone(rawDate, timezone = "America/Toronto") {
  const dt = rawDate ? new Date(rawDate) : new Date();
  const validTz = timezone || "America/Toronto";

  // Extract the local calendar date string (YYYY-MM-DD) in the store's timezone
  const dateStr = moment(dt).tz(validTz).format("YYYY-MM-DD");

  // Construct 12:00 AM in that target timezone and convert back to a JS Date
  return moment.tz(dateStr, "YYYY-MM-DD", validTz).toDate();
}

async function syncSftShiftsForSite(site, timezone = "America/Toronto") {
  console.log(
    `[SFT Sync] Starting sync for site: "${site}" (TZ: ${timezone})...`
  );
  try {
    // 1. Fetch file list from SFTP API
    const listUrl = new URL("/api/sftp/receive", OFFICE_SFTP_API_BASE);
    listUrl.searchParams.set("site", site);
    listUrl.searchParams.set("type", "sft");

    const listResp = await fetchWithTimeout(listUrl.toString());
    if (!listResp.ok) {
      console.warn(
        `[SFT Sync] Failed to fetch file list for site "${site}". Status: ${listResp.status}`
      );
      return;
    }

    const { files } = await listResp.json();
    if (!Array.isArray(files) || files.length === 0) {
      console.log(`[SFT Sync] No SFT files found for site "${site}".`);
      return;
    }

    // Extract shifts safely from filenames ending in digits before .sft along with filename date
    const shiftItems = files
      .map((f) => {
        const match = f.name.match(/(\d+)\.sft$/i);
        const parsedDate = extractDateFromName(f.name);
        return match
          ? { shiftNumber: match[1], fileName: f.name, fileDate: parsedDate }
          : null;
      })
      .filter(Boolean);

    console.log(
      `[SFT Sync] Found ${shiftItems.length} valid shift files for site "${site}".`
    );

    for (const { shiftNumber, fileName, fileDate } of shiftItems) {
      const shiftNumStr = String(shiftNumber).trim();

      try {
        // Fetch full file content & metrics
        const detailUrl = new URL(
          `/api/sftp/receive/${encodeURIComponent(shiftNumStr)}`,
          OFFICE_SFTP_API_BASE
        );
        detailUrl.searchParams.set("site", site);
        detailUrl.searchParams.set("type", "sft");

        const detailResp = await fetchWithTimeout(detailUrl.toString());
        if (!detailResp.ok) {
          console.warn(
            `[SFT Sync] Failed to fetch detail for Site: "${site}", Shift #${shiftNumStr}. Status: ${detailResp.status}`
          );
          continue;
        }

        const data = await detailResp.json();
        const content = String(data?.content || "").replace(/^\uFEFF/, "");
        if (!content) {
          console.warn(
            `[SFT Sync] Empty file content for Site: "${site}", Shift #${shiftNumStr}. Skipping.`
          );
          continue;
        }

        const parsed = parseSftReport(content);

        // Rule 1: Skip Empty/Placeholder Shifts (0 AR, 0 Total Sales, 0 Payouts)
        const arTotal = Array.isArray(parsed.arCustomers)
          ? parsed.arCustomers.reduce((sum, c) => sum + (norm(c.paid) || 0), 0)
          : 0;
        const salesTotal = norm(parsed.totalSales) || 0;
        const payoutsTotal = norm(parsed.payouts) || 0;

        if (arTotal === 0 && salesTotal === 0 && payoutsTotal === 0) {
          console.log(
            `[SFT Sync] [SKIP EMPTY SHIFT] Site: "${site}", Shift #${shiftNumStr} | totalSales: ${salesTotal}, arTotal: ${arTotal}, payoutsTotal: ${payoutsTotal}`
          );
          continue;
        }

        // Extract shift date from filename or stationEnd, then normalize to store timezone's 12:00 AM
        const rawShiftDate =
          fileDate ||
          (parsed.stationEnd
            ? new Date(parsed.stationEnd.split(" ")[0])
            : new Date());

        const shiftDate = normalizeDateToStoreTimezone(rawShiftDate, timezone);

        // Rule 2: Exception Check for Chicken Delight & Wavers West (4xxxx)
        const isWaversWest4x =
          site === "Wavers West" && /^4\d{4}$/.test(shiftNumStr);
        const isChickenDelight = Boolean(
          parsed.isChickenDelight || isWaversWest4x
        );

        // Build SFT-only update payload
        const parsedUpdate = {
          site,
          shift_number: shiftNumStr,
          date: shiftDate,
          stationStart: parsed.stationStart,
          stationEnd: parsed.stationEnd,
          isChickenDelight,

          // Financial SFT metrics
          item_sales: norm(parsed.itemSales),
          cpl_bulloch: norm(parsed.dealGroupCplDiscounts),
          report_canadian_cash: norm(parsed.canadianCash),
          payouts: norm(parsed.payouts),
          fuelSales: norm(parsed.fuelSales),
          companyCoupon: norm(parsed.companyCoupon),
          dealGroupCplDiscounts: norm(parsed.dealGroupCplDiscounts),
          fuelPriceOverrides: norm(parsed.fuelPriceOverrides),
          parsedItemSales: norm(parsed.itemSales),
          depositTotal: norm(parsed.depositTotal),
          gst: norm(parsed.gst),
          pst: norm(parsed.pst),
          pennyRounding: norm(parsed.pennyRounding),
          totalSales: salesTotal,
          afdCredit: norm(parsed.afdCredit),
          afdDebit: norm(parsed.afdDebit),
          kioskCredit: norm(parsed.kioskCredit),
          kioskDebit: norm(parsed.kioskDebit),
          afdGiftCard: norm(parsed.afdGiftCard),
          kioskGiftCard: norm(parsed.kioskGiftCard),
          totalPos: norm(parsed.totalPos),
          arIncurred: norm(parsed.arIncurred),
          grandTotal: norm(parsed.grandTotal),
          missedCpl: norm(parsed.missedCpl),
          couponsAccepted: norm(parsed.couponsAccepted),
          giftCertificates: norm(parsed.giftCertificates),
          cashOffCoupons: norm(parsed.cashOffCoupons),
          gasolineCoupons: norm(parsed.gasolineCoupons),
          otherCoupons: norm(parsed.otherCoupons),
          canadianCash: norm((parsed.canadianCash || 0) + (parsed.usCash || 0)),
          cashOnHand: norm(parsed.cashOnHand),
          parsedCashBack: norm(parsed.cashBack),
          parsedPayouts: norm(parsed.payouts),
          safedropsCount: norm(parsed.safedrops?.count),
          safedropsAmount: norm(parsed.safedrops?.amount),
          voidedTransactionsAmount: norm(parsed.voidedTransactionsAmount),
          voidedTransactionsCount: norm(parsed.voidedTransactionsCount),
          lottoPayout: norm(parsed.lottoPayout),
          onlineLottoTotal: norm(parsed.onlineLottoTotal),
          instantLottTotal: norm(parsed.instantLottTotal),
          dataWave: norm(parsed.dataWave),
          feeDataWave: norm(parsed.feeDataWave),
          unsettledPrepays: norm(parsed.unsettledPrepays),
          propaneSales: norm(parsed.propaneSales),
          bingoSales: norm(parsed.bingoSales),
          tobaccoCig: norm(parsed.tobaccoCig),
          tobaccoOthers: norm(parsed.tobaccoOthers),

          fuelGrades: parsed.fuelGrades
            ? Object.entries(parsed.fuelGrades).map(([grade, d]) => ({
                grade,
                volume: norm(d.volume),
                amount: norm(d.amount),
              }))
            : [],
          arCustomers: Array.isArray(parsed.arCustomers)
            ? parsed.arCustomers.map((c) => ({
                name: c.name,
                incurred: norm(c.incurred),
                paid: norm(c.paid),
              }))
            : [],
        };

        // Rule 3: Only Append Parsed Tenders if NOT a Chicken Delight Shift
        if (!isChickenDelight) {
          parsedUpdate.tenders = [
            { key: "debit", value: norm(parsed.debit) },
            { key: "visa", value: norm(parsed.visa) },
            { key: "mastercard", value: norm(parsed.mastercard) },
            { key: "amex", value: norm(parsed.amex) },
          ];
        }

        // Upsert targeting site, shift_number, AND date to match unique index constraints
        await CashSummary.findOneAndUpdate(
          { site, shift_number: shiftNumStr, date: shiftDate },
          {
            $set: parsedUpdate,
            $setOnInsert: { reviewed: false },
          },
          { upsert: true, new: true }
        );

        console.log(
          `[SFT Sync] [UPSERT SUCCESS] Site: "${site}", Shift #${shiftNumStr} | totalSales: $${salesTotal} | Date: ${shiftDate.toISOString()}`
        );
      } catch (shiftErr) {
        console.error(
          `[SFT Sync Error] Failed processing Shift #${shiftNumStr} for Site "${site}":`,
          shiftErr
        );
      }
    }
  } catch (err) {
    console.error(`[SFT Sync Error] Failed for site "${site}":`, err);
  }
}

const runSftIngestionCron = async () => {
  if (isCronRunning) {
    console.warn(
      "[SFT Ingestion Cron] Previous job execution is still in progress. Skipping..."
    );
    return;
  }

  isCronRunning = true;
  console.log("[SFT Ingestion Cron] Starting execution...");

  try {
    const locations = await Location.find(
      { type: "store" },
      "stationName timezone"
    ).lean();

    for (const loc of locations) {
      if (loc.stationName) {
        await syncSftShiftsForSite(loc.stationName, loc.timezone);
      }
    }
  } catch (err) {
    console.error("[SFT Ingestion Cron Execution Error]:", err);
  } finally {
    isCronRunning = false;
    console.log("[SFT Ingestion Cron] Completed execution.");
  }
};

// Scheduled every 3 hours at 2:00 AM, 5:00 AM, 8:00 AM, 11:00 AM, 2:00 PM, 5:00 PM, 8:00 PM, and 11:00 PM EST
cron.schedule(
  "0 2,5,8,11,14,17,20,23 * * *",
  () => {
    console.log("Triggering SFT ingestion cron job...");
    runSftIngestionCron();
  },
  {
    scheduled: true,
    timezone: "America/Toronto",
  }
);

module.exports = { runSftIngestionCron };