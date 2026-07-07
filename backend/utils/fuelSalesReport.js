// backend\utils\fuelSalesReport.js
const React = require('react');
const { pdf, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer');

const h = React.createElement;

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottom: '1 solid #000', paddingBottom: 10 },
  leftHeader: { flexDirection: 'column' },
  rightHeader: { flexDirection: 'column', alignItems: 'flex-end', fontSize: 8 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  metaText: { fontSize: 9, color: '#333', marginBottom: 2 },

  // Table Layout Styles
  table: { width: '100%', flexDirection: 'column' },
  tableHeaderGroup: { borderBottom: '1 solid #000', paddingBottom: 3, marginBottom: 4, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottom: '0.5 solid #E0E0E0', alignItems: 'center' },
  totalRow: { flexDirection: 'row', paddingVertical: 6, borderTop: '1.5 solid #000', borderBottom: '1.5 solid #000', marginTop: 4, fontWeight: 'bold' },

  // Column Width Definition (Total 100%)
  colDesc: { width: '12%', textAlign: 'left' },
  colDate: { width: '10%', textAlign: 'left' },
  colVal: { width: '9%', textAlign: 'right', paddingRight: 4 }
});

function FuelSalesDocument({ data }) {
  const { location, detailedRows, totals, period } = data;

  return h(Document, {},
    h(Page, { size: 'LETTER', orientation: 'landscape', style: styles.page },
      // Header Section
      h(View, { style: styles.headerContainer },
        h(View, { style: styles.leftHeader },
          h(Text, { style: styles.title }, `Fuel Sales and GST Remittance Report`),
          h(Text, { style: styles.metaText }, `Station: ${location.stationName}`),
          h(Text, { style: styles.metaText }, `Period: ${period.start} to ${period.end}`),
          h(Text, { style: styles.metaText }, `Printed: ${new Date().toLocaleString()}`)
        ),
        h(View, { style: styles.rightHeader },
          h(Text, { style: { fontWeight: 'bold' } }, location.legalName || location.stationName),
          h(Text, {}, location.address || ''),
          h(Text, {}, `${location.province || ''}`),
          h(Text, {}, `CSO: ${location.csoCode}`)
        )
      ),

      // Data Table Section
      h(View, { style: styles.table },
        // Category Tier Multi-Header Row
        h(View, { style: [styles.row, styles.tableHeaderGroup] },
          h(Text, { style: styles.colDesc }, 'Description'),
          h(Text, { style: styles.colDate }, 'Date'),
          h(Text, { style: [styles.colVal, { width: '18%', textAlign: 'center', borderBottom: '0.5 solid #000' }] }, 'Total Sales'),
          h(Text, { style: [styles.colVal, { width: '18%', textAlign: 'center', borderBottom: '0.5 solid #000' }] }, 'Treaty Sales'),
          h(Text, { style: [styles.colVal, { width: '18%', textAlign: 'center', borderBottom: '0.5 solid #000' }] }, 'Non-Treaty Sales'),
          h(Text, { style: [styles.colVal, { width: '11%', textAlign: 'right' }] }, 'Taxable'),
          h(Text, { style: [styles.colVal, { width: '13%', textAlign: 'right' }] }, 'Remittable')
        ),

        // Explicit Sub-Header Row
        h(View, { style: [styles.row, { borderBottom: '1 solid #000', paddingBottom: 2 }] },
          h(Text, { style: styles.colDesc }, ''),
          h(Text, { style: styles.colDate }, ''),
          h(Text, { style: styles.colVal }, 'Liters'),
          h(Text, { style: styles.colVal }, 'Amount'),
          h(Text, { style: styles.colVal }, 'Liters'),
          h(Text, { style: styles.colVal }, 'Amount'),
          h(Text, { style: styles.colVal }, 'Liters'),
          h(Text, { style: styles.colVal }, 'Amount'),
          h(Text, { style: [styles.colVal, { width: '11%' }] }, 'Non-Treaty'),
          h(Text, { style: [styles.colVal, { width: '13%' }] }, 'GST (5%)')
        ),

        // Dynamic Line Items Array Mapping
        detailedRows.map((row, i) =>
          h(View, { key: i, style: styles.row },
            h(Text, { style: styles.colDesc }, row.description),
            h(Text, { style: styles.colDate }, row.date),
            h(Text, { style: styles.colVal }, row.totalLitres.toFixed(3)), // 3 Decimals for Volume
            h(Text, { style: styles.colVal }, `$${row.totalAmount.toFixed(2)}`),
            h(Text, { style: styles.colVal }, row.treatyLitres.toFixed(3)), // 3 Decimals for Volume
            h(Text, { style: styles.colVal }, `$${row.treatyAmount.toFixed(2)}`),
            h(Text, { style: styles.colVal }, row.nonTreatyLitres.toFixed(3)), // 3 Decimals for Volume
            h(Text, { style: styles.colVal }, `$${row.nonTreatyAmount.toFixed(2)}`),
            h(Text, { style: [styles.colVal, { width: '11%' }] }, `$${row.taxableNonTreaty.toFixed(2)}`),
            h(Text, { style: [styles.colVal, { width: '13%' }] }, `$${row.remittableGst.toFixed(2)}`)
          )
        ),

        // Grand Totals Bottom Row
        h(View, { style: styles.totalRow },
          h(Text, { style: [styles.colDesc, { fontWeight: 'bold' }] }, 'Grand Totals'),
          h(Text, { style: styles.colDate }, ''),
          h(Text, { style: styles.colVal }, totals.totalLitres.toFixed(3)),
          h(Text, { style: styles.colVal }, `$${totals.totalAmount.toFixed(2)}`),
          h(Text, { style: styles.colVal }, totals.treatyLitres.toFixed(3)),
          h(Text, { style: `$${totals.treatyAmount.toFixed(2)}`, style: styles.colVal }),
          h(Text, { style: styles.colVal }, totals.nonTreatyLitres.toFixed(3)),
          h(Text, { style: `$${totals.nonTreatyAmount.toFixed(2)}`, style: styles.colVal }),
          h(Text, { style: [styles.colVal, { width: '11%' }] }, `$${totals.taxableNonTreaty.toFixed(2)}`),
          h(Text, { style: [styles.colVal, { width: '13%' }] }, `$${totals.remittableGst.toFixed(2)}`)
        )
      )
    )
  );
}

/**
 * Builds the PDF buffer from structured payload data
 */
async function generateFuelSalesReportPdfBuffer(payload) {
  const doc = h(FuelSalesDocument, { data: payload });
  return await pdf(doc).toBuffer();
}

module.exports = {
  generateFuelSalesReportPdfBuffer
};