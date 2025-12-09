const cron = require("node-cron");
const { emailQueue } = require("../queues/emailQueue");
const { getFuelInventoryReportPreviousDay, getFuelInventoryReportCurrentDay } = require("../services/sqlService");
const { generateFuelInventoryPDF } = require("../utils/pdfGenerator");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const Location = require("../models/Location");

dotenv.config();

/**
 * Transform SQL rows → table structure for PDF
 * @param {Array} rows - SQL rows
 * @param {Boolean} currentDay - true if processing current day inventory
 * @returns {Object} tableData compatible with PDF generator
 */
async function transformFuelInventory(rows, currentDay = false) {

  const table = {};

  let stationMap = {};

  if (currentDay) {
    // Fetch all locations only if current day
    try {
      await connectDB();
      const locations = await Location.find({}, { csoCode: 1, stationName: 1 }).lean();
      stationMap = {};
      for (const loc of locations) {
        stationMap[loc.csoCode] = loc.stationName;
      }
      // await mongoose.connection.close();
    } catch {
      console.log('Cannot map cso code with station name');
      // await mongoose.connection.close();
    }
  }

  for (const r of rows) {
    let station;
    if (currentDay) {
      // Map Station_SK → station name with "Gen 7" prefix
      const stationName = stationMap[r.Station_SK] || r.Station_SK;
      station = `${stationName} Gen 7`;
    } else {
      // Use original Station_Name for previous day
      station = r.Station_Name;
    }

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
async function runFuelInventoryReportJobPreviousDay() {
  try {
    console.log("Running Fuel Inventory Report Cron Previous Day...");

    // 1️⃣ Get DB rows
    const rows = await getFuelInventoryReportPreviousDay();

    // 2️⃣ Pivot/transform
    const tableData = transformFuelInventory(rows, false);

    // 3️⃣ Format yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split("T")[0];

    // 4️⃣ Generate PDF
    const pdfPath = await generateFuelInventoryPDF(tableData, formattedDate);

    // 5️⃣ Queue email
    await emailQueue.add("sendFuelInventoryReport", {
      to: "kellie@gen7fuel.com",
      cc: ["daksh@gen7fuel.com"],
      subject: `Fuel Inventory Report End-of-Day (${formattedDate})`,
      text: "Attached is your daily (End-of-Day) fuel inventory report.",
      html: "<p>Attached is your daily (End-of-Day) fuel inventory report.</p>",
      attachments: [
        {
          filename: `FuelInventory_EndOfDay_${formattedDate}.pdf`,
          path: pdfPath
        }
      ]
    });

    console.log("Fuel Inventory Email Queued.");
  } catch (err) {
    console.error("Fuel Inventory Cron Failed:", err);
  }
}

// MAIN TASK FUNCTION
async function runFuelInventoryReportJobCurrentDay() {
  try {
    console.log("Running Fuel Inventory Report Cron Current Day...");

    // 1️⃣ Get DB rows
    const rows = await getFuelInventoryReportCurrentDay();

    // 2️⃣ Pivot/transform
    const tableData = await transformFuelInventory(rows, true);

    // 3️⃣ Format yesterday's date
    const today = new Date();
    today.setDate(today.getDate());
    const formattedDate = today.toISOString().split("T")[0];

    // 4️⃣ Generate PDF
    const pdfPath = await generateFuelInventoryPDF(tableData, formattedDate);

    // 5️⃣ Queue email
    await emailQueue.add("sendFuelInventoryReport", {
      to: "kellie@gen7fuel.com",
      cc: ["daksh@gen7fuel.com"],
      subject: `Fuel Inventory Report Mid-Day (${formattedDate})`,
      text: "Attached is your daily (Mid-Day) fuel inventory report.",
      html: "<p>Attached is your daily (mid-day) fuel inventory report.</p>",
      attachments: [
        {
          filename: `FuelInventory_MidDay_${formattedDate}.pdf`,
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
cron.schedule("0 5 * * *", runFuelInventoryReportJobPreviousDay, {
  timezone: "America/New_York" // will automatically handle EST/EDT
});

// CRON SCHEDULER - runs at 3 om est/edt
cron.schedule("0 15 * * *", runFuelInventoryReportJobCurrentDay, {
  timezone: "America/New_York"
});


// for manual run
// if (require.main === module) {
//   // This ensures it only runs when you execute this file directly, not when imported
//   // runFuelInventoryReportJobPreviousDay()
//   runFuelInventoryReportJobCurrentDay()
//     .then(() => console.log("Test run finished"))
//     .catch(err => console.error("Test run failed:", err));
// }


module.exports = { runFuelInventoryReportJobPreviousDay, runFuelInventoryReportJobCurrentDay };