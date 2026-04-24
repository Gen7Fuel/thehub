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
  logo: {
    width: 150,
    alignSelf: 'center',
    marginBottom: 10
  },
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 14, marginBottom: 15, fontWeight: 'bold', textAlign: 'left' },
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
  deliveryTable: {
    flexDirection: 'row',
    marginTop: 5,
    padding: 5
  },
  // Fixed narrow width for the Station name
  deliveryColStation: {
    width: '25%',
    flexDirection: 'column',
    paddingRight: 10 // Added a little gap between columns
  },
  // Flex 1 allows the address to fill the rest of the line
  deliveryColAddress: {
    flex: 1,
    flexDirection: 'column'
  },
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
    // 1. Use .find with exact equality (===)
    // 2. We still use .toLowerCase() on both sides just to be safe with casing
    const item = data.items.find(
      (i) => i.grade.toLowerCase() === gradeKey.toLowerCase()
    );

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
        {/* Logo at the top center */}
        <Image
          src="/fuel_images/nsp_logo.png"
          style={styles.logo}
        />
        <Text style={styles.header}>Fuel Order Sheet</Text>

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
              {/* <Text style={styles.tableColValue}>{getQty("Dyed")}</Text> */}
              <Text style={styles.tableColValue}>{getQty("Dyed Diesel")}</Text>
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
              {/* <Text style={styles.tableColValue}>{getQty("Dyed")}</Text> */}
              <Text style={styles.tableColValue}>{getQty("Dyed Diesel")}</Text>
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
            {/* Station Column - 25% Width */}
            <View style={styles.deliveryColStation}>
              <Text style={styles.boldText}>Station</Text>
              <Text>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
            </View>

            {/* Address Column - Takes remaining 75% Width */}
            <View style={styles.deliveryColAddress}>
              <Text style={styles.boldText}>Address</Text>
              <Text>{selectedStation?.address || 'N/A'}</Text>
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
//     const item = data.items.find(
//       (i) => i.grade.toLowerCase() === gradeKey.toLowerCase()
//     );
//     return item ? item.ltrs.toLocaleString() : "0";
//   };

//   const formatTime = (time: string) => {
//     if (!time) return "";
//     const [hours] = time.split(':');
//     const h = parseInt(hours);
//     const ampm = h >= 12 ? 'pm' : 'am';
//     const displayH = h % 12 || 12;
//     return `${displayH}${ampm}`;
//   };

//   return (
//     <Document>
//       <Page size="A4" style={styles.page}>
//         <Image src="/fuel_images/nsp_logo.png" style={styles.logo} />
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
          
//           {/* Vertical Grades Table */}
//           <View style={[styles.tableContainer, { borderTop: '1pt solid black', marginTop: 10 }]}>
//             <View style={styles.tableRow}>
//               <View style={[styles.tableColStation, { borderRight: '1pt solid black', width: '40%' }]}>
//                 <Text style={styles.boldText}>Grade</Text>
//               </View>
//               <View style={[styles.tableColStation, { width: '60%', textAlign: 'center' }]}>
//                 <Text style={styles.boldText}>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
//               </View>
//             </View>

//             {[
//               { label: 'RUL', key: 'Regular' },
//               { label: 'PUL', key: 'Premium' },
//               { label: 'ULSD', key: 'Diesel' },
//               { label: 'DYED', key: 'Dyed Diesel' }
//             ].map((grade, index) => (
//               <View key={index} style={[styles.tableRow, { borderTop: '1pt solid #eee' }]}>
//                 <Text style={[styles.tableColStation, { width: '40%', borderRight: '1pt solid black' }]}>{grade.label}</Text>
//                 <Text style={[styles.tableColValue, { width: '60%', textAlign: 'center' }]}>{getQty(grade.key)}</Text>
//               </View>
//             ))}
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
//             <View style={styles.deliveryColStation}>
//               <Text style={styles.boldText}>Station</Text>
//               <Text>{selectedStation?.fuelCustomerName || 'N/A'}</Text>
//             </View>
//             <View style={styles.deliveryColAddress}>
//               <Text style={styles.boldText}>Address</Text>
//               <Text>{selectedStation?.address || 'N/A'}</Text>
//             </View>
//           </View>
//         </View>

//         {/* Office Use Only Section */}
//         {/* <View style={[styles.section, { marginTop: 10 }]}>
//           <Text style={styles.sectionHeader}>For Office Use Only</Text>
//           <View style={styles.row}>
//             <Text style={styles.label}>Supplier/Terminal</Text>
//             <Text style={styles.value}>NLP-IOL-TOR-ON</Text>
//           </View>
//           <View style={styles.row}>
//             <Text style={styles.label}>Hauler</Text>
//             <Text style={styles.value}>NPT-ON</Text>
//           </View>
//         </View> */}
//       </Page>
//     </Document>
//   );
// };