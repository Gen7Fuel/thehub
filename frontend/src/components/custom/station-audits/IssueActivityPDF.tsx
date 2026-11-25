import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'

export type IssueActivityPdfData = {
  title: string
  station: string
  status: 'created' | 'in_progress' | 'on_hold' | 'resolved'
  statusLabel: string
  raised: string
  department: string
  assigned: string
  updated: string
  reportDate: string
  partial: boolean
  entries: { id: string; heading: string; timestamp: string; body?: string; changes: string[]; photos: (string | null)[] }[]
}

const styles = StyleSheet.create({
  page: { padding: 42, paddingBottom: 55, fontSize: 10, lineHeight: 1.45, color: '#27364b' },
  brand: { color: '#5b21b6', fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  heading: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#17243a', marginBottom: 8 },
  summary: { borderWidth: 1, borderColor: '#dde3ee', borderRadius: 10, padding: 14, marginTop: 8 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { flexGrow: 1, flexShrink: 1, marginRight: 10, fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#17243a' },
  badge: { fontSize: 9, fontFamily: 'Helvetica-Bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 15, marginBottom: 9 },
  tile: { flex: 1, backgroundColor: '#f4f6fa', borderRadius: 7, padding: 9 },
  tileLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#52617a', marginBottom: 3 },
  meta: { fontSize: 9, color: '#52617a', marginTop: 4 },
  notice: { color: '#78500c', backgroundColor: '#fffbeb', padding: 9, marginTop: 12 },
  section: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 20, marginBottom: 8 },
  entry: { borderTopWidth: 1, borderTopColor: '#dde3ee', paddingTop: 10, marginBottom: 12 },
  event: { fontFamily: 'Helvetica-Bold', color: '#322067', marginTop: 3 },
  body: { marginTop: 6 },
  change: { marginTop: 4, color: '#475569' },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  photoTile: { width: 170, borderWidth: 1, borderColor: '#dde3ee', padding: 4, borderRadius: 4 },
  photo: { width: '100%', height: 112, objectFit: 'contain' },
  photoLabel: { fontSize: 8, color: '#52617a', marginTop: 3, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 23, height: 12, left: 42, right: 42, fontSize: 8, lineHeight: 1.2, color: '#52617a', textAlign: 'right' },
})

const statusColors = {
  created: { backgroundColor: '#f1f5f9', color: '#334155' },
  in_progress: { backgroundColor: '#eef2ff', color: '#3730a3' },
  on_hold: { backgroundColor: '#fff7ed', color: '#9a3412' },
  resolved: { backgroundColor: '#ecfdf5', color: '#065f46' },
}

export function createIssueActivityPdf(data: IssueActivityPdfData) {
  return pdf(
    <Document title={`Issue activity - ${data.title}`} author="Gen7 Fuel Hub">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>GEN7 FUEL HUB / AUDITS TRACKER</Text>
        <Text style={styles.heading}>Issue activity log</Text>
        <View style={styles.summary} wrap={false}>
          <View style={styles.summaryTop}>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={[styles.badge, statusColors[data.status]]}>{data.statusLabel}</Text>
          </View>
          <Text style={styles.meta}>{data.station || 'Unknown station'}</Text>
          <View style={styles.tiles}>
            {[
              ['RAISED', data.raised],
              ['LAST DEPARTMENT', data.department],
              ['LAST ASSIGNED', data.assigned],
            ].map(([label, value]) => (
              <View key={label} style={styles.tile}>
                <Text style={styles.tileLabel}>{label}</Text>
                <Text>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.meta}>Last updated {data.updated}</Text>
        </View>
        {data.partial && <Text style={styles.notice}>This export includes the entries loaded in the activity dialog. Earlier or later entries may be available in Hub.</Text>}
        <Text style={styles.section} minPresenceAhead={44}>Activity timeline ({data.entries.length})</Text>
        {!data.entries.length && <Text style={styles.meta}>No activity recorded.</Text>}
        {data.entries.map((entry) => (
          <View key={entry.id} style={styles.entry}>
            <View wrap={false}>
              <Text style={styles.meta}>{entry.timestamp}</Text>
              <Text style={styles.event}>{entry.heading}</Text>
            </View>
            {entry.body && <Text style={styles.body}>{entry.body}</Text>}
            {entry.changes.map((change, index) => <Text key={index} style={styles.change}>{change}</Text>)}
            {Array.from({ length: Math.ceil(entry.photos.length / 3) }, (_, row) => (
              <View key={row} style={styles.photoRow} wrap={false}>
                {entry.photos.slice(row * 3, row * 3 + 3).map((photo, index) => (
                  <View key={index} style={styles.photoTile}>
                    {photo && <Image src={photo} style={styles.photo} />}
                    <Text style={styles.photoLabel}>
                      Photo {row * 3 + index + 1}{photo ? '' : ' unavailable'}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <View fixed style={styles.footer}>
          <Text>Report date: {data.reportDate}</Text>
        </View>
      </Page>
    </Document>,
  )
}
