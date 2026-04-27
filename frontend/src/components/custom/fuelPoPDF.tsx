import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

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

export const getISODateOnly = (dateInput: any) => {
  if (!dateInput) return "";
  // Split at 'T' to get the 2026-04-10 part
  return new Date(dateInput).toISOString().split('T')[0];
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    position: 'relative' // Required for absolute positioning of children
  },
  logo: {
    width: 150,
    alignSelf: 'center',
    marginBottom: 10
  },
  header: {
    fontSize: 16,
    marginBottom: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1e40af', // Deep blue
    textTransform: 'uppercase'
  },
  // Main Sections
  section: {
    marginBottom: 15,
    border: '1pt solid #1e40af'
  },
  sectionHeader: {
    backgroundColor: '#eff6ff', // Light blue highlight
    padding: 5,
    fontWeight: 'bold',
    color: '#1e40af',
    borderBottom: '1pt solid #1e40af',
    fontSize: 11
  },
  row: { flexDirection: 'row', padding: 4, borderBottom: '0.5pt solid #eee' },
  label: { width: 100, fontWeight: 'bold', color: '#334155' },
  value: { flex: 1 },
  poNumberValue: { flex: 1, fontWeight: 'bold', color: '#dc2626' }, // Keep PO Red for visibility

  // Grades Table
  tableContainer: { width: 'auto', marginTop: 5, flexDirection: 'column' },
  tableRow: { flexDirection: 'row' },
  tableColStation: {
    width: '40%',
    padding: 4,
    borderRight: '1pt solid #1e40af',
    backgroundColor: '#f8fafc'
  },
  tableColValue: {
    width: '60%',
    padding: 4,
    textAlign: 'center',
    fontWeight: 'bold'
  },

  // Delivery Layout
  deliveryTable: { flexDirection: 'row', padding: 5 },
  deliveryColStation: { width: '30%', paddingRight: 10 },
  deliveryColAddress: { flex: 1 },
  boldText: { fontWeight: 'bold' },

  // --- THE FIXED BOTTOM SECTION ---
  officeUseSection: {
    position: 'absolute',
    bottom: 30, // Distance from bottom of page
    left: 30,
    right: 30,
    borderTop: '1.5pt dotted #94a3b8', // Dotted line separator
    paddingTop: 10
  },
  officeBox: {
    border: '1pt solid #cbd5e1',
    backgroundColor: '#f8fafc'
  },
  officeHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    textAlign: 'center'
  }
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
  carrierBookworksId?: string;
  supplierBookworksId?: string;
}

export const POPreviewDocument: React.FC<POPreviewProps> = ({
  data,
  selectedStation,
  carrierName,
  rackName,
  rackLocation,
  carrierBookworksId,
  supplierBookworksId
}) => {

  const getQty = (gradeKey: string): string => {
    const item = data.items.find(
      (i) => i.grade.toLowerCase() === gradeKey.toLowerCase()
    );
    return item ? item.ltrs.toLocaleString() : "0";
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    return `${displayH}${ampm}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image src="/fuel_images/nsp_logo.png" style={styles.logo} />
        <Text style={styles.header}>Fuel Order Sheet</Text>

        {/* Logistics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Order Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatPDFDate(data.deliveryDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Carrier</Text>
            <Text style={styles.value}>{carrierName || ''}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>PO #</Text>
            <Text style={styles.poNumberValue}>{data.poNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Contact</Text>
            <Text style={styles.value}>nsporders@nspetroleum.ca</Text>
          </View>
        </View>

        {/* Pick Up Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Pick Up Information</Text>
          <View style={styles.row}><Text style={styles.label}>Pick Up #</Text></View>
          <View style={styles.row}>
            <Text style={styles.label}>Badge #</Text>
            <Text style={styles.value}>{data.badgeNo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rack Source</Text>
            <Text style={styles.value}>{rackName} - {rackLocation}</Text>
          </View>
          <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}></Text></View>


          <View style={styles.tableContainer}>
            <View style={[styles.tableRow, { borderTop: '1pt solid #1e40af', borderBottom: '1pt solid #1e40af' }]}>
              <Text style={styles.tableColStation}>Grade</Text>
              <Text style={[styles.tableColValue, { backgroundColor: '#f8fafc' }]}>
                {selectedStation?.fuelCustomerName || 'Quantity'}
              </Text>
            </View>
            {[
              { label: 'RUL (Regular)', key: 'Regular' },
              { label: 'PUL (Premium)', key: 'Premium' },
              { label: 'ULSD (Diesel)', key: 'Diesel' },
              { label: 'DYED (Dyed)', key: 'Dyed Diesel' }
            ].map((grade, i) => (
              <View key={i} style={[styles.tableRow, { borderBottom: '0.5pt solid #eee' }]}>
                <Text style={styles.tableColStation}>{grade.label}</Text>
                <Text style={styles.tableColValue}>{getQty(grade.key)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Delivery Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Delivery Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery</Text>
            <Text style={[styles.value, { fontWeight: 'bold' }]}>
              {formatPDFDate(data.deliveryDate, false)} @ {formatTime(data.startTime)} - {formatTime(data.endTime)}
            </Text>
          </View>
          <View style={styles.deliveryTable}>
            <View style={styles.deliveryColStation}>
              <Text style={styles.boldText}>Station</Text>
              <Text>{selectedStation?.fuelCustomerName}</Text>
            </View>
            <View style={styles.deliveryColAddress}>
              <Text style={styles.boldText}>Address</Text>
              <Text>{selectedStation?.address}</Text>
            </View>
          </View>
        </View>

        {/* STUCK TO BOTTOM: Office Use Only */}
        <View style={styles.officeUseSection}>
          <Text style={styles.officeHeader}>--- Internal Office Use Only ---</Text>
          <View style={styles.officeBox}>
            <View style={[styles.row, { borderBottom: '0.5pt solid #cbd5e1' }]}>
              <Text style={[styles.label, { width: 120 }]}>Supplier/Terminal</Text>
              <Text style={styles.value}>{supplierBookworksId || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { width: 120 }]}>Hauler</Text>
              <Text style={styles.value}>{carrierBookworksId || 'N/A'}</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  );
};

// export const POPreviewDocument: React.FC<POPreviewProps> = ({
//   data,
//   selectedStation,
//   carrierName,
//   rackName,
//   rackLocation
// }) => {

//   const getQty = (gradeKey: string): string => {
//     // 1. Use .find with exact equality (===)
//     // 2. We still use .toLowerCase() on both sides just to be safe with casing
//     const item = data.items.find(
//       (i) => i.grade.toLowerCase() === gradeKey.toLowerCase()
//     );

//     return item ? item.ltrs.toLocaleString() : "0";
//   };
//   // Helper to convert 24h (13:00) to 12h (1pm)
//   const formatTime = (time: string) => {
//     if (!time) return "";
//     const [hours, _] = time.split(':');
//     const h = parseInt(hours);
//     const ampm = h >= 12 ? 'pm' : 'am';
//     const displayH = h % 12 || 12;
//     return `${displayH}${ampm}`;
//   };

//   return (
//     <Document>
//       <Page size="A4" style={styles.page}>
//         {/* Logo at the top center */}
//         <Image
//           src="/fuel_images/nsp_logo.png"
//           style={styles.logo}
//         />
//         <Text style={styles.header}>Fuel Order Sheet</Text>

//         {/* Logistics Section */}
//         <View style={styles.section}>
//           <View style={styles.row}>
//             <Text style={styles.label}>Date</Text>
//             <Text style={styles.value}>{formatPDFDate(data.deliveryDate)}</Text>
//           </View>
//           <View style={styles.row}><Text style={styles.label}>Carrier</Text><Text style={styles.value}>{carrierName || ''}</Text></View>
//           <View style={styles.row}><Text style={styles.label}>Trailer #</Text><Text style={styles.value}></Text></View>
//           <View style={styles.row}><Text style={styles.label}>PO #</Text><Text style={styles.poNumberValue}>{data.poNumber}</Text></View>
//           <View style={styles.row}><Text style={styles.label}>Contact #</Text><Text style={styles.value}>nsporders@nspetroleum.ca</Text></View>
//         </View>

//         {/* Pick Up Section */}
//         <View style={styles.section}>
//           <Text style={styles.sectionHeader}>Pick Up Information</Text>
//           <View style={styles.row}><Text style={styles.label}>Pick Up #</Text></View>
//           <View style={styles.row}><Text style={styles.label}>Badge #</Text><Text style={styles.value}>{data.badgeNo}</Text></View>
//           <View style={styles.row}><Text style={styles.label}>Rack Source</Text><Text style={styles.value}>{rackName || ''} - {rackLocation || ''}</Text></View>
//           <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}></Text></View>

//           {/* Grades Table - Using Flex instead of Table display */}
//           <View style={styles.tableContainer}>
//             <View style={styles.tableRow}>
//               <Text style={styles.tableColStation}>Station</Text>
//               <Text style={styles.tableColHeader}>RUL</Text>
//               <Text style={styles.tableColHeader}>PUL</Text>
//               <Text style={styles.tableColHeader}>ULSD</Text>
//               <Text style={styles.tableColHeader}>DYED</Text>
//             </View>

//             {/* Main Data Row */}
//             <View style={styles.tableRow}>
//               <Text style={styles.tableColStation}>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
//               <Text style={styles.tableColValue}>{getQty("Regular")}</Text>
//               <Text style={styles.tableColValue}>{getQty("Premium")}</Text>
//               <Text style={styles.tableColValue}>{getQty("Diesel")}</Text>
//               {/* <Text style={styles.tableColValue}>{getQty("Dyed")}</Text> */}
//               <Text style={styles.tableColValue}>{getQty("Dyed Diesel")}</Text>
//             </View>

//             {/* Spacer/Zero Row */}
//             <View style={styles.tableRow}>
//               <Text style={styles.tableColStation}></Text>
//               <Text style={styles.tableColValue}>0</Text>
//               <Text style={styles.tableColValue}>0</Text>
//               <Text style={styles.tableColValue}>0</Text>
//               <Text style={styles.tableColValue}>0</Text>
//             </View>

//             {/* Totals Row */}
//             <View style={styles.tableRow}>
//               <Text style={styles.tableColStation}>Total</Text>
//               <Text style={styles.tableColValue}>{getQty("Regular")}</Text>
//               <Text style={styles.tableColValue}>{getQty("Premium")}</Text>
//               <Text style={styles.tableColValue}>{getQty("Diesel")}</Text>
//               {/* <Text style={styles.tableColValue}>{getQty("Dyed")}</Text> */}
//               <Text style={styles.tableColValue}>{getQty("Dyed Diesel")}</Text>
//             </View>
//           </View>

//           <Text style={{ padding: 3, marginTop: 5 }}>Pick up ETA - </Text>
//         </View>

//         {/* Delivery Section */}
//         <View style={styles.section}>
//           <Text style={styles.sectionHeader}>Delivery Information</Text>
//           <View style={styles.row}>
//             <Text style={styles.label}>Delivery</Text>
//             <Text style={styles.deliveryDateValue}>
//               {formatPDFDate(data.deliveryDate, false)} - {formatTime(data.startTime)}-{formatTime(data.endTime)} delivery
//             </Text>
//           </View>

//           <View style={styles.deliveryTable}>
//             {/* Station Column - 25% Width */}
//             <View style={styles.deliveryColStation}>
//               <Text style={styles.boldText}>Station</Text>
//               <Text>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
//             </View>

//             {/* Address Column - Takes remaining 75% Width */}
//             <View style={styles.deliveryColAddress}>
//               <Text style={styles.boldText}>Address</Text>
//               <Text>{selectedStation?.address || 'N/A'}</Text>
//             </View>
//           </View>
//         </View>
//       </Page>
//     </Document>
//   );
// };