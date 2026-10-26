/**
 * Backfill AFD tender totals and correct regular POS debit values for existing
 * CashSummary shifts. This script intentionally updates only `tenders` and
 * `afdTenders`; no other historical fields are changed.
 *
 * Run from the backend container:
 *   node manual/backfillAfdTenders.js
 */
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CashSummary = require("../models/CashSummaryNew");
const { parseSftReport } = require("../utils/parseSftReport");

const OFFICE_SFTP_API_BASE = "http://24.50.55.130:5000";
const START_DATE = moment.tz("2026-09-01", "YYYY-MM-DD", "America/Toronto").toDate();

function norm(value) {
  if (value === "" || value == null) return 0;
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

async function fetchWithTimeout(url, ms = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const request =
      typeof fetch !== "undefined"
        ? fetch
        : (await import("node-fetch")).default;
    return await request(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getExistingTenderValue(tenders, key) {
  const item = Array.isArray(tenders)
    ? tenders.find((t) => String(t?.key || "").toLowerCase() === key)
    : null;
  return item ? norm(item.value ?? item.amount) : 0;
}

function setTenderValue(tenders, key, value) {
  const next = Array.isArray(tenders)
    ? tenders.map((t) => ({ key: t.key, value: norm(t.value ?? t.amount) }))
    : [];
  const item = next.find((t) => String(t.key || "").toLowerCase() === key);
  if (item) item.value = value;
  else next.push({ key, value });
  return next;
}

async function fetchAndParseShift(site, shiftNumber) {
  const detailUrl = new URL(
    `/api/sftp/receive/${encodeURIComponent(String(shiftNumber))}`,
    OFFICE_SFTP_API_BASE,
  );
  detailUrl.searchParams.set("site", site);
  detailUrl.searchParams.set("type", "sft");

  const response = await fetchWithTimeout(detailUrl.toString());
  if (!response.ok) {
    throw new Error(`SFTP returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = String(data?.content || "").replace(/^\uFEFF/, "");
  if (!content) throw new Error("SFT file content was empty");
  return parseSftReport(content);
}

async function main() {
  await connectDB();
  const shifts = await CashSummary.find(
    { date: { $gte: START_DATE } },
    { site: 1, shift_number: 1, tenders: 1 },
  )
    .sort({ date: 1, site: 1, shift_number: 1 })
    .lean();

  console.log(
    `[AFD Backfill] Found ${shifts.length} existing shifts from ${START_DATE.toISOString().slice(0, 10)} onward.`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const shift of shifts) {
    const site = shift.site;
    const shiftNumber = shift.shift_number;

    try {
      const parsed = await fetchAndParseShift(site, shiftNumber);
      const correctedDebit = norm(parsed.debit) + norm(parsed.kioskDebit);
      const previousDebit = getExistingTenderValue(shift.tenders, "debit");
      const nextTenders = setTenderValue(shift.tenders, "debit", correctedDebit);
      const afd = parsed.afdTenders || {};
      const hasAfdTransactions = [afd.visa, afd.mastercard, afd.amex, parsed.afdDebit, parsed.afdGiftCard]
        .some((value) => value != null && norm(value) !== 0);
      const nextTendersWithGiftCard = setTenderValue(
        nextTenders,
        "giftcards",
        norm(parsed.kioskGiftCard),
      );
      const afdTenders = [
        { key: "debit", value: norm(parsed.afdDebit) },
        { key: "visa", value: norm(afd.visa) },
        { key: "mastercard", value: norm(afd.mastercard) },
        { key: "amex", value: norm(afd.amex) },
        { key: "giftcards", value: norm(parsed.afdGiftCard) },
      ];

      await CashSummary.updateOne(
        { _id: shift._id },
        { $set: { tenders: nextTendersWithGiftCard, afdTenders } },
      );

      updated += 1;
      if (hasAfdTransactions) {
        console.log(
          `[AFD Backfill] ${site} shift ${shiftNumber}: debit ${previousDebit.toFixed(2)} -> ${correctedDebit.toFixed(2)}; added AFD tenders.`,
        );
      } else {
        console.log(
          `[AFD Backfill] ${site} shift ${shiftNumber}: debit ${previousDebit.toFixed(2)} -> ${correctedDebit.toFixed(2)}; no AFD transactions, added zero values.`,
        );
      }
    } catch (error) {
      failed += 1;
      console.error(`[AFD Backfill] ${site} shift ${shiftNumber}: FAILED - ${error.message}`);
    }
  }

  console.log(`[AFD Backfill] Complete. Updated: ${updated}; skipped: ${skipped}; failed: ${failed}.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[AFD Backfill] Fatal error:", error);
  process.exitCode = 1;
});
