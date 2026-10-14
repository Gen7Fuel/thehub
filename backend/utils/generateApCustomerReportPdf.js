const PDFDocument = require('pdfkit');
const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function generateApCustomerReportPdf({ siteDisplayName, startDate, endDate, groupedData }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, autoPageBreak: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const width = doc.page.width - 72;
    const maxY = doc.page.height - 45;
    const colors = { primary: '#1F4E78', light: '#F2F4F7', text: '#1E293B', muted: '#64748B', border: '#E2E8F0' };
    let y;
    const header = () => {
      doc.rect(36, 36, width, 4).fill(colors.primary);
      doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(18).text('A/P Customer Reports', 36, 48, { lineBreak: false });
      doc.fillColor(colors.primary).fontSize(12).text(siteDisplayName, 36, 70, { lineBreak: false });
      doc.fillColor(colors.muted).font('Helvetica').fontSize(9).text(`Period: ${startDate} to ${endDate}`, 36, 86, { lineBreak: false });
      doc.moveTo(36, 102).lineTo(36 + width, 102).strokeColor(colors.border).stroke();
    };
    const space = (needed) => { if (y + needed > maxY) { doc.addPage(); header(); y = 115; } };
    header(); y = 115;
    groupedData.forEach((group) => {
      space(72);
      doc.rect(36, y, width, 26).fill(colors.light);
      doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).text(group.vendorName, 46, y + 7, { width: width - 230, lineBreak: false });
      doc.fillColor(colors.text).fontSize(10).text(`Bills: ${group.count}  |  Total: ${money(group.totalAmount)}`, 36 + width - 220, y + 8, { width: 210, align: 'right', lineBreak: false });
      y += 32;
      const cols = [{ n: 'Date', w: 78 }, { n: 'Location', w: 135 }, { n: 'Payment Method', w: 115 }, { n: 'Amount', w: 85 }, { n: 'Bills', w: 110 }];
      let x = 36; doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8.5);
      cols.forEach((c) => { doc.text(c.n, x, y, { width: c.w, lineBreak: false }); x += c.w; });
      y += 14; doc.moveTo(36, y).lineTo(36 + width, y).strokeColor(colors.border).stroke(); y += 6;
      group.items.forEach((item) => {
        space(20); x = 36; doc.fillColor(colors.text).font('Helvetica').fontSize(8.5);
        doc.text(item.date || 'N/A', x + 3, y, { width: cols[0].w - 6, lineBreak: false }); x += cols[0].w;
        doc.text(item.locationName || 'N/A', x + 3, y, { width: cols[1].w - 6, lineBreak: false }); x += cols[1].w;
        doc.text(item.paymentMethod || 'N/A', x + 3, y, { width: cols[2].w - 6, lineBreak: false }); x += cols[2].w;
        doc.text(money(item.amount), x + 3, y, { width: cols[3].w - 12, align: 'right', lineBreak: false }); x += cols[3].w;
        doc.moveTo(x, y - 2).lineTo(x, y + 10).strokeColor(colors.border).lineWidth(0.5).stroke();
        if (item.images?.length) doc.fillColor('#0284C7').text(`View ${item.images.length} invoice${item.images.length === 1 ? '' : 's'}`, x + 7, y, { width: cols[4].w - 10, link: item.imagePdfUrl, underline: true, lineBreak: false });
        else doc.fillColor(colors.muted).text('-', x + 7, y, { width: cols[4].w - 10, lineBreak: false });
        y += 16;
      });
      y += 14;
    });
    space(35); doc.moveTo(36, y).lineTo(36 + width, y).strokeColor(colors.primary).lineWidth(1.5).stroke(); y += 8;
    doc.rect(36, y, width, 28).fill(colors.primary); doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11).text('GRAND TOTAL', 48, y + 8, { lineBreak: false });
    const total = groupedData.reduce((sum, group) => sum + group.totalAmount, 0);
    const count = groupedData.reduce((sum, group) => sum + group.count, 0);
    doc.text(`Bills: ${count}   |   Total: ${money(total)}`, 36 + width - 250, y + 8, { width: 238, align: 'right', lineBreak: false });
    doc.end();
  });
}

module.exports = { generateApCustomerReportPdf };
