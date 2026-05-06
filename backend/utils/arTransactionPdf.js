const PDFDocument = require("pdfkit");
const fs = require("fs");

function generateArTransactionPdf(transaction, site) {
  return new Promise((resolve, reject) => {
    const { customerName, poNumber, driverName, vehicleMakeModel, productCode, quantity, amount, date } = transaction;
    const dateStr = date instanceof Date
      ? date.toISOString().slice(0, 10)
      : String(date).slice(0, 10);
    const filePath = `/tmp/AR_${site}_${dateStr}_PO${poNumber || "nopo"}_${Date.now()}.pdf`;

    const doc = new PDFDocument({ margin: 50, size: "A5" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Purchase Order Receipt", { align: "center" });
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(1);

    // Fields
    const labelX = 50;
    const valueX = 180;
    const lineGap = 22;

    function row(label, value) {
      const y = doc.y;
      doc.fontSize(11).font("Helvetica-Bold").text(label, labelX, y, { continued: false });
      doc.fontSize(11).font("Helvetica").text(String(value ?? ""), valueX, y);
      doc.y = y + lineGap;
    }

    row("Site:", site);
    row("Date:", dateStr);
    row("PO Number:", poNumber || "");
    row("Customer:", customerName || "");
    row("Driver:", driverName || "");
    row("Vehicle:", vehicleMakeModel || "");
    row("Product:", productCode || "");
    row("Quantity:", `${Number(quantity).toFixed(3)} L`);
    row("Amount:", `$${Number(amount).toFixed(2)}`);

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = { generateArTransactionPdf };
