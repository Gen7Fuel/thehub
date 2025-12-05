const cron = require("node-cron");
const { emailQueue } = require("../queues/emailQueue");
const { get_Fuel_Inventory_Report } = require("../services/sqlService");
const { generateFuelInventoryPDF } = require("../utils/pdfGenerator");

// Convert SQL rows → table structure
function transformFuelInventory(rows) {
  const table = {};

  for (const r of rows) {
    const station = r.Station_Name;
    const grade = r.Fuel_Grade;
    const liters = r.Stick_L;

    if (!table[station]) {
      table[station] = {
        Regular: "",
        Super: "",
        Diesel: "",
        Premium: "",
        Midgrade: "",
        "Dyed Diesel": "",
        Marine: ""
      };
    }

    table[station][grade] = liters?.toLocaleString() || "";
  }

  return table;
}

// MAIN TASK FUNCTION
async function runFuelInventoryReportJob() {
  try {
    console.log("Running Fuel Inventory Report Cron...");

    // 1️⃣ Get DB rows
    const rows = await get_Fuel_Inventory_Report();

    // 2️⃣ Pivot/transform
    const tableData = transformFuelInventory(rows);

    // 3️⃣ Format yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split("T")[0];

    // 4️⃣ Generate PDF
    const pdfPath = await generateFuelInventoryPDF(tableData, formattedDate);

    // 5️⃣ Queue email
    await emailQueue.add("sendFuelInventoryReport", {
      to: "kellie@gen7fuel.com",
      subject: `Fuel Inventory Report (${formattedDate})`,
      text: "Attached is your daily fuel inventory report.",
      html: "<p>Attached is your daily fuel inventory report.</p>",
      attachments: [
        {
          filename: `FuelInventory_${formattedDate}.pdf`,
          path: pdfPath
        }
      ]
    });

    console.log("Fuel Inventory Email Queued.");
  } catch (err) {
    console.error("Fuel Inventory Cron Failed:", err);
  }
}

// CRON SCHEDULER — runs daily at 5 am est/edt
cron.schedule("0 5 * * *", runFuelInventoryReportJob, {
  timezone: "America/New_York" // will automatically handle EST/EDT
});

module.exports = { runFuelInventoryReportJob };