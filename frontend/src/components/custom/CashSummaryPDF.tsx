import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from '@react-pdf/renderer';
import { calculateData } from '@/lib/utils';

// Helper for date formatting
const formatDate = (dateStr: string | Date) => {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d ? d.toLocaleDateString('en-CA', {
    timeZone: localStorage.getItem('timezone') || 'America/Toronto',
  }) : '';
};

const truncate = (str: string, max = 400) =>
  str && str.length > max ? str.slice(0, max) + '…' : str;

// Dashed border style for all tables
const dashedBorder = '1pt dashed #bbb';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  logo: { width: 120, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', marginVertical: 8 },
  summaryTable: { width: '100%', marginBottom: 12 },
  summaryRow: { flexDirection: 'row' },
  summaryCell: { border: dashedBorder, padding: 6, width: '25%', textAlign: 'center' },
  summaryCellHeader: { fontWeight: 'bold', backgroundColor: '#f3f3f3' },
  summaryCellTotal: { fontWeight: 'bold', backgroundColor: '#fafafa' },
  summarySection: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  kvTable: { width: '50%', minWidth: 220, maxWidth: 300 },
  kvRow: { flexDirection: 'row' },
  kvKey: { border: dashedBorder, padding: 4, width: '60%', backgroundColor: '#fafafa' },
  kvValue: { border: dashedBorder, padding: 4, width: '40%' },
  notesBoxWrapper: { width: '50%', paddingLeft: 12, justifyContent: 'flex-start' },
  notesBox: { border: dashedBorder, minHeight: 40, padding: 6, backgroundColor: '#fafafa', width: '100%' },
  // Fixed width columns for AR/AP tables
  arapTable: { width: '100%', tableLayout: 'fixed', marginVertical: 8 },
  arapRow: { flexDirection: 'row' },
  arapCell: { border: dashedBorder, padding: 4, textAlign: 'center' },
  arapCellCustomer: { width: '30%' },
  arapCellProduct: { width: '20%' },
  arapCellQty: { width: '20%' },
  arapCellAmount: { width: '30%' },
  arapCellVendor: { width: '25%' },
  arapCellMethod: { width: '20%' },
  arapCellNotes: { width: '35%' },
  arapCellPayAmount: { width: '20%' },
  tableCellBold: { fontWeight: 'bold', backgroundColor: '#f3f3f3' },
  totalRow: { fontWeight: 'bold', backgroundColor: '#f3f3f3' },
  worksheetHeader: { fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  small: { fontSize: 9 },
  // Worksheet float/drops/other details layout
  wsRow: { flexDirection: 'row', width: '100%' },
  wsCol: { width: '50%' },
  wsTable: { width: '100%', marginVertical: 8 },
  wsTableRow: { flexDirection: 'row' },
  wsTableCell: { border: dashedBorder, padding: 4, flex: 1, textAlign: 'center' },
  wsTableCellBold: { fontWeight: 'bold', backgroundColor: '#f3f3f3', flex: 1, textAlign: 'center', border: dashedBorder, padding: 4 },
  wsSectionTitle: { fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  wsSubTable: { width: '100%', marginBottom: 8 },
  wsSubTableRow: { flexDirection: 'row' },
  wsSubTableCell: { border: dashedBorder, padding: 3, flex: 1, textAlign: 'center', fontSize: 10 },
  wsSubTableCellBold: { fontWeight: 'bold', backgroundColor: '#f3f3f3', flex: 1, textAlign: 'center', border: dashedBorder, padding: 3, fontSize: 10 },
  wsOtherDetailsTable: { width: '100%', marginBottom: 8 },
  wsOtherDetailsRow: { flexDirection: 'row' },
  wsOtherDetailsKey: { border: dashedBorder, padding: 4, width: '50%', backgroundColor: '#fafafa', fontSize: 10 },
  wsOtherDetailsValue: { border: dashedBorder, padding: 4, width: '50%', fontSize: 10 },
  wsNotesBox: { border: dashedBorder, minHeight: 40, padding: 6, backgroundColor: '#fafafa', width: '100%', fontSize: 10 }
});

// Group worksheets by report_number
function groupWorksheets(worksheets: any[]) {
  const grouped: Record<string, any> = {};
  worksheets.forEach(ws => {
    const key = ws.report_number;
    if (!grouped[key]) grouped[key] = {};
    grouped[key][ws.shift] = ws;
  });
  return grouped;
}

export function CashSummaryPDF({ data, date, location, totals, purchaseOrderTotal, payablesTotal }: any) {
  // Group worksheet data for summary table
  const grouped = groupWorksheets(data.worksheets || []);
  const summaryRows = Object.entries(grouped).map(([reportNum, shifts]: any) => {
    const am = shifts.AM || null;
    const pm = shifts.PM || null;
    const amCalculated = am ? calculateData(am) : null;
    const pmCalculated = pm ? calculateData(pm) : null;
    return {
      reportNum,
      am,
      pm,
      canadianCash: (am?.shift_report_cash || 0) + (pm?.shift_report_cash || 0),
      amCash: amCalculated?.totalCash || 0,
      pmCash: pmCalculated?.totalCash || 0,
      totalCash: (amCalculated?.totalCash || 0) + (pmCalculated?.totalCash || 0)
    };
  });

  // Calculate the number of rows in the key-value table for height matching
  const kvRowCount = 5; // Shift Report Cash, Handheld Debit, Net Total Cash, Total Calculated Cash, Total Over/Short Amount
  const kvRowHeight = 18; // Approximate row height in px for PDF
  const kvTableHeight = kvRowCount * kvRowHeight; // Add some padding

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
          Cash Summary
        </Text>
        <View style={styles.header}>
          <Image src='/logo.png' style={styles.logo} />
          <View>
            <Text>Station: {location}</Text>
            <Text>Date: {formatDate(date)}</Text>
          </View>
        </View>

        {/* Main Summary Table */}
        <View style={styles.summaryTable}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryCell, styles.summaryCellHeader]}>Canadian Cash</Text>
            <Text style={[styles.summaryCell, styles.summaryCellHeader]}>AM</Text>
            <Text style={[styles.summaryCell, styles.summaryCellHeader]}>PM</Text>
            <Text style={[styles.summaryCell, styles.summaryCellHeader]}>Total</Text>
          </View>
          {summaryRows.map((row, idx) => (
            <View style={styles.summaryRow} key={idx}>
              <Text style={styles.summaryCell}>${row.canadianCash.toFixed(2)}</Text>
              <Text style={styles.summaryCell}>{row.am ? `$${row.amCash.toFixed(2)}` : '-'}</Text>
              <Text style={styles.summaryCell}>{row.pm ? `$${row.pmCash.toFixed(2)}` : '-'}</Text>
              <Text style={styles.summaryCell}>${row.totalCash.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryCell, styles.summaryCellTotal]}>${totals.totalShiftReportCash.toFixed(2)}</Text>
            <Text style={styles.summaryCell}></Text>
            <Text style={styles.summaryCell}></Text>
            <Text style={[styles.summaryCell, styles.summaryCellTotal]}>${totals.totalCalculatedCash.toFixed(2)}</Text>
          </View>
        </View>

        {/* Side-by-side: Key-Value Table and Manager's Notes */}
        <View style={styles.summarySection}>
          <View style={styles.kvTable}>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Shift Report Cash</Text>
              <Text style={styles.kvValue}>{totals.totalShiftReportCash.toFixed(2)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Handheld Debit</Text>
              <Text style={styles.kvValue}>{data.cash_summary?.hand_held_debit || 0}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Net Total Cash</Text>
              <Text style={styles.kvValue}>{(totals.totalShiftReportCash - (data.cash_summary?.hand_held_debit || 0)).toFixed(2)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Total Calculated Cash</Text>
              <Text style={styles.kvValue}>{totals.totalCalculatedCash.toFixed(2)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Total Over/Short Amount</Text>
              <Text style={styles.kvValue}>{(totals.totalOverShort - (data.cash_summary?.hand_held_debit || 0)).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.notesBoxWrapper}>
            <Text>Manager's Notes</Text>
            <Text
              style={{
                ...styles.notesBox,
                minHeight: kvTableHeight
              }}
            >
              {truncate(data.cash_summary?.managers_notes || '', 600)}
            </Text>
          </View>
        </View>

        {/* Accounts Receivable */}
        <Text style={styles.sectionTitle}>Accounts Receivable</Text>
        <View style={styles.arapTable}>
          <View style={styles.arapRow}>
            <Text style={[styles.arapCell, styles.arapCellCustomer, styles.tableCellBold]}>Customer Name</Text>
            <Text style={[styles.arapCell, styles.arapCellProduct, styles.tableCellBold]}>Product</Text>
            <Text style={[styles.arapCell, styles.arapCellQty, styles.tableCellBold]}>Quantity</Text>
            <Text style={[styles.arapCell, styles.arapCellAmount, styles.tableCellBold]}>Amount</Text>
          </View>
          {data.purchase_orders.map((po: any, idx: number) => (
            <View style={styles.arapRow} key={po._id || idx}>
              <Text style={[styles.arapCell, styles.arapCellCustomer]}>{po.customerName}</Text>
              <Text style={[styles.arapCell, styles.arapCellProduct]}>{po.productCode}</Text>
              <Text style={[styles.arapCell, styles.arapCellQty]}>{po.quantity}</Text>
              <Text style={[styles.arapCell, styles.arapCellAmount]}>${po.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.arapRow}>
            <Text style={[styles.arapCell, styles.arapCellCustomer, styles.tableCellBold]}>Total Accounts Receivable:</Text>
            <Text style={[styles.arapCell, styles.arapCellProduct, styles.tableCellBold]}></Text>
            <Text style={[styles.arapCell, styles.arapCellQty, styles.tableCellBold]}></Text>
            <Text style={[styles.arapCell, styles.arapCellAmount, styles.tableCellBold]}>${purchaseOrderTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Accounts Payable */}
        <Text style={styles.sectionTitle}>Accounts Payable</Text>
        <View style={styles.arapTable}>
          <View style={styles.arapRow}>
            <Text style={[styles.arapCell, styles.arapCellVendor, styles.tableCellBold]}>Vendor Name</Text>
            <Text style={[styles.arapCell, styles.arapCellMethod, styles.tableCellBold]}>Payment Method</Text>
            <Text style={[styles.arapCell, styles.arapCellNotes, styles.tableCellBold]}>Notes</Text>
            <Text style={[styles.arapCell, styles.arapCellPayAmount, styles.tableCellBold]}>Amount</Text>
          </View>
          {data.payables.map((payable: any, idx: number) => (
            <View style={styles.arapRow} key={payable._id || idx}>
              <Text style={[styles.arapCell, styles.arapCellVendor]}>{payable.vendorName}</Text>
              <Text style={[styles.arapCell, styles.arapCellMethod]}>{payable.paymentMethod}</Text>
              <Text style={[styles.arapCell, styles.arapCellNotes]}>{truncate(payable.notes || '', 100)}</Text>
              <Text style={[styles.arapCell, styles.arapCellPayAmount]}>${payable.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.arapRow}>
            <Text style={[styles.arapCell, styles.arapCellVendor, styles.tableCellBold]}>Total Accounts Payable:</Text>
            <Text style={[styles.arapCell, styles.arapCellMethod, styles.tableCellBold]}></Text>
            <Text style={[styles.arapCell, styles.arapCellNotes, styles.tableCellBold]}></Text>
            <Text style={[styles.arapCell, styles.arapCellPayAmount, styles.tableCellBold]}>${payablesTotal.toFixed(2)}</Text>
          </View>
        </View>
      </Page>

      {/* Shift Worksheet Pages */}
      {data.worksheets.map((ws: any, idx: number) => (
        <Page size="A4" style={styles.page} key={ws._id || idx}>
          <View style={styles.header}>
            <Image src='/logo.png' style={styles.logo} />
            <View>
              <Text>Station: {ws.location}</Text>
              <Text>Date: {formatDate(ws.date)}</Text>
            </View>
          </View>
          <Text style={styles.worksheetHeader}>
            Shift Worksheet - Report #{ws.report_number} ({ws.shift})
          </Text>

          {/* Floats & Drops Layout */}
          <View style={styles.wsRow}>
            {/* Opening Float (Left, 50%) */}
            <View style={styles.wsCol}>
              <Text style={styles.wsSectionTitle}>Opening Float</Text>
              {/* Bills */}
              <View style={styles.wsSubTable}>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Bill</Text>
                  <Text style={styles.wsSubTableCellBold}>Count</Text>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$5</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.bill?.five ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.bill?.five ?? 0) * 5).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$10</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.bill?.ten ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.bill?.ten ?? 0) * 10).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$20</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.bill?.twenty ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.bill?.twenty ?? 0) * 20).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$50</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.bill?.fifty ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.bill?.fifty ?? 0) * 50).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$100</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.bill?.hundred ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.bill?.hundred ?? 0) * 100).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                  <Text style={styles.wsSubTableCell}></Text>
                  <Text style={styles.wsSubTableCellBold}>
                    ${(
                      (ws.opening_float?.bill?.five ?? 0) * 5 +
                      (ws.opening_float?.bill?.ten ?? 0) * 10 +
                      (ws.opening_float?.bill?.twenty ?? 0) * 20 +
                      (ws.opening_float?.bill?.fifty ?? 0) * 50 +
                      (ws.opening_float?.bill?.hundred ?? 0) * 100
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
              {/* Change */}
              <View style={styles.wsSubTable}>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Change</Text>
                  <Text style={styles.wsSubTableCellBold}>Count</Text>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$2</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.change?.two ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.change?.two ?? 0) * 2).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$1</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.change?.one ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.change?.one ?? 0) * 1).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>25¢</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.change?.quarter ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.change?.quarter ?? 0) * 0.25).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>10¢</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.change?.dime ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.change?.dime ?? 0) * 0.10).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>5¢</Text>
                  <Text style={styles.wsSubTableCell}>{ws.opening_float?.change?.nickel ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.opening_float?.change?.nickel ?? 0) * 0.05).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                  <Text style={styles.wsSubTableCell}></Text>
                  <Text style={styles.wsSubTableCellBold}>
                    ${(
                      (ws.opening_float?.change?.two ?? 0) * 2 +
                      (ws.opening_float?.change?.one ?? 0) * 1 +
                      (ws.opening_float?.change?.quarter ?? 0) * 0.25 +
                      (ws.opening_float?.change?.dime ?? 0) * 0.10 +
                      (ws.opening_float?.change?.nickel ?? 0) * 0.05
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.wsSubTableRow}>
                <Text style={styles.wsSubTableCellBold}>Opening Cash</Text>
                <Text style={styles.wsSubTableCell}></Text>
                <Text style={styles.wsSubTableCellBold}>
                  ${(
                    (ws.opening_float?.bill?.five ?? 0) * 5 +
                    (ws.opening_float?.bill?.ten ?? 0) * 10 +
                    (ws.opening_float?.bill?.twenty ?? 0) * 20 +
                    (ws.opening_float?.bill?.fifty ?? 0) * 50 +
                    (ws.opening_float?.bill?.hundred ?? 0) * 100 +
                    (ws.opening_float?.change?.two ?? 0) * 2 +
                    (ws.opening_float?.change?.one ?? 0) * 1 +
                    (ws.opening_float?.change?.quarter ?? 0) * 0.25 +
                    (ws.opening_float?.change?.dime ?? 0) * 0.10 +
                    (ws.opening_float?.change?.nickel ?? 0) * 0.05
                  ).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.wsSectionTitle}>Drops</Text>
              <View style={styles.wsSubTable}>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Time</Text>
                  <Text style={styles.wsSubTableCellBold}>Amount</Text>
                  <Text style={styles.wsSubTableCellBold}>Initials</Text>
                </View>
                {ws.drops && ws.drops.length > 0 ? ws.drops.map((drop: any, i: number) => (
                  <View style={styles.wsSubTableRow} key={drop._id || i}>
                    <Text style={styles.wsSubTableCell}>{drop.time}</Text>
                    <Text style={styles.wsSubTableCell}>${drop.amount.toFixed(2)}</Text>
                    <Text style={styles.wsSubTableCell}>{drop.initials}</Text>
                  </View>
                )) : (
                  <View style={styles.wsSubTableRow}>
                    <Text style={styles.wsSubTableCell}>No drops</Text>
                    <Text style={styles.wsSubTableCell}></Text>
                    <Text style={styles.wsSubTableCell}></Text>
                  </View>
                )}
              </View>
            </View>


            {/* Closing Float (Right, 50%) */}
            <View style={styles.wsCol}>
              <Text style={styles.wsSectionTitle}>Closing Float</Text>
              {/* Bills */}
              <View style={styles.wsSubTable}>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Bill</Text>
                  <Text style={styles.wsSubTableCellBold}>Count</Text>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$5</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.bill?.five ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.bill?.five ?? 0) * 5).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$10</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.bill?.ten ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.bill?.ten ?? 0) * 10).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$20</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.bill?.twenty ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.bill?.twenty ?? 0) * 20).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$50</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.bill?.fifty ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.bill?.fifty ?? 0) * 50).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$100</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.bill?.hundred ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.bill?.hundred ?? 0) * 100).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                  <Text style={styles.wsSubTableCell}></Text>
                  <Text style={styles.wsSubTableCellBold}>
                    ${(
                      (ws.closing_float?.bill?.five ?? 0) * 5 +
                      (ws.closing_float?.bill?.ten ?? 0) * 10 +
                      (ws.closing_float?.bill?.twenty ?? 0) * 20 +
                      (ws.closing_float?.bill?.fifty ?? 0) * 50 +
                      (ws.closing_float?.bill?.hundred ?? 0) * 100
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
              {/* Change */}
              <View style={styles.wsSubTable}>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Change</Text>
                  <Text style={styles.wsSubTableCellBold}>Count</Text>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$2</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.change?.two ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.change?.two ?? 0) * 2).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>$1</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.change?.one ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.change?.one ?? 0) * 1).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>25¢</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.change?.quarter ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.change?.quarter ?? 0) * 0.25).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>10¢</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.change?.dime ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.change?.dime ?? 0) * 0.10).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCell}>5¢</Text>
                  <Text style={styles.wsSubTableCell}>{ws.closing_float?.change?.nickel ?? 0}</Text>
                  <Text style={styles.wsSubTableCell}>${((ws.closing_float?.change?.nickel ?? 0) * 0.05).toFixed(2)}</Text>
                </View>
                <View style={styles.wsSubTableRow}>
                  <Text style={styles.wsSubTableCellBold}>Total</Text>
                  <Text style={styles.wsSubTableCell}></Text>
                  <Text style={styles.wsSubTableCellBold}>
                    ${(
                      (ws.closing_float?.change?.two ?? 0) * 2 +
                      (ws.closing_float?.change?.one ?? 0) * 1 +
                      (ws.closing_float?.change?.quarter ?? 0) * 0.25 +
                      (ws.closing_float?.change?.dime ?? 0) * 0.10 +
                      (ws.closing_float?.change?.nickel ?? 0) * 0.05
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.wsSubTableRow}>
                <Text style={[styles.wsSubTableCellBold, { flex: 2 }]}>Closing Cash</Text>
                <Text style={styles.wsSubTableCellBold}>
                  ${(
                    (ws.closing_float?.bill?.five ?? 0) * 5 +
                    (ws.closing_float?.bill?.ten ?? 0) * 10 +
                    (ws.closing_float?.bill?.twenty ?? 0) * 20 +
                    (ws.closing_float?.bill?.fifty ?? 0) * 50 +
                    (ws.closing_float?.bill?.hundred ?? 0) * 100 +
                    (ws.closing_float?.change?.two ?? 0) * 2 +
                    (ws.closing_float?.change?.one ?? 0) * 1 +
                    (ws.closing_float?.change?.quarter ?? 0) * 0.25 +
                    (ws.closing_float?.change?.dime ?? 0) * 0.10 +
                    (ws.closing_float?.change?.nickel ?? 0) * 0.05
                  ).toFixed(2)}
                </Text>
              </View>
              {/* Closing Float Extra Values */}
              <View style={styles.wsOtherDetailsTable}>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={[styles.wsOtherDetailsKey, { width: '66.66%' }]}>Float Returned to Bag</Text>
                  <Text style={[styles.wsOtherDetailsValue, { width: '33.33%' }]}>${ws.float_returned_to_bag?.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={[styles.wsOtherDetailsKey, { width: '66.66%' }]}>Total Cash for Deposit</Text>
                  <Text style={[styles.wsOtherDetailsValue, { width: '33.33%' }]}>${ws.total_cash_for_deposit?.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={[styles.wsOtherDetailsKey, { width: '66.66%' }]}>Total Drops</Text>
                  <Text style={[styles.wsOtherDetailsValue, { width: '33.33%' }]}>${ws.total_drops?.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={[styles.wsOtherDetailsKey, { width: '66.66%' }]}>Total Cash</Text>
                  <Text style={[styles.wsOtherDetailsValue, { width: '33.33%' }]}>${ws.total_cash?.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={[styles.wsOtherDetailsKey, { width: '66.66%' }]}>Shift Report Cash</Text>
                  <Text style={[styles.wsOtherDetailsValue, { width: '33.33%' }]}>${ws.shift_report_cash?.toFixed(2) ?? '0.00'}</Text>
                </View>
              </View>
            </View>
          </View>
          {/* Other Details & Notes side by side */}
          <View style={styles.wsRow}>
            <View style={styles.wsCol}>
              <Text style={styles.wsSectionTitle}>Other Details</Text>
              <View style={styles.wsOtherDetailsTable}>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={styles.wsOtherDetailsKey}>Shift Lead</Text>
                  <Text style={styles.wsOtherDetailsValue}>{ws.shift_lead}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={styles.wsOtherDetailsKey}>Over Amount</Text>
                  <Text style={styles.wsOtherDetailsValue}>${ws.over_short_amount?.toFixed(2) ?? '0.00'}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={styles.wsOtherDetailsKey}>Void</Text>
                  <Text style={styles.wsOtherDetailsValue}>{ws.void ?? 0}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={styles.wsOtherDetailsKey}>Abandoned Change</Text>
                  <Text style={styles.wsOtherDetailsValue}>{ws.abandoned_change}</Text>
                </View>
                <View style={styles.wsOtherDetailsRow}>
                  <Text style={styles.wsOtherDetailsKey}>Unsettled Prepay</Text>
                  <Text style={styles.wsOtherDetailsValue}>{ws.unsettled_prepay}</Text>
                </View>
              </View>
            </View>
            <View style={styles.wsCol}>
              <Text style={styles.wsSectionTitle}>Notes</Text>
              <Text style={styles.wsNotesBox}>{truncate(ws.notes || '', 400)}</Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}