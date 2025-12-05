const PDFDocument = require("pdfkit");
const fs = require("fs");

// Safe formatting helper
function safeText(val) {
  try {
    if (val === null || val === undefined) return "";
    if (typeof val === "number") return val.toLocaleString();
    if (typeof val === "string") return val.replace(/\r\n|\r/g, "\n"); // normalize newlines
    if (Array.isArray(val)) return val.join("\n"); // convert arrays to multi-line strings
    return String(val); // fallback for objects or other types
  } catch (err) {
    return "";
  }
}

function generateFuelInventoryPDF(tableData, reportDate) {
  return new Promise((resolve, reject) => {
    const filePath = `/tmp/FuelInventory_${reportDate}.pdf`;
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(`Daily Fuel Inventory Report (${reportDate})`, { align: "center" });
    doc.moveDown(2);

    // Table column widths
    const colWidths = {
      station: 120,
      Regular: 60,
      Super: 60,
      Diesel: 60,
      Premium: 60,
      Midgrade: 60,
      "Dyed Diesel": 70,
      Marine: 60,
    };

    const fuelHeaders = ["Regular", "Super", "Diesel", "Premium", "Midgrade", "Dyed Diesel", "Marine"];
    const stickHeader = "Stick Reading";

    const startX = 40;
    let y = doc.y;

    // -------------------------------
    // HEADER ROWS
    // -------------------------------
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("", startX, y, { width: colWidths.station }); // empty top-left
    let x = startX + colWidths.station;
    for (const header of fuelHeaders) {
      doc.text(header, x, y, { width: colWidths[header], align: "center" });
      x += colWidths[header];
    }
    y += 18;

    // Second header row: "Station" + "Stick Reading"
    doc.fontSize(8).font("Helvetica"); // smaller font for stick reading
    doc.text("Station", startX, y, { width: colWidths.station });
    x = startX + colWidths.station;
    for (const header of fuelHeaders) {
      doc.text(stickHeader, x, y, { width: colWidths[header], align: "center" });
      x += colWidths[header];
    }
    y += 18;

    // Draw header bottom line to keep border intact
    doc.moveTo(startX, y).lineTo(startX + Object.values(colWidths).reduce((a, b) => a + b), y).stroke();
    y += 5;


    // -------------------------------
    // TABLE DATA ROWS
    // -------------------------------
    const rowHeight = 20;

    for (const station of Object.keys(tableData)) {
      const row = tableData[station];

      // Map and check if all values are empty
      const values = fuelHeaders.map((h) => safeText(row[h]));
      const allEmpty = values.every((v) => v === "");
      if (allEmpty) continue; // skip this station

      // Determine max lines in row for multi-line values
      let maxLines = 1;
      for (const val of values) {
        const lines = val?.toString().split("\n").length || 1;
        if (lines > maxLines) maxLines = lines;
      }
      const currentRowHeight = rowHeight * maxLines;

      // Alternating row background
      if (Object.keys(tableData).indexOf(station) % 2 === 1) {
        doc.rect(startX, y, Object.values(colWidths).reduce((a, b) => a + b), currentRowHeight).fill("#f2f2f2");
        doc.fillColor("black");
      }

      // Draw station column
      doc.text(station, startX + 2, y + 4, { width: colWidths.station, align: "left" });

      // Draw data columns
      x = startX + colWidths.station;
      for (const header of fuelHeaders) {
        doc.text(safeText(row[header]), x, y + 4, { width: colWidths[header], align: "center" });
        x += colWidths[header];
      }

      // Draw cell borders
      x = startX;
      for (const width of Object.values(colWidths)) {
        doc.rect(x, y, width, currentRowHeight).stroke();
        x += width;
      }

      y += currentRowHeight;
    }

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = { generateFuelInventoryPDF };