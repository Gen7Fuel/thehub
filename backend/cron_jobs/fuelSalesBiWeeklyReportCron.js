// backend\cron_jobs\fuelSalesBiWeeklyReportCron.js
const { getFuelSalesRollupReport } = require("../services/sqlService");
const { generateFuelSalesReportPdfBuffer } = require("../utils/fuelSalesReport");
const Location = require("../models/Location");

// Import your existing email queue and base64 helpers 
// (Adjust paths according to your actual folder layout)
const { emailQueue } = require("../queues/emailQueue");
// Change this to target your new standalone utility file
const { attachmentContentToBase64 } = require("../utils/emailHelpers");
/**
 * Main function to generate the bi-weekly report data, transform it,
 * generate the PDF, and queue the email notification.
 */
async function processBiWeeklyFuelReport(csoCode, startDateStr, endDateStr) {
  try {
    // 1. Get location info from MongoDB
    const location = await Location.findOne({ csoCode: csoCode });
    if (!location) {
      console.error(`[Cron Error]: Location details missing for csoCode: ${csoCode}`);
      return;
    }

    // 2. Generate date array loop range (handles inputs like '20260601' to '20260615')
    const start = new Date(startDateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    const end = new Date(endDateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));

    const dateList = [];
    let current = new Date(start);
    while (current <= end) {
      dateList.push(current.toISOString().split('T')[0]); // Output: 'YYYY-MM-DD'
      current.setDate(current.getDate() + 1);
    }

    const detailedRows = [];
    const totals = {
      totalLitres: 0, totalAmount: 0,
      treatyLitres: 0, treatyAmount: 0,
      nonTreatyLitres: 0, nonTreatyAmount: 0,
      taxableNonTreaty: 0, remittableGst: 0
    };

    // 3. Loop through dates and assemble raw query lines into a 10-column schema layout
    for (const date of dateList) {
      const sqlData = await getFuelSalesRollupReport(csoCode, date);

      // Extract raw grades while dropping standard total rollup outputs
      const grades = [...new Set(sqlData
        .filter(r => r.fuel_grade !== 'All Grades' && r.sale_category !== 'GRAND TOTAL')
        .map(r => r.fuel_grade)
      )];

      for (const grade of grades) {
        const treatyRow = sqlData.find(r => r.fuel_grade === grade && r.sale_category === 'Treaty Sale') || { total_volume: 0, total_dollar_amount: 0 };
        const nonTreatyRow = sqlData.find(r => r.fuel_grade === grade && r.sale_category === 'Non Treaty Sale') || { total_volume: 0, total_dollar_amount: 0 };

        const tLitres = Number(treatyRow.total_volume || 0);
        const tAmount = Number(treatyRow.total_dollar_amount || 0);
        const ntLitres = Number(nonTreatyRow.total_volume || 0);
        const ntAmount = Number(nonTreatyRow.total_dollar_amount || 0);

        const totLitres = tLitres + ntLitres;
        const totAmount = tAmount + ntAmount;

        // 5% GST Back-out calculations with strict display rounding rules
        const rawTaxableNT = ntAmount / 1.05;

        // Enforce rounding to 2 decimal points for the taxable display amount first
        const taxableNT = Math.round(rawTaxableNT * 100) / 100;

        // Derive GST from the rounded taxable amount so the row ALWAYS cross-foots perfectly
        const remittableGst = ntAmount - taxableNT;

        detailedRows.push({
          description: grade,
          date: date,
          totalLitres: totLitres,
          totalAmount: totAmount,
          treatyLitres: tLitres,
          treatyAmount: tAmount,
          nonTreatyLitres: ntLitres,
          nonTreatyAmount: ntAmount,
          taxableNonTreaty: taxableNT, // Clean 2-decimal number
          remittableGst: remittableGst   // Clean 2-decimal number
        });

        // Accumulate running column grand totals
        totals.totalLitres += totLitres;
        totals.totalAmount += totAmount;
        totals.treatyLitres += tLitres;
        totals.treatyAmount += tAmount;
        totals.nonTreatyLitres += ntLitres;
        totals.nonTreatyAmount += ntAmount;
        totals.taxableNonTreaty += taxableNT;
        totals.remittableGst += remittableGst;
      }
    }

    // 4. Wrap transformed structure into the final report payload context
    const reportPayload = {
      location,
      detailedRows,
      totals,
      period: { start: startDateStr, end: endDateStr }
    };

    // 5. Generate PDF attachment buffer by passing data directly to utility file
    const pdfBuffer = await generateFuelSalesReportPdfBuffer(reportPayload);
    console.log(`[Cron]: Successfully built Fuel Sales PDF Buffer (${pdfBuffer.length} bytes)`);

    // 6. Map and serialize attachments to Base64 formats for queue processing
    const attachments = [
      {
        filename: `Fuel-Sales-Report-${location.stationName.replace(/\s+/g, '_')}-${startDateStr}_to_${endDateStr}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }
    ];

    const serializedAttachments = await Promise.all(
      attachments.map(async (att) => ({
        filename: att.filename,
        content: await attachmentContentToBase64(att.content),
        encoding: 'base64',
        contentType: att.contentType,
      }))
    );

    // CC Lists (You can expand this later when pushing out of testing)
    // let cc = ['mohammad@gen7fuel.com'];

    // 7. Dispatch directly to your existing background email worker queue
    await emailQueue.add('sendCashSummaryEmail', {
      to: 'daksh@gen7fuel.com', // Override for development testing
      // cc: cc,
      subject: `Fuel Sales & GST Remittance Report – ${location.stationName} – ${startDateStr} to ${endDateStr}`,
      text: `Attached is the Fuel Sales and GST Remittance report for ${location.stationName} covering the period from ${startDateStr} to ${endDateStr}.`,
      attachments: serializedAttachments,
    });

    console.log(`[Cron]: Successfully dispatched fuel sales report job to email queue for processing.`);

  } catch (error) {
    console.error("[Cron Critical Error]: failed running processBiWeeklyFuelReport:", error);
  }
}

module.exports = {
  processBiWeeklyFuelReport
};