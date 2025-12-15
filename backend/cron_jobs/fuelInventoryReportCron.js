const cron = require("node-cron");
const { emailQueue } = require("../queues/emailQueue");
const { getFuelInventoryReportPreviousDay, getFuelInventoryReportCurrentDay } = require("../services/sqlService");
const { generateFuelInventoryPDF } = require("../utils/pdfGenerator");
// const mongoose = require("mongoose");
// const dotenv = require("dotenv");
// const connectDB = require("../config/db");
const Location = require("../models/Location");

function normalizeGrade(g) {
  if (!g) return null;
  g = g.toLowerCase();

  if (g.includes("regular")) return "Regular";
  if (g.includes("mid")) return "Midgrade";
  if (g.includes("super")) return "Super";
  if (g.includes("premium")) return "Premium";
  if (g.includes("dyed") && g.includes("diesel")) return "Dyed Diesel";
  if (g.includes("diesel")) return "Diesel";
  if (g.includes("marine")) return "Marine";

  return null; // unknown grade — skip
}

// dotenv.config();

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
    try {
      const locations = await Location.find({}, { csoCode: 1, stationName: 1 }).lean();
      for (const loc of locations) {
        stationMap[loc.csoCode] = loc.stationName;
      }
    } catch {
      console.log('Cannot map cso code with station name');
    }
  }

  for (const r of rows) {
    let station;

    if (currentDay) {
      const stationName = stationMap[r.Station_SK] || r.Station_SK;
      station = `${stationName} Gen 7`;
    } else {
      station = r.Station_Name;
    }

    const grade = normalizeGrade(r.Fuel_Grade);
    const liters = r.Stick_L;

    // skip unknown grades
    if (!grade) {
      console.log("⚠ Unknown grade:", r.Fuel_Grade);
      continue;
    }

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
    const tableData = await transformFuelInventory(rows, false);

    // 3️⃣ Format yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split("T")[0];

    // 4️⃣ Generate PDF
    const pdfPath = await generateFuelInventoryPDF(tableData, formattedDate);

    // 5️⃣ Queue email
    await emailQueue.add("sendFuelInventoryReport", {
      to: "kellie@gen7fuel.com",
      cc: ["daksh@gen7fuel.com", "nmiller@gen7fuel.com"],
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
    // if HOST=VPS, only then send email
    if (process.env.HOST === "VPS") {
      await emailQueue.add("sendFuelInventoryReport", {
        to: "kellie@gen7fuel.com",
        cc: ["daksh@gen7fuel.com", "nmiller@gen7fuel.com"],
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
    } else {
      console.log("Skipping email - not running on VPS host.");
    }

    console.log("Fuel Inventory Email Queued.");
  } catch (err) {
    console.error("Fuel Inventory Cron Failed:", err);
  }
}


// CRON SCHEDULER — runs daily at 5 am est/edt
cron.schedule("0 5 * * *", runFuelInventoryReportJobPreviousDay, {
  timezone: "America/New_York" // will automatically handle EST/EDT
});

// CRON SCHEDULER - runs at 3 pm est/edt
cron.schedule("0 15 * * *", runFuelInventoryReportJobCurrentDay, {
  timezone: "America/New_York"
});



module.exports = { runFuelInventoryReportJobPreviousDay, runFuelInventoryReportJobCurrentDay };