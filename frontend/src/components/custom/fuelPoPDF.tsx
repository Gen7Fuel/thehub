import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Helper to format: April 10th, 2026 or April 10th
export const formatPDFDate = (dateStr: string, includeYear: boolean = true) => {
  if (!dateStr) return "";
  // Ensure we don't have timezone shifts by adding time
  const date = new Date(dateStr + 'T12:00:00');
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();

  // Add ordinal suffix
  const suffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return includeYear
    ? `${month} ${day}, ${year}`
    : `${month} ${day}${suffix(day)}`;
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 14, marginBottom: 5, fontWeight: 'bold' },
  section: { marginBottom: 15, border: '1pt solid black' },
  sectionHeader: { backgroundColor: '#f0f0f0', padding: 4, fontWeight: 'bold', borderBottom: '1pt solid black' },
  row: { flexDirection: 'row', padding: 3 },
  label: { width: 100, fontWeight: 'bold' },
  value: { flex: 1 },
  deliveryDateValue: { flex: 1, fontWeight: 'bold' },
  poNumberValue: { flex: 1, fontWeight: 'bold', color: 'red' },

  // Custom Table implementation using Flex
  tableContainer: { width: 'auto', marginVertical: 5, flexDirection: 'column' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0 },
  tableColHeader: { width: '20%', borderBottom: '1pt solid black', padding: 2, fontWeight: 'bold', textAlign: 'right' },
  tableColStation: { width: '20%', padding: 2, fontWeight: 'bold' },
  tableColValue: { width: '20%', padding: 2, textAlign: 'right' },

  // Delivery Table
  deliveryTable: { flexDirection: 'row', marginTop: 5, padding: 5 },
  deliveryCol: { width: '35%', flexDirection: 'column' },
  boldText: { fontWeight: 'bold' }
});

interface FuelOrderItem {
  grade: string;
  ltrs: number;
}

interface POData {
  deliveryDate: string;
  poNumber: string;
  badgeNo: string;
  startTime: string;
  endTime: string;
  items: FuelOrderItem[];
}

interface POPreviewProps {
  data: POData;
  selectedStation: any; // Or your specific Location interface
  carrierName?: string;
  rackName?: string;
  rackLocation?: string;
}

export const POPreviewDocument: React.FC<POPreviewProps> = ({
  data,
  selectedStation,
  carrierName,
  rackName,
  rackLocation
}) => {

  const getQty = (gradeKey: string): string => {
    const item = data.items.find(i => i.grade.toLowerCase().includes(gradeKey.toLowerCase()));
    return item ? item.ltrs.toLocaleString() : "0";
  };

  // Helper to convert 24h (13:00) to 12h (1pm)
  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, _] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    return `${displayH}${ampm}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>National Spirit Petroleum Order Sheet</Text>

        {/* Logistics Section */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatPDFDate(data.deliveryDate)}</Text>
          </View>
          <View style={styles.row}><Text style={styles.label}>Carrier</Text><Text style={styles.value}>{carrierName || ''}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Trailer #</Text><Text style={styles.value}></Text></View>
          <View style={styles.row}><Text style={styles.label}>PO #</Text><Text style={styles.poNumberValue}>{data.poNumber}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Contact #</Text><Text style={styles.value}>nsporders@nspetroleum.ca</Text></View>
        </View>

        {/* Pick Up Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Pick Up Information</Text>
          <View style={styles.row}><Text style={styles.label}>Pick Up #</Text></View>
          <View style={styles.row}><Text style={styles.label}>Badge #</Text><Text style={styles.value}>{data.badgeNo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Rack Source</Text><Text style={styles.value}>{rackName || ''} - {rackLocation || ''}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}></Text></View>

          {/* Grades Table - Using Flex instead of Table display */}
          <View style={styles.tableContainer}>
            <View style={styles.tableRow}>
              <Text style={styles.tableColStation}>Station</Text>
              <Text style={styles.tableColHeader}>RUL</Text>
              <Text style={styles.tableColHeader}>PUL</Text>
              <Text style={styles.tableColHeader}>ULSD</Text>
              <Text style={styles.tableColHeader}>DYED</Text>
            </View>

            {/* Main Data Row */}
            <View style={styles.tableRow}>
              <Text style={styles.tableColStation}>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
              <Text style={styles.tableColValue}>{getQty("Regular")}</Text>
              <Text style={styles.tableColValue}>{getQty("Premium")}</Text>
              <Text style={styles.tableColValue}>{getQty("Diesel")}</Text>
              <Text style={styles.tableColValue}>{getQty("Dyed")}</Text>
            </View>

            {/* Spacer/Zero Row */}
            <View style={styles.tableRow}>
              <Text style={styles.tableColStation}></Text>
              <Text style={styles.tableColValue}>0</Text>
              <Text style={styles.tableColValue}>0</Text>
              <Text style={styles.tableColValue}>0</Text>
              <Text style={styles.tableColValue}>0</Text>
            </View>

            {/* Totals Row */}
            <View style={styles.tableRow}>
              <Text style={styles.tableColStation}>Total</Text>
              <Text style={styles.tableColValue}>{getQty("Regular")}</Text>
              <Text style={styles.tableColValue}>{getQty("Premium")}</Text>
              <Text style={styles.tableColValue}>{getQty("Diesel")}</Text>
              <Text style={styles.tableColValue}>{getQty("Dyed")}</Text>
            </View>
          </View>

          <Text style={{ padding: 3, marginTop: 5 }}>Pick up ETA - </Text>
        </View>

        {/* Delivery Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Delivery Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery</Text>
            <Text style={styles.deliveryDateValue}>
              {formatPDFDate(data.deliveryDate, false)} - {formatTime(data.startTime)}-{formatTime(data.endTime)} delivery
            </Text>
          </View>

          <View style={styles.deliveryTable}>
            <View style={styles.deliveryCol}>
              <Text style={styles.boldText}>Station</Text>
              <Text>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
            </View>
            <View style={styles.deliveryCol}>
              <Text style={styles.boldText}>Address</Text>
              <Text>{selectedStation?.address || 'N/A'}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};