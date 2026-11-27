const reportPdfFooterStyle = {
  position: 'absolute',
  bottom: 16,
  height: 10,
  left: 30,
  right: 30,
  fontSize: 8,
  lineHeight: 1.2,
  color: '#52617a',
  textAlign: 'right',
};

function formatReportGenerationFooter(timeZone, generatedAt = new Date()) {
  const options = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: typeof timeZone === 'string' ? timeZone : options.timeZone,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    formatter = new Intl.DateTimeFormat('en-US', options);
  }
  return `Generated ${formatter.format(generatedAt)} (${formatter.resolvedOptions().timeZone})`;
}

function drawReportPdfFooter(doc, generationFooter) {
  if (!generationFooter) return;

  const { bottom, height, color, fontSize } = reportPdfFooterStyle;
  doc.save();
  doc.font('Helvetica').fontSize(fontSize).fillColor(color);
  const x = doc.page.width - doc.page.margins.right - doc.widthOfString(generationFooter);
  const y = doc.page.height - bottom - height;
  doc.text(generationFooter, x, y, { lineBreak: false });
  doc.restore();
}

module.exports = { formatReportGenerationFooter, drawReportPdfFooter, reportPdfFooterStyle };
