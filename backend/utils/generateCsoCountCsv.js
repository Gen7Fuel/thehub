const ExcelJS = require('exceljs');

/**
 * Generates the CSV file purely in-memory as a buffer matching Petrosoft's expected format.
 * Expected Header: GTIN, QUANTITY, CATEGORY, RETAIL, DESCRIPTION, COST, DATE, TIME, SECTION
 */
async function generateInventoryCsvBuffer({ items, instanceDate }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventory Count');

  // Define the exact structural headers matching your Petrosoft Price Book specification
  worksheet.columns = [
    { header: 'GTIN', key: 'gtin' },
    { header: 'QUANTITY', key: 'quantity' },
    { header: 'CATEGORY_ID', key: 'category' },
    { header: 'RETAIL', key: 'retail' },
    { header: 'DESCRIPTION', key: 'description' },
    { header: 'COST', key: 'cost' },
    { header: 'DATE', key: 'date' },
    { header: 'TIME', key: 'time' },
    { header: 'SECTION', key: 'section' }
  ];

  // Insert normalized records
  items.forEach(item => {
    worksheet.addRow({
      gtin: item.gtin || '',
      quantity: item.totalCalculatedPacks,
      category: '',    // Leave blank per requirements
      retail: '',      // Leave blank per requirements
      description: '', // Leave blank per requirements
      cost: '',        // Leave blank per requirements
      date: instanceDate, // 'YYYY-MM-DD'
      time: '',        // Leave blank per requirements
      section: ''      // Leave blank per requirements
    });
  });

  // Write out directly to an in-memory node buffer stream
  const csvBuffer = await workbook.csv.writeBuffer();
  return csvBuffer;
}

module.exports = { generateInventoryCsvBuffer };