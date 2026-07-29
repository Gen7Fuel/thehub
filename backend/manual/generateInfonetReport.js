const path = require('path');
const XLSX = require('xlsx');

// Helper to format names to Title Case (e.g. "devon wait" -> "Devon Wait")
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to clean monetary/numeric string values (e.g. "$1.50" -> 1.5)
function parseNumeric(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/[\$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function processInfonetReport() {
  const inputPath = path.join(__dirname, 'infonet.xls');
  const outputPath = path.join(__dirname, 'infonet_flatten.xlsx');

  console.log(`Loading workbook from: ${inputPath}`);

  // Read workbook
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Raw mode keeps array length and exact cell positioning constant
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

  const ALLOWED_FUELS = new Set(['REGULAR', 'DIESEL', 'PREMIUM']);

  let currentDate = null;
  let currentTreatyNo = null;
  let currentTreatyName = null;

  const flattenedData = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] || [];

    // Check for "Shift Date:"
    const shiftDateIdx = row.findIndex(cell => cell && cell.toString().toLowerCase().includes('shift date'));
    if (shiftDateIdx !== -1) {
      // Find the first non-empty cell after "Shift Date:"
      for (let i = shiftDateIdx + 1; i < row.length; i++) {
        if (row[i] && row[i].toString().trim()) {
          currentDate = row[i].toString().trim();
          break;
        }
      }
    }

    // Check for "Treaty No:"
    const treatyNoIdx = row.findIndex(cell => cell && cell.toString().toLowerCase().includes('treaty no'));
    if (treatyNoIdx !== -1) {
      // Extract Treaty No (next non-empty cell)
      for (let i = treatyNoIdx + 1; i < row.length; i++) {
        if (row[i] && row[i].toString().trim()) {
          currentTreatyNo = row[i].toString().trim();
          break;
        }
      }

      // Extract Treaty Name after "Treaty Name:" label
      const nameLabelIdx = row.findIndex(cell => cell && cell.toString().toLowerCase().includes('treaty name'));
      if (nameLabelIdx !== -1) {
        for (let i = nameLabelIdx + 1; i < row.length; i++) {
          if (row[i] && row[i].toString().trim()) {
            currentTreatyName = toTitleCase(row[i].toString().trim());
            break;
          }
        }
      }
      continue;
    }

    // Process Transaction Rows
    const transactionNo = row[0] ? row[0].toString().trim() : '';
    const productType = row[1] ? row[1].toString().trim().toUpperCase() : '';

    if (transactionNo && ALLOWED_FUELS.has(productType)) {
      // Collect all non-empty values after the product columns (index 3 and onwards)
      const dataValues = [];
      for (let i = 3; i < row.length; i++) {
        const val = row[i] ? row[i].toString().trim() : '';
        if (val !== '') {
          dataValues.push(val);
        }
      }

      // Positions in dataValues array based on source order:
      // dataValues[0] -> Stock Code ($1.50) -> Non Status Price
      // dataValues[1] -> Sale No ($1.40)    -> Treaty Price
      // dataValues[2] -> Quantity (23.95)   -> Litres Purchased
      // dataValues[3] -> Tax Exempt ($2.28) -> Total Fuel Tax Exempt
      // dataValues[4] -> Sale Total ($75.40)-> Total Sale Amount (optional/if present)

      const nonStatusPrice = parseNumeric(dataValues[0]);
      const treatyPrice    = parseNumeric(dataValues[1]);
      const litresPurchased = parseNumeric(dataValues[2]);
      const taxExempt       = parseNumeric(dataValues[3]);
      const saleTotal       = parseNumeric(dataValues[4]);

      flattenedData.push({
        'Transaction Number': transactionNo,
        'Date': currentDate,
        'Status Number': currentTreatyNo,
        'Purchasers Name': currentTreatyName,
        'Litres Purchased': litresPurchased,
        'Type of Fuel': productType,
        'Regular Price': nonStatusPrice,
        'Treaty Price': treatyPrice,
        'Total Fuel Tax Exempt': taxExempt,
        'Total Sale Amount': saleTotal
      });
    }
  }

  // Create new worksheet
  const newSheet = XLSX.utils.json_to_sheet(flattenedData);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Flattened Report');

  // Write output file
  XLSX.writeFile(newWorkbook, outputPath);
  console.log(`Successfully generated flattened file: ${outputPath}`);
  console.log(`Total records processed: ${flattenedData.length}`);
}

processInfonetReport();