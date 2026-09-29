const PDFDocument = require('pdfkit');

/**
 * Normalizes customer names for grouping
 */
function normalizeCustomerName(name) {
  if (!name) return 'UNKNOWN CUSTOMER';
  return name
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\b(INC|INCORPORATED|LLC|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates an A/R Customer Transactions PDF Report Buffer
 */
function generateArCustomerReportPdf({ siteDisplayName, startDate, endDate, groupedData }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        autoPageBreak: false
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width - 72; // 523pt
      const pageHeight = doc.page.height;
      const marginX = 36;
      const maxY = pageHeight - 45;

      const primaryColor = '#1F4E78';
      const secondaryColor = '#2F5597';
      const lightBgColor = '#F2F4F7';
      const textDark = '#1E293B';
      const textMuted = '#64748B';
      const borderLine = '#E2E8F0';

      const renderHeader = () => {
        doc.rect(marginX, 36, pageWidth, 4).fill(primaryColor);
        doc.fillColor(textDark).font('Helvetica-Bold').fontSize(18).text('A/R Customer Transactions Report', marginX, 48, { lineBreak: false });
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text(siteDisplayName, marginX, 70, { lineBreak: false });
        doc.fillColor(textMuted).font('Helvetica').fontSize(9).text(`Period: ${startDate} to ${endDate}`, marginX, 86, { lineBreak: false });
        doc.moveTo(marginX, 102).lineTo(marginX + pageWidth, 102).strokeColor(borderLine).lineWidth(1).stroke();
      };

      const ensureSpace = (requiredSpace) => {
        if (currentY + requiredSpace > maxY) {
          doc.addPage();
          renderHeader();
          currentY = 115;
        }
      };

      renderHeader();
      let currentY = 115;

      let grandTotalAmount = 0;
      let grandTotalCount = 0;
      groupedData.forEach((group) => {
        grandTotalAmount += group.totalAmount;
        grandTotalCount += group.count;
      });

      groupedData.forEach((group) => {
        ensureSpace(65);

        // Customer Header Card
        const bannerHeight = 26;
        doc.rect(marginX, currentY, pageWidth, bannerHeight).fill(lightBgColor);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(group.customerName, marginX + 10, currentY + 7, { width: pageWidth - 230, lineBreak: false });

        const summaryText = `Trx: ${group.count}  |  Total: $${group.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        doc.fillColor(textDark).font('Helvetica-Bold').fontSize(10).text(summaryText, marginX + pageWidth - 220, currentY + 8, { width: 210, align: 'right', lineBreak: false });

        currentY += bannerHeight + 6;

        // Table Header
        const cols = [
          { name: 'Date', width: 70, align: 'left' },
          { name: 'Fleet Card / PO', width: 110, align: 'left' },
          { name: 'Driver Name', width: 130, align: 'left' },
          { name: 'Qty', width: 50, align: 'right' },
          { name: 'Amount', width: 80, align: 'right' },
          { name: 'Image', width: 83, align: 'center' }
        ];

        let xPos = marginX;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textMuted);
        cols.forEach((col) => {
          doc.text(col.name, xPos, currentY, { width: col.width, align: col.align, lineBreak: false });
          xPos += col.width;
        });

        currentY += 14;
        doc.moveTo(marginX, currentY).lineTo(marginX + pageWidth, currentY).strokeColor(borderLine).lineWidth(0.5).stroke();
        currentY += 6;

        // Rows
        group.items.forEach((item) => {
          ensureSpace(18);

          const formattedDate = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';
          const cardOrPo = item.poNumber || item.fleetCardNumber || 'N/A';
          const driver = item.driverName || '-';
          const qty = item.quantity ? item.quantity.toString() : '0';
          const amt = `$${(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          xPos = marginX;
          doc.font('Helvetica').fontSize(8.5).fillColor(textDark);

          doc.text(formattedDate, xPos, currentY, { width: cols[0].width, align: 'left', lineBreak: false });
          xPos += cols[0].width;

          doc.text(cardOrPo, xPos, currentY, { width: cols[1].width, align: 'left', lineBreak: false });
          xPos += cols[1].width;

          doc.text(driver, xPos, currentY, { width: cols[2].width, align: 'left', lineBreak: false });
          xPos += cols[2].width;

          doc.text(qty, xPos, currentY, { width: cols[3].width, align: 'right', lineBreak: false });
          xPos += cols[3].width;

          doc.text(amt, xPos, currentY, { width: cols[4].width, align: 'right', lineBreak: false });
          xPos += cols[4].width;

          if (item.receipt) {
            const imageUrl = `https://app.gen7fuel.com/cdn/download/${item.receipt}`;
            doc.fillColor('#0284C7').text('View Image', xPos, currentY, {
              width: cols[5].width,
              align: 'center',
              link: imageUrl,
              underline: true,
              lineBreak: false
            });
          } else {
            doc.fillColor(textMuted).text('-', xPos, currentY, { width: cols[5].width, align: 'center', lineBreak: false });
          }

          currentY += 16;
        });

        currentY += 14;
      });

      // Grand Totals Banner
      ensureSpace(40);

      doc.moveTo(marginX, currentY).lineTo(marginX + pageWidth, currentY).strokeColor(primaryColor).lineWidth(1.5).stroke();
      currentY += 8;
      doc.rect(marginX, currentY, pageWidth, 28).fill(secondaryColor);

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text('GRAND TOTAL (ALL CUSTOMERS)', marginX + 12, currentY + 8, { lineBreak: false });
      const grandSummaryText = `Total Trx: ${grandTotalCount}   |   Grand Total: $${grandTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(grandSummaryText, marginX + pageWidth - 320, currentY + 8, { width: 310, align: 'right', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an A/R Paid PDF Report Buffer (from CashSummary Data)
 */
function generateArPaidReportPdf({ siteDisplayName, startDate, endDate, groupedData }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        autoPageBreak: false
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width - 72; // 523pt
      const pageHeight = doc.page.height;
      const marginX = 36;
      const maxY = pageHeight - 45;

      const primaryColor = '#1F4E78';
      const secondaryColor = '#2F5597';
      const lightBgColor = '#F2F4F7';
      const textDark = '#1E293B';
      const textMuted = '#64748B';
      const borderLine = '#E2E8F0';

      const renderHeader = () => {
        doc.rect(marginX, 36, pageWidth, 4).fill(primaryColor);
        doc.fillColor(textDark).font('Helvetica-Bold').fontSize(18).text('A/R Customer Paid Payments Report', marginX, 48, { lineBreak: false });
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text(siteDisplayName, marginX, 70, { lineBreak: false });
        doc.fillColor(textMuted).font('Helvetica').fontSize(9).text(`Period: ${startDate} to ${endDate}`, marginX, 86, { lineBreak: false });
        doc.moveTo(marginX, 102).lineTo(marginX + pageWidth, 102).strokeColor(borderLine).lineWidth(1).stroke();
      };

      const ensureSpace = (requiredSpace) => {
        if (currentY + requiredSpace > maxY) {
          doc.addPage();
          renderHeader();
          currentY = 115;
        }
      };

      renderHeader();
      let currentY = 115;

      let grandTotalAmount = 0;
      let grandTotalCount = 0;
      groupedData.forEach((group) => {
        grandTotalAmount += group.totalAmount;
        grandTotalCount += group.count;
      });

      groupedData.forEach((group) => {
        ensureSpace(65);

        // Customer Header Card
        const bannerHeight = 26;
        doc.rect(marginX, currentY, pageWidth, bannerHeight).fill(lightBgColor);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(group.customerName, marginX + 10, currentY + 7, { width: pageWidth - 240, lineBreak: false });

        const summaryText = `Entries: ${group.count}  |  Total Paid: $${group.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        doc.fillColor(textDark).font('Helvetica-Bold').fontSize(10).text(summaryText, marginX + pageWidth - 230, currentY + 8, { width: 220, align: 'right', lineBreak: false });

        currentY += bannerHeight + 6;

        // Table Header
        const cols = [
          { name: 'Date', width: 100, align: 'left' },
          { name: 'Shift Number', width: 100, align: 'left' },
          { name: 'Customer Name', width: 200, align: 'left' },
          { name: 'Paid Amount', width: 123, align: 'right' }
        ];

        let xPos = marginX;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textMuted);
        cols.forEach((col) => {
          doc.text(col.name, xPos, currentY, { width: col.width, align: col.align, lineBreak: false });
          xPos += col.width;
        });

        currentY += 14;
        doc.moveTo(marginX, currentY).lineTo(marginX + pageWidth, currentY).strokeColor(borderLine).lineWidth(0.5).stroke();
        currentY += 6;

        // Rows
        group.items.forEach((item) => {
          ensureSpace(18);

          const amt = `$${(item.paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          xPos = marginX;
          doc.font('Helvetica').fontSize(8.5).fillColor(textDark);

          doc.text(item.date || 'N/A', xPos, currentY, { width: cols[0].width, align: 'left', lineBreak: false });
          xPos += cols[0].width;

          doc.text(item.shift_number ? item.shift_number.toString() : '-', xPos, currentY, { width: cols[1].width, align: 'left', lineBreak: false });
          xPos += cols[1].width;

          doc.text(item.name || group.customerName, xPos, currentY, { width: cols[2].width, align: 'left', lineBreak: false });
          xPos += cols[2].width;

          doc.text(amt, xPos, currentY, { width: cols[3].width, align: 'right', lineBreak: false });

          currentY += 16;
        });

        currentY += 14;
      });

      // Grand Totals Banner
      ensureSpace(40);

      doc.moveTo(marginX, currentY).lineTo(marginX + pageWidth, currentY).strokeColor(primaryColor).lineWidth(1.5).stroke();
      currentY += 8;
      doc.rect(marginX, currentY, pageWidth, 28).fill(secondaryColor);

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text('GRAND TOTAL (ALL CUSTOMERS)', marginX + 12, currentY + 8, { lineBreak: false });
      const grandSummaryText = `Total Entries: ${grandTotalCount}   |   Grand Total Paid: $${grandTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(grandSummaryText, marginX + pageWidth - 340, currentY + 8, { width: 330, align: 'right', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  normalizeCustomerName,
  generateArCustomerReportPdf,
  generateArPaidReportPdf
};