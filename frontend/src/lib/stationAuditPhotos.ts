export function stationAuditPhotoUrl(storedPath: string) {
  const value = String(storedPath || '').trim()
  const cdnMarker = '/cdn/download/'
  const markerIndex = value.indexOf(cdnMarker)
  const filename = markerIndex >= 0
    ? value.slice(markerIndex + cdnMarker.length)
    : value.replace(/^\/+/, '')

  let decodedFilename = filename
  try {
    decodedFilename = decodeURIComponent(filename)
  } catch {
    // Preserve legacy filenames containing a literal percent sign.
  }

  return `${cdnMarker}${encodeURIComponent(decodedFilename)}`
}
