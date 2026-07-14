const fs = require('fs');
const path = require('path');
const React = require('react');
const { Document, Page, Text, View, StyleSheet, renderToBuffer } = require('@react-pdf/renderer');

const rawPdfParse = require('pdf-parse');

// ... upper imports stay the same ...

// const pdfParse = async (dataBuffer) => {
//   const Constructor = rawPdfParse.PDFParse || (typeof rawPdfParse === 'function' ? rawPdfParse : null);
  
//   if (!Constructor) {
//     throw new Error("Could not locate a valid PDFParse constructor.");
//   }

//   const typedArrayData = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
//   const defaultOptions = { verbosity: 0, password: '' };

//   try {
//     const instance = new Constructor(typedArrayData, defaultOptions);
//     let doc = instance;
    
//     if (typeof instance.then === 'function') {
//       doc = await instance;
//     } else {
//       const targetMethod = typeof instance.parse === 'function' ? 'parse' 
//                          : typeof instance.load === 'function' ? 'load' 
//                          : Object.keys(instance).find(k => typeof instance[k] === 'function');
//       if (targetMethod) {
//         doc = await instance[targetMethod](typedArrayData, defaultOptions);
//       }
//     }

//     // If the loading task exposes a nested promise, resolve it to get the document proxy
//     if (doc && doc.promise) {
//       doc = await doc.promise;
//     }

//     // Determine total pages (handle both standard property and hidden _pdfInfo variant)
//     const numPages = doc.numPages || (doc._pdfInfo && doc._pdfInfo.numPages) || 0;
    
//     if (numPages === 0) {
//       return { text: '' };
//     }

//     let fullTextContent = '';

//     // Loop through every page to extract text items manually
//     for (let i = 1; i <= numPages; i++) {
//       try {
//         const page = await doc.getPage(i);
//         const textContent = await page.getTextContent();
        
//         // Assemble the layout strings from the text viewport items array
//         if (textContent && Array.isArray(textContent.items)) {
//           const pageText = textContent.items.map(item => item.str || '').join(' ');
//           fullTextContent += pageText + '\n';
//         }
//       } catch (pageErr) {
//         console.warn(`      -> [PAGE ${i} WARNING] Failed to extract tokens:`, pageErr.message);
//       }
//     }

//     return { text: fullTextContent };

//   } catch (err) {
//     console.error("   -> [ADAPTER CRITICAL ERROR]:", err.message);
//     return { text: '' };
//   }
// };
const pdfParse = async (dataBuffer) => {
  const Constructor = rawPdfParse.PDFParse || (typeof rawPdfParse === 'function' ? rawPdfParse : null);
  
  if (!Constructor) {
    throw new Error("Could not locate a valid PDFParse constructor.");
  }

  const typedArrayData = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
  const defaultOptions = { verbosity: 0, password: '' };

  try {
    const instance = new Constructor(typedArrayData, defaultOptions);
    let doc = instance;
    
    if (typeof instance.then === 'function') {
      doc = await instance;
    } else {
      const targetMethod = typeof instance.parse === 'function' ? 'parse' 
                         : typeof instance.load === 'function' ? 'load' 
                         : Object.keys(instance).find(k => typeof instance[k] === 'function');
      if (targetMethod) {
        doc = await instance[targetMethod](typedArrayData, defaultOptions);
      }
    }

    if (doc && doc.promise) {
      doc = await doc.promise;
    }

    const numPages = doc.numPages || (doc._pdfInfo && doc._pdfInfo.numPages) || 0;
    if (numPages === 0) return { text: '' };

    let fullTextContent = '';

    // Loop through every page
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        
        if (textContent && Array.isArray(textContent.items)) {
          // Group and sort tokens by their actual geometric layout coordinates
          // item.transform[5] is the Y-coordinate (vertical height)
          // item.transform[4] is the X-coordinate (horizontal offset)
          const items = textContent.items;
          
          // Sort primary by Y descending (top of page to bottom), secondary by X ascending (left to right)
          items.sort((a, b) => {
            if (Math.abs(b.transform[5] - a.transform[5]) < 2) { 
              return a.transform[4] - b.transform[4]; // Same line, sort left-to-right
            }
            return b.transform[5] - a.transform[5]; // Different lines, sort top-to-bottom
          });

          let pageText = '';
          let lastY = null;

          // Rebuild the strings string line by line with proper break insertions
          for (const item of items) {
            const currentY = item.transform[5];
            
            if (lastY !== null && Math.abs(currentY - lastY) >= 2) {
              // Y position changed significantly -> insert a real line break
              pageText += '\n';
            } else if (lastY !== null) {
              // Small gap or same line -> add spacing separation boundary
              pageText += ' ';
            }
            
            pageText += (item.str || '');
            lastY = currentY;
          }

          fullTextContent += pageText + '\n';
        }
      } catch (pageErr) {
        console.warn(`      -> [PAGE ${i} WARNING] Failed to extract layout tokens:`, pageErr.message);
      }
    }

    return { text: fullTextContent };

  } catch (err) {
    console.error("   -> [LAYOUT ADAPTER CRITICAL ERROR]:", err.message);
    return { text: '' };
  }
};

const h = React.createElement;

// Styles matching your exact visual specification
const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.4, color: '#333333' },
  headerContainer: { marginBottom: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  titleText: { fontSize: 18, fontWeight: 'bold' },
  rightHeaderText: { textAlign: 'right', fontSize: 9 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 8, marginBottom: 15 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333333', paddingBottom: 4, marginBottom: 5, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, alignItems: 'center' },
  totalRow: { flexDirection: 'row', paddingVertical: 5, marginTop: 4, borderTopWidth: 1, borderTopColor: '#333333', borderBottomWidth: 1, borderBottomColor: '#333333', backgroundColor: '#F2F2F2' },
  sectionHeaderRow: { flexDirection: 'row', backgroundColor: '#E2F0D9', paddingVertical: 4, paddingHorizontal: 4, marginTop: 8, marginBottom: 2 },
  subSectionHeaderRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, marginTop: 4, marginBottom: 1 },
  sectionHeaderText: { fontWeight: 'bold', color: '#1E4620' },
  subSectionHeaderText: { fontWeight: 'bold', color: '#333333', textDecoration: 'underline' },
  colDesc: { flex: 2, textAlign: 'left' },
  colAmount: { width: 90, textAlign: 'right' },
  textBold: { fontWeight: 'bold' },
  rowIndent: { paddingLeft: 12 },
  valPositive: { color: '#059669', fontWeight: 'bold' },
  valNegative: { color: '#dc2626', fontWeight: 'bold' },
  valZero: { color: '#6b7280', fontWeight: 'bold' },
  fuelGridRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0', paddingVertical: 4, alignItems: 'center' },
  fuelGridHeaderGroup: { borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2, fontWeight: 'bold' },
  fuelColDesc: { width: 85, textAlign: 'left' },
  fuelColVal: { width: 52, textAlign: 'right' },
  fuelColWide: { width: 58, textAlign: 'right' }
});

function CumulativeReportDoc({ site, period, data }) {
  const renderRow = (desc, amount, isTotalHighlight = false, customAmountStyle = null, isIndented = false) => {
    const amtStr = typeof amount === 'number' ? formatCurrency(amount) : '';
    const rowStyle = isTotalHighlight ? styles.totalRow : styles.tableRow;
    return h(View, { style: rowStyle },
      h(Text, { style: [styles.colDesc, isTotalHighlight && styles.textBold, isIndented && styles.rowIndent] }, desc),
      h(Text, { style: [styles.colAmount, isTotalHighlight && styles.textBold, customAmountStyle] }, amtStr)
    );
  };

  const renderSectionHeader = (title) => h(View, { style: styles.sectionHeaderRow }, h(Text, { style: styles.sectionHeaderText }, title));
  const renderSubSectionHeader = (title) => h(View, { style: styles.subSectionHeaderRow }, h(Text, { style: styles.subSectionHeaderText }, title));

  const totalTenders = Object.values(data.tenders).reduce((a, b) => a + (b || 0), 0) + (data.reportCanadianCash || 0);

  let overShortStyle = styles.valZero;
  if (data.overShortCash > 0.01) overShortStyle = styles.valPositive;
  if (data.overShortCash < -0.01) overShortStyle = styles.valNegative;

  return h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      h(View, { style: styles.headerContainer },
        h(View, { style: styles.headerRow },
          h(Text, { style: styles.titleText }, 'Cumulative End of Day Summary'),
          h(Text, { style: styles.rightHeaderText }, `REPORT FOR ${site.toUpperCase()}`)
        ),
        h(View, { style: styles.headerRow },
          h(Text, null, `Station: ${site}`),
          h(Text, { style: styles.rightHeaderText }, `Period: ${period}`)
        )
      ),
      h(View, { style: styles.divider }),
      h(View, { style: styles.tableHeader },
        h(Text, { style: styles.colDesc }, 'Description'),
        h(Text, { style: styles.colAmount }, 'Amount')
      ),

      renderSectionHeader('Sales'),
      renderRow('Fuel Sales', data.fuelSales, false, null, true),
      renderRow('Fuel Price Overrides', data.fuelPriceOverrides, false, null, true),
      renderRow('Item Sales', data.itemSales, false, null, true),
      renderSubSectionHeader('Taxes'),
      renderRow('GST', data.gst, false, null, true),
      renderRow('PST', data.pst, false, null, true),
      renderRow('Penny Rounding', data.pennyRounding, false, null, true),
      renderRow('Total Sales', data.totalSales, true, null, false),

      renderSectionHeader('Over / Short'),
      renderRow('Ovr/Sh Cash', data.overShortCash, false, overShortStyle),
      ...(data.isManitoba ? [
        renderRow('Cash Collected', data.totalCanadianCashCollected, false, null, true),
        renderRow('Cash Reported', data.reportCanadianCash, false, null, true),
        renderRow('Cheques Cashed Out', data.chequesCashedOut, false, null, true)
      ] : []),
      ...(Math.abs(data.adjFuelVariance) > 0.01 ? [
        renderRow('Adj. Fuel', data.adjFuelVariance, false, null)
      ] : []),

      renderSectionHeader('Tenders'),
      ...Object.entries(data.tenders).map(([name, val]) => renderRow(name, val)),
      renderRow('Cash', data.reportCanadianCash),
      renderRow('Total Tenders', totalTenders, true),

      renderSectionHeader('Sale by Department'),
      renderRow('Merchandise Sales (Others)', data.merchandiseSalesOthers),
      renderRow('Tobacco Cig', data.tobaccoCig),
      renderRow('Tobacco Others', data.tobaccoOthers),
      renderRow('Propane Sales', data.propaneSales),
      renderRow('NIC Bingo Tickets', data.bingoSales),
      ...(data.sellsLottery ? [
        renderRow('Lottery Sales', data.lotterySales),
        renderRow('Lottery Payouts', data.lottoPayout)
      ] : []),

      renderSectionHeader('Fuel Sales by Grade'),
      h(View, { style: [styles.fuelGridRow, styles.fuelGridHeaderGroup, { marginTop: 4, paddingBottom: 0 }] },
        h(Text, { style: styles.fuelColDesc }, 'Description'),
        h(Text, { style: [styles.fuelColVal, { width: 104, textAlign: 'center', borderBottomWidth: 0.5, borderBottomColor: '#000000' }] }, 'Total Sales'),
        h(Text, { style: [styles.fuelColVal, { width: 104, textAlign: 'center', borderBottomWidth: 0.5, borderBottomColor: '#000000' }] }, 'Treaty Sales'),
        h(Text, { style: [styles.fuelColVal, { width: 104, textAlign: 'center', borderBottomWidth: 0.5, borderBottomColor: '#000000' }] }, 'Non-Treaty Sales'),
        h(Text, { style: [styles.fuelColWide, { fontWeight: 'bold', textAlign: 'right' }] }, 'Taxable'),
        h(Text, { style: [styles.fuelColWide, { fontWeight: 'bold', textAlign: 'right' }] }, 'Remittable')
      ),
      h(View, { style: [styles.fuelGridRow, { borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2, paddingTop: 1 }] },
        h(Text, { style: styles.fuelColDesc }, ''),
        h(Text, { style: styles.fuelColVal }, 'Liters'), h(Text, { style: styles.fuelColVal }, 'Amount'),
        h(Text, { style: styles.fuelColVal }, 'Liters'), h(Text, { style: styles.fuelColVal }, 'Amount'),
        h(Text, { style: styles.fuelColVal }, 'Liters'), h(Text, { style: styles.fuelColVal }, 'Amount'),
        h(Text, { style: styles.fuelColWide }, 'Non-Treaty'),
        h(Text, { style: styles.fuelColWide }, 'GST (5%)')
      ),
      Object.entries(data.fuelGrades).map(([grade, row]) =>
        h(View, { key: grade, style: styles.fuelGridRow },
          h(Text, { style: styles.fuelColDesc }, grade),
          h(Text, { style: styles.fuelColVal }, row.totalLitres.toFixed(3)),
          h(Text, { style: styles.fuelColVal }, formatCurrency(row.totalAmount)),
          h(Text, { style: styles.fuelColVal }, row.treatyLitres.toFixed(3)),
          h(Text, { style: styles.fuelColVal }, formatCurrency(row.treatyAmount)),
          h(Text, { style: styles.fuelColVal }, row.nonTreatyLitres.toFixed(3)),
          h(Text, { style: styles.fuelColVal }, formatCurrency(row.nonTreatyAmount)),
          h(Text, { style: styles.fuelColWide }, formatCurrency(row.taxableNonTreaty)),
          h(Text, { style: styles.fuelColWide }, formatCurrency(row.remittableGst))
        )
      ),
      h(View, { style: [styles.totalRow, { backgroundColor: '#F2F2F2', paddingVertical: 4, marginTop: 2 }] },
        h(Text, { style: [styles.fuelColDesc, styles.textBold] }, 'Grand Totals'),
        h(Text, { style: [styles.fuelColVal, styles.textBold] }, data.fuelRemittanceTotals.totalLitres.toFixed(3)),
        h(Text, { style: [styles.fuelColVal, styles.textBold] }, formatCurrency(data.fuelRemittanceTotals.totalAmount)),
        h(Text, { style: [styles.fuelColVal, styles.textBold] }, data.fuelRemittanceTotals.treatyLitres.toFixed(3)),
        h(Text, { style: [styles.fuelColVal, styles.textBold] }, formatCurrency(data.fuelRemittanceTotals.treatyAmount)),
        h(Text, { style: [styles.fuelColVal, styles.textBold] }, data.fuelRemittanceTotals.nonTreatyLitres.toFixed(3)),
        h(Text, { style: [styles.fuelColVal, styles.textBold] }, formatCurrency(data.fuelRemittanceTotals.nonTreatyAmount)),
        h(Text, { style: [styles.fuelColWide, styles.textBold] }, formatCurrency(data.fuelRemittanceTotals.taxableNonTreaty)),
        h(Text, { style: [styles.fuelColWide, styles.textBold] }, formatCurrency(data.fuelRemittanceTotals.remittableGst))
      )
    )
  );
}

function extractMoney(label, text) {
  const cleanLabel = label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\n)[\\s·]*${cleanLabel}[\\s·]*(-?\\$?([\\d,]+\\.\\d{2}))`, 'mi');
  const m = text.match(regex);
  const val = m ? parseFloat(m[1].replace(/\$/g, '').replace(/,/g, '')) : 0;
  if (m) console.log(`   -> [SCRAPED] ${label}: ${formatCurrency(val)}`); // formatted logs!
  return val;
}

// function parseFuelGradeLines(text, accumulatedGrades) {
//   const matches = [...text.matchAll(/([A-Za-z0-9\s|\-/]+)\s+(\d+\.\d{3})\s+\$?(-?[\d,]+\.\d{2})\s+(\d+\.\d{3})\s+\$?(-?[\d,]+\.\d{2})\s+(\d+\.\d{3})\s+\$?(-?[\d,]+\.\d{2})\s+\$?(-?[\d,]+\.\d{2})\s+\$?(-?[\d,]+\.\d{2})/g)];
//   matches.forEach(m => {
//     const desc = m[1].trim();
//     if (desc.toLowerCase().includes('grand total') || desc.toLowerCase().includes('description')) return;
//     if (!accumulatedGrades[desc]) {
//       accumulatedGrades[desc] = { totalLitres: 0, totalAmount: 0, treatyLitres: 0, treatyAmount: 0, nonTreatyLitres: 0, nonTreatyAmount: 0, taxableNonTreaty: 0, remittableGst: 0 };
//     }
//     accumulatedGrades[desc].totalLitres += parseFloat(m[2]);
//     accumulatedGrades[desc].totalAmount += parseFloat(m[3].replace(/,/g, ''));
//     accumulatedGrades[desc].treatyLitres += parseFloat(m[4]);
//     accumulatedGrades[desc].treatyAmount += parseFloat(m[5].replace(/,/g, ''));
//     accumulatedGrades[desc].nonTreatyLitres += parseFloat(m[6]);
//     accumulatedGrades[desc].nonTreatyAmount += parseFloat(m[7].replace(/,/g, ''));
//     accumulatedGrades[desc].taxableNonTreaty += parseFloat(m[8].replace(/,/g, ''));
//     accumulatedGrades[desc].remittableGst += parseFloat(m[9].replace(/,/g, ''));
//     console.log(`   -> [SCRAPED GRADE] ${desc} (Vol: ${m[2]}, Amt: ${m[3]})`);
//   });
// }
function parseFuelGradeLines(text, accumulatedGrades) {
  const matches = [...text.matchAll(/([A-Za-z0-9\s|\-/]+)\s+(\d+\.\d{3})\s+\$?(-?[\d,]+\.\d{2})\s+(\d+\.\d{3})\s+\$?(-?[\d,]+\.\d{2})\s+(\d+\.\d{3})\s+\$?(-?[\d,]+\.\d{2})\s+\$?(-?[\d,]+\.\d{2})\s+\$?(-?[\d,]+\.\d{2})/g)];
  
  matches.forEach(m => {
    let desc = m[1].trim();
    if (desc.toLowerCase().includes('grand total') || desc.toLowerCase().includes('description')) return;
    
    // FIX: Normalize variation flags like "Regular | E15" or "Regular-E15" to "Regular"
    if (/^Regular\s*[|/-]/i.test(desc)) {
      desc = 'Regular';
    }

    if (!accumulatedGrades[desc]) {
      accumulatedGrades[desc] = { totalLitres: 0, totalAmount: 0, treatyLitres: 0, treatyAmount: 0, nonTreatyLitres: 0, nonTreatyAmount: 0, taxableNonTreaty: 0, remittableGst: 0 };
    }
    
    accumulatedGrades[desc].totalLitres += parseFloat(m[2]);
    accumulatedGrades[desc].totalAmount += parseFloat(m[3].replace(/,/g, ''));
    accumulatedGrades[desc].treatyLitres += parseFloat(m[4]);
    accumulatedGrades[desc].treatyAmount += parseFloat(m[5].replace(/,/g, ''));
    accumulatedGrades[desc].nonTreatyLitres += parseFloat(m[6]);
    accumulatedGrades[desc].nonTreatyAmount += parseFloat(m[7].replace(/,/g, ''));
    accumulatedGrades[desc].taxableNonTreaty += parseFloat(m[8].replace(/,/g, ''));
    accumulatedGrades[desc].remittableGst += parseFloat(m[9].replace(/,/g, ''));
    
    console.log(`   -> [SCRAPED GRADE] ${desc} (Vol: ${m[2]}, Amt: ${m[3]})`);
  });
}

async function aggregateJuneReports() {
  const site = "Wavers West";
  
  // Using path.resolve to auto-correct Windows/Linux backslash formatting anomalies cleanly
  // Binds the directory lookup relative to where this running script lives
  const baseDir = path.join(__dirname, 'Wavers Reports', 'Wavers West');  
  console.log(`[INIT] Base lookup target path resolved to: "${baseDir}"`);

  const masterData = {
    isManitoba: true, sellsLottery: true,
    fuelSales: 0, fuelPriceOverrides: 0, itemSales: 0, gst: 0, pst: 0, pennyRounding: 0, totalSales: 0,
    totalCanadianCashCollected: 0, reportCanadianCash: 0, chequesCashedOut: 0, overShortCash: 0, adjFuelVariance: 0,
    tenders: {}, fuelGrades: {}, tobaccoCig: 0, tobaccoOthers: 0, propaneSales: 0, bingoSales: 0, lotterySales: 0, lottoPayout: 0, merchandiseSalesOthers: 0,
    fuelRemittanceTotals: { totalLitres: 0, totalAmount: 0, treatyLitres: 0, treatyAmount: 0, nonTreatyLitres: 0, nonTreatyAmount: 0, taxableNonTreaty: 0, remittableGst: 0 }
  };

  let filesFoundCount = 0;

  for (let day = 1; day <= 30; day++) {
    const dayStr = String(day).padStart(2, '0');
    const folderDate = `2026-06-${dayStr}`;
    const filePath = path.join(baseDir, folderDate, `End-of-Day-Report-${site}-${folderDate}.pdf`);

    console.log(`[CHECKING DAY ${dayStr}] Path: "${filePath}"`);

    if (!fs.existsSync(filePath)) {
      console.log(`   -> [SKIP] File does not exist.`);
      continue;
    }

    filesFoundCount++;
    console.log(`   -> [FOUND] Starting binary parse parsing sequence...`);

    try {
      const dataBuffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(dataBuffer);
      const txt = parsed.text;

      if (!txt || txt.trim().length === 0) {
        console.log(`   -> [WARNING] PDF parsed but returned empty text layout content.`);
        continue;
      }

      console.log(`   -> [PARSING FIELDS] Length of text buffer stream: ${txt.length} chars.`);

      masterData.fuelSales += extractMoney('Fuel Sales', txt);
      masterData.fuelPriceOverrides += extractMoney('Fuel Price Overrides', txt);
      masterData.itemSales += extractMoney('Item Sales', txt);
      masterData.gst += extractMoney('GST', txt);
      masterData.pst += extractMoney('PST', txt);
      masterData.pennyRounding += extractMoney('Penny Rounding', txt);
      masterData.totalSales += extractMoney('Total Sales', txt);
      masterData.overShortCash += extractMoney('Ovr/Sh Cash', txt);
      masterData.totalCanadianCashCollected += extractMoney('Cash Collected', txt);
      masterData.reportCanadianCash += extractMoney('Cash Reported', txt);
      masterData.chequesCashedOut += extractMoney('Cheques Cashed Out', txt);

      // Parse individual dynamic tenders
      const tenderBlock = txt.match(/Tenders[\s\S]*?(?=Sale by Department)/i);
      if (tenderBlock) {
        const lines = tenderBlock[0].split('\n');
        
        // Define a strict whitelist of allowed standard tender categories
        const allowedTenders = ['DEBIT', 'VISA', 'MASTERCARD', 'AMEX'];

        lines.forEach(l => {
          const m = l.match(/^[\s·]*([A-Z_\s0-9/-]+)\s+\$?(-?[\d,]+\.\d{2})/i);
          if (m) {
            const tName = m[1].trim().toUpperCase();
            
            // Only aggregate if it's explicitly in our allowed whitelist array
            if (allowedTenders.includes(tName)) {
              const val = parseFloat(m[2].replace(/,/g, ''));
              masterData.tenders[tName] = (masterData.tenders[tName] || 0) + val;
              console.log(`   -> [SCRAPED TENDER] ${tName}: $${val}`);
            } else {
              console.log(`   -> [FILTERED OUT A/R OR INVALID TENDER]: ${tName}`);
            }
          }
        });
      }

      masterData.merchandiseSalesOthers += extractMoney('Merchandise Sales \\(Others\\)', txt);
      masterData.tobaccoCig += extractMoney('Tobacco Cig', txt);
      masterData.tobaccoOthers += extractMoney('Tobacco Others', txt);
      masterData.propaneSales += extractMoney('Propane Sales', txt);
      masterData.bingoSales += extractMoney('NIC Bingo Tickets', txt);
      masterData.lotterySales += extractMoney('Lottery Sales', txt);
      masterData.lottoPayout += extractMoney('Lottery Payouts', txt);

      // Extract matrix components
      parseFuelGradeLines(txt, masterData.fuelGrades);

    } catch (err) {
      console.error(`   -> [CRITICAL PARSE ERROR] On date ${folderDate}:`, err.message);
    }
  }

  console.log(`[PROCESSING SUMMARY] Sequence finished. Total valid files scraped: ${filesFoundCount}`);

  if (filesFoundCount === 0) {
    console.error("[ABORT] No files were found or parsed. Please check if the script has access to the directory path printed above.");
    return;
  }

  // Re-calculate derived totals over the accumulated collection matrix
  Object.values(masterData.fuelGrades).forEach(row => {
    masterData.fuelRemittanceTotals.totalLitres += row.totalLitres;
    masterData.fuelRemittanceTotals.totalAmount += row.totalAmount;
    masterData.fuelRemittanceTotals.treatyLitres += row.treatyLitres;
    masterData.fuelRemittanceTotals.treatyAmount += row.treatyAmount;
    masterData.fuelRemittanceTotals.nonTreatyLitres += row.nonTreatyLitres;
    masterData.fuelRemittanceTotals.nonTreatyAmount += row.nonTreatyAmount;
    masterData.fuelRemittanceTotals.taxableNonTreaty += row.taxableNonTreaty;
    masterData.fuelRemittanceTotals.remittableGst += row.remittableGst;
  });

  const adjFuelCalculated = masterData.fuelSales + masterData.fuelPriceOverrides;
  masterData.adjFuelVariance = masterData.fuelRemittanceTotals.totalAmount - adjFuelCalculated;

  // Render out the accumulated unified report document file
  const outPath = path.join(__dirname, 'Cumulative-Report-Wavers-West-June-2026.pdf');
  console.log(`[GENERATING PDF] Dispatching compiler stream to: "${outPath}"...`);
  
  try {
    const buffer = await renderToBuffer(h(CumulativeReportDoc, { 
      site, 
      period: "June 10, 2026 - June 30, 2026", 
      data: masterData 
    }));
    
    fs.writeFileSync(outPath, buffer);
    console.log(`\n==================================================================`);
    console.log(`SUCCESS: Cumulative PDF Report safely written out to: ${outPath}`);
    console.log(`==================================================================`);
  } catch (renderError) {
    console.error("[CRITICAL RENDER ERROR] Failed during PDF layout rendering engine sequence:", renderError);
  }
}

// Global formatter for standard Canadian dollar currency representation
const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  
  const formatter = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return value >= 0 
    ? `$${formatter.format(value)}` 
    : `-$${formatter.format(Math.abs(value))}`;
};

aggregateJuneReports();