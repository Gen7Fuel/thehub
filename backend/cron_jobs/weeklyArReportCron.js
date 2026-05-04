const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { DateTime } = require("luxon");
const { emailQueue } = require("../queues/emailQueue");
const { KardpollReport } = require("../models/CashRec");
const { generateArTransactionPdf } = require("../utils/arTransactionPdf");

const SITES = ["Oliver", "Osoyoos"];
const RECIPIENT = "mario@gen7fuel.com";
const TIMEZONE = "America/Vancouver";

function formatCurrency(n) {
  return `$${Number(n).toFixed(2)}`;
}

function formatDate(isoStr) {
  // YYYY-MM-DD → Mon DD, YYYY
  return DateTime.fromISO(isoStr, { zone: TIMEZONE }).toFormat("LLL dd, yyyy");
}

function createZip(filePaths, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(outputPath));
    archive.on("error", reject);
    archive.pipe(output);
    for (const fp of filePaths) {
      archive.file(fp, { name: path.basename(fp) });
    }
    archive.finalize();
  });
}

function buildSiteTable(site, transactions) {
  if (!transactions.length) {
    return `<h2 style="font-family:Arial,sans-serif;color:#333;">${site}</h2>
<p style="font-family:Arial,sans-serif;color:#666;">No AR transactions for this period.</p>`;
  }

  const rows = transactions
    .map(
      ({ date, customer, card, quantity, price_per_litre, amount }) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #ddd;">${formatDate(date)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;">${customer}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;">****${String(card).slice(-4)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${Number(quantity).toFixed(3)} L</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">$${Number(price_per_litre).toFixed(3)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${formatCurrency(amount)}</td>
      </tr>`
    )
    .join("");

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return `
<h2 style="font-family:Arial,sans-serif;color:#333;margin-top:30px;">${site}</h2>
<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
  <thead>
    <tr style="background-color:#2c5f2e;color:#fff;">
      <th style="padding:8px 10px;border:1px solid #2c5f2e;text-align:left;">Date</th>
      <th style="padding:8px 10px;border:1px solid #2c5f2e;text-align:left;">Customer</th>
      <th style="padding:8px 10px;border:1px solid #2c5f2e;text-align:left;">Card</th>
      <th style="padding:8px 10px;border:1px solid #2c5f2e;text-align:right;">Quantity</th>
      <th style="padding:8px 10px;border:1px solid #2c5f2e;text-align:right;">Price/L</th>
      <th style="padding:8px 10px;border:1px solid #2c5f2e;text-align:right;">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
  <tfoot>
    <tr style="background-color:#f2f2f2;font-weight:bold;">
      <td colspan="5" style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Total</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${formatCurrency(total)}</td>
    </tr>
  </tfoot>
</table>`;
}

async function sendWeeklyArReport() {
  // On Tuesday: last Monday = today - 8 days, last Sunday = today - 2 days
  const today = DateTime.now().setZone(TIMEZONE).startOf("day");
  const startDate = today.minus({ days: 8 }).toISODate(); // last Monday
  const endDate = today.minus({ days: 2 }).toISODate();   // last Sunday
  const rangeLabel = `${startDate}_to_${endDate}`;

  const allPdfPaths = [];
  const zipPaths = [];
  const siteHtmlBlocks = [];

  for (const site of SITES) {
    const docs = await KardpollReport.find({
      site,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    // Flatten ar_rows and attach the date from the parent document
    const transactions = docs.flatMap((doc) =>
      (doc.ar_rows || []).map((row) => ({ ...row, date: doc.date }))
    );

    // Generate a PDF for each transaction
    const sitePdfPaths = [];
    for (const txn of transactions) {
      const pdfPath = await generateArTransactionPdf(txn, txn.date, site);
      sitePdfPaths.push(pdfPath);
    }
    allPdfPaths.push(...sitePdfPaths);

    // Build ZIP for this site (even if empty, still attach an empty zip)
    const zipPath = `/tmp/AR_${site}_${rangeLabel}.zip`;
    if (sitePdfPaths.length > 0) {
      await createZip(sitePdfPaths, zipPath);
    } else {
      // Create an empty zip so the attachment is always present
      await createZip([], zipPath);
    }
    zipPaths.push({ site, zipPath, filename: `AR_${site}_${rangeLabel}.zip` });

    siteHtmlBlocks.push(buildSiteTable(site, transactions));
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:900px;margin:0 auto;padding:20px;">
  <h1 style="color:#2c5f2e;">Weekly AR Report</h1>
  <p style="color:#666;">Period: <strong>${formatDate(startDate)}</strong> to <strong>${formatDate(endDate)}</strong></p>
  <hr style="border:none;border-top:2px solid #2c5f2e;margin:20px 0;">
  ${siteHtmlBlocks.join("\n")}
  <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
  <p style="font-size:11px;color:#999;">This is an automated report. PDFs for each transaction are attached in the ZIP files.</p>
</body>
</html>`;

  await emailQueue.add("sendWeeklyArReport", {
    to: RECIPIENT,
    cc: ["mohammad@gen7fuel.com"],
    subject: `Weekly AR Report – ${startDate} to ${endDate}`,
    html: htmlBody,
    attachments: zipPaths.map(({ filename, zipPath }) => ({
      filename,
      path: zipPath,
    })),
  });

  // Clean up temp PDFs (zip files will be cleaned up by the OS or next run)
  for (const p of allPdfPaths) {
    fs.unlink(p, () => {});
  }

  console.log(`[weeklyArReportCron] Queued AR report for ${startDate} to ${endDate}`);
}

cron.schedule(
  "0 9 * * 2",
  async () => {
    if (process.env.HOST !== "VPS") return;
    try {
      await sendWeeklyArReport();
    } catch (err) {
      console.error("[weeklyArReportCron] Error:", err);
    }
  },
  { scheduled: true, timezone: TIMEZONE }
);

module.exports = { sendWeeklyArReport };
