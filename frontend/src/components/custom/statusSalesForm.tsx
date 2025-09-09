import { formatPhoneNumber, formatStatusCardNumber } from '@/lib/utils';
import {
  Page,
  Text,
  View,
  Image,
  Document,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
    color: '#6b7280',
  },
  tableWrapper: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginHorizontal: 16,
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 36,
    backgroundColor: '#fff',
  },
  tableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 36,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCol: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 10,
    color: '#111827',
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 0,
  },
  colStatus: {
    flexBasis: '20%',
    flexGrow: 2,
  },
  colDriver: {
    flexBasis: '28%',
    flexGrow: 3,
  },
  colPump: {
    flexBasis: '12%',
    flexGrow: 1,
  },
  colGrade: {
    flexBasis: '16%',
    flexGrow: 1.5,
  },
  colAmount: {
    flexBasis: '12%',
    flexGrow: 1,
    textAlign: 'right',
  },
  colTotal: {
    flexBasis: '12%',
    flexGrow: 1,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 12,
  },
  driverInfo: {
    fontSize: 10,
    color: '#111827',
  },
  driverNote: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
});

const StatusSalesPDF = ({
  data,
  date,
  station,
}: {
  data: any[];
  date: string;
  station: string;
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View>
          <Text style={[styles.header, { textAlign: 'left', marginBottom: 0 }]}>Status Sales Report</Text>
          <Text style={[styles.subtitle, { textAlign: 'left', marginBottom: 0 }]}>
            Date: {date} | Station: {station}
          </Text>
        </View>
        <Image src="/logo.png" style={{ height: 64 }} />
      </View>

      {/* Table */}
      <View style={styles.tableWrapper}>
        {/* Table Header */}
        <View style={styles.tableRowHeader}
          wrap={false}
          break={false}
          fixed
        >
          <Text style={[styles.tableCol, styles.colStatus, styles.tableHeaderText]}>
            Status Card Number
          </Text>
          <Text style={[styles.tableCol, styles.colDriver, styles.tableHeaderText]}>
            Driver Info
          </Text>
          <Text style={[styles.tableCol, styles.colPump, styles.tableHeaderText]}>
            Pump Number
          </Text>
          <Text style={[styles.tableCol, styles.colGrade, styles.tableHeaderText]}>
            Fuel Grade
          </Text>
          <Text style={[styles.tableCol, styles.colAmount, styles.tableHeaderText]}>
            Amount
          </Text>
          <Text style={[styles.tableCol, styles.colTotal, styles.tableHeaderText]}>
            Total
          </Text>
        </View>
        {/* Table Rows */}
        {data.map((sale, index) => (
          <View
            key={index}
            style={[
              styles.tableRow,
              ...(index === data.length - 1 ? [styles.tableRowLast] : []),
            ]}
            wrap={false}
            break={false}
          >
            {/* Status Card Number */}
            <Text style={[styles.tableCol, styles.colStatus]}>
              {formatStatusCardNumber(sale.statusCardNumber)}
            </Text>
            {/* Driver Info */}
            <View style={[styles.tableCol, styles.colDriver]}>
              <Text style={styles.driverInfo}>
                {sale.customerDetails?.name || 'N/A'}
              </Text>
              {sale.amount >= 200 && sale.customerDetails?.phone && (
                <Text style={styles.driverNote}>
                  {formatPhoneNumber(sale.customerDetails.phone)}
                </Text>
              )}
              {sale.amount >= 200 && sale.notes && (
                <Text style={styles.driverNote}>
                  {sale.notes}
                </Text>
              )}
            </View>
            {/* Pump Number */}
            <Text style={[styles.tableCol, styles.colPump]}>
              {sale.pump}
            </Text>
            {/* Fuel Grade */}
            <Text style={[styles.tableCol, styles.colGrade]}>
              {sale.fuelGrade}
            </Text>
            {/* Amount */}
            <Text style={[styles.tableCol, styles.colAmount]}>
              {sale.amount?.toFixed(2)}
            </Text>
            {/* Total */}
            <Text style={[styles.tableCol, styles.colTotal]}>
              {sale.total?.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

export default StatusSalesPDF;