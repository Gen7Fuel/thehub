const PDFDocument = require("pdfkit");
const fs = require("fs");

function generateArTransactionPdf(transaction, date, site) {
  return new Promise((resolve, reject) => {
    const { customer, card, amount, quantity, price_per_litre } = transaction;
    const last4 = String(card).slice(-4);
    const filePath = `/tmp/AR_${site}_${date}_${last4}_${Date.now()}.pdf`;

    const doc = new PDFDocument({ margin: 50, size: "A5" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("AR Transaction Receipt", { align: "center" });
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
      doc.fontSize(11).font("Helvetica").text(String(value), valueX, y);
      doc.y = y + lineGap;
    }

    row("Site:", site);
    row("Date:", date);
    row("Customer:", customer);
    row("Card:", `****${last4}`);
    row("Quantity:", `${Number(quantity).toFixed(3)} L`);
    row("Price / Litre:", `$${Number(price_per_litre).toFixed(3)}`);
    row("Amount:", `$${Number(amount).toFixed(2)}`);

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = { generateArTransactionPdf };
