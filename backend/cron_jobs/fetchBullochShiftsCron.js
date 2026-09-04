const cron = require("node-cron");
const moment = require("moment-timezone");
const Location = require("../models/Location");
const { CashSummary } = require("../models/CashSummaryNew");
const { parseSftReport } = require("../utils/parseSftReport");

// Adjust this to your central Office SFTP Sync API server base URL
const OFFICE_SFTP_API_BASE = "http://24.50.55.130:5000";

// Re-entrancy guard
let isCronRunning = false;

/**
 * Helper to do fetch with an AbortSignal timeout so network hangs don't stall the cron forever.
 */
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

/** Helper to convert empty string or invalid numbers to undefined */
function norm(v) {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Extracts a Date object from SFT filenames formatted like:
 * "SFT 202602181530 00000000000 0000021678.sft" -> 2026-02-18 15:30
 */
function extractDateFromName(filename) {
  if (!filename) return null;
  const m = filename.match(/\s(\d{12})\s/);
  if (!m) return null;
  const ts = m[1];
  const y = Number(ts.slice(0, 4));
  const mo = Number(ts.slice(4, 6)) - 1; // JS months are 0-indexed
  const d = Number(ts.slice(6, 8));
  const h = Number(ts.slice(8, 10));
  const mi = Number(ts.slice(10, 12));
  return new Date(y, mo, d, h, mi);
}

/**
 * Normalizes a JavaScript Date object (or date string) to a midnight Date object
 * corresponding to the specified store timezone (defaulting to America/Toronto).
 */
function normalizeDateToStoreTimezone(rawDate, timezone = "America/Toronto") {
  const dt = rawDate ? new Date(rawDate) : new Date();
  const validTz = timezone || "America/Toronto";

  // Format as YYYY-MM-DD in the target timezone
  const dateStr = moment(dt).tz(validTz).format("YYYY-MM-DD");

  // Re-parse back into a Date at midnight in that timezone
  return moment.tz(dateStr, "YYYY-MM-DD", validTz).toDate();
}

/**
 * Syncs SFT shifts for a single site/station.
 */
async function syncSftShiftsForSite(site, timezone = "America/Toronto") {
  console.log(
    `[SFT Sync] Starting sync for site: "${site}" (TZ: ${timezone})...`
  );
  try {
    // 1. Fetch file list for this site from Central SFTP API
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

    // --- 7-DAY CUTOFF FILTER ---
    const sevenDaysAgo = moment()
      .tz(timezone)
      .subtract(7, "days")
      .startOf("day")
      .toDate();

    // 2. Extract shift numbers and dates, then filter out files older than 7 days
    const shiftItems = files
      .map((f) => {
        const match = f.name.match(/(\d+)\.sft$/i);
        const parsedDate = extractDateFromName(f.name);
        return match
          ? { shiftNumber: match[1], fileName: f.name, fileDate: parsedDate }
          : null;
      })
      .filter((item) => {
        if (!item) return false;
        // Keep file ONLY if date is available and within the last 7 days
        return item.fileDate && item.fileDate >= sevenDaysAgo;
      });

    console.log(
      `[SFT Sync] Found ${shiftItems.length} valid shift files within the last 7 days for site "${site}".`
    );

    // 3. Process each filtered shift item sequentially
    for (const { shiftNumber, fileName, fileDate } of shiftItems) {
      const shiftNumStr = String(shiftNumber).trim();

      try {
        // Fetch raw file content via central endpoint
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
        const content = String(data?.content || "").replace(/^\uFEFF/, ""); // Strip BOM if present
        if (!content) {
          console.warn(
            `[SFT Sync] Empty file content for Site: "${site}", Shift #${shiftNumStr}. Skipping.`
          );
          continue;
        }

        // Parse SFT report content using utility
        const parsed = parseSftReport(content);

        // --- EMPTY SHIFT CHECK ---
        // Calculate AR paid total
        const arTotal = Array.isArray(parsed.arCustomers)
          ? parsed.arCustomers.reduce((sum, c) => sum + (norm(c.paid) || 0), 0)
          : 0;
        const salesTotal = norm(parsed.totalSales) || 0;
        const payoutsTotal = norm(parsed.payouts) || 0;

        // Skip saving if sales, payouts, and AR collections are all 0
        if (arTotal === 0 && salesTotal === 0 && payoutsTotal === 0) {
          console.log(
            `[SFT Sync] [SKIP EMPTY SHIFT] Site: "${site}", Shift #${shiftNumStr} | totalSales: ${salesTotal}, arTotal: ${arTotal}, payoutsTotal: ${payoutsTotal}`
          );
          continue;
        }

        // Determine shift date: precedence filename date > parsed stationEnd > current date
        const rawShiftDate =
          fileDate ||
          (parsed.stationEnd
            ? new Date(parsed.stationEnd.split(" ")[0])
            : new Date());

        const shiftDate = normalizeDateToStoreTimezone(rawShiftDate, timezone);

        // Check for specific brand variations (e.g., Chicken Delight / Wavers West)
        const isWaversWest4x =
          site === "Wavers West" && /^4\d{4}$/.test(shiftNumStr);
        const isChickenDelight = Boolean(
          parsed.isChickenDelight || isWaversWest4x
        );

        // Construct CashSummary document update mapping
        const parsedUpdate = {
          site,
          shift_number: shiftNumStr,
          date: shiftDate,
          stationStart: parsed.stationStart,
          stationEnd: parsed.stationEnd,
          isChickenDelight,

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

        // Attach tenders array if not Chicken Delight
        if (!isChickenDelight) {
          parsedUpdate.tenders = [
            { key: "debit", value: norm(parsed.debit) },
            { key: "visa", value: norm(parsed.visa) },
            { key: "mastercard", value: norm(parsed.mastercard) },
            { key: "amex", value: norm(parsed.amex) },
          ];
        }

        // Upsert into CashSummary collection
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

/**
 * Main cron function iterating across all store locations.
 */
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

// Schedule cron to run at 2, 5, 8, 11, 14, 17, 20, 23 hours every day
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