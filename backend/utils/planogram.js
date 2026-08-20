// Shared helpers for planogram files and planogram membership checks.
//
// Everything that compares a GTIN — the upload parser and the order-rec check —
// goes through normalizeGtin() in this file. Keeping the single implementation
// here is what stops the two sides of the comparison from drifting apart.

const XLSX = require('xlsx')

// Header labels that identify the GTIN column. Extend this rather than adding
// per-file special cases.
const GTIN_HEADER_RE = /^(product\s*id|gtin|upc|upc\s*code|item\s*id)$/i

// Column B, used when a sheet has no recognizable header row.
const FALLBACK_GTIN_COL = 1

const MAX_ROWS_PER_SHEET = 50000

/**
 * Reduce a cell value to a canonical GTIN-14 string, or null if it isn't one.
 *
 * Order matters: validate the digit shape FIRST, then pad. Doing it the other
 * way round (strip non-digits, then check the length) accepts the report footer
 * these files carry — "38.00 (26.76%)" strips to "38002676", a plausible-looking
 * 8 digits — and silently adds junk GTINs to the planogram.
 *
 * Padding to 14 is what makes Excel's typing irrelevant: a UPC stored as the
 * text "073100001079" and the same value stored as the number 73100001079 both
 * land on "00073100001079".
 */
function normalizeGtin(value) {
  if (value === null || value === undefined) return null

  let s
  if (typeof value === 'number') {
    // Largest GTIN-14 is 1e14, comfortably inside Number.MAX_SAFE_INTEGER, so
    // an integral GTIN survives Excel's float storage exactly.
    if (!Number.isInteger(value) || value < 0) return null
    s = String(value)
  } else if (typeof value === 'string') {
    // Only whitespace and hyphens are noise; anything else is a real character
    // and must fail validation rather than be silently deleted.
    s = value.trim().replace(/[\s -]/g, '')
  } else {
    return null // boolean, Date, object
  }

  if (!/^[0-9]{8,14}$/.test(s)) return null
  return s.padStart(14, '0')
}

/**
 * Locate the GTIN column by scanning the first few rows for a known header.
 * Returns { col, headerRow } or null when the sheet has no header we recognize.
 */
function findGtinColumn(rows) {
  const limit = Math.min(rows.length, 10)
  for (let r = 0; r < limit; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (typeof cell === 'string' && GTIN_HEADER_RE.test(cell.trim())) {
        return { col: c, headerRow: r }
      }
    }
  }
  return null
}

const cellToString = (v, max) =>
  v === null || v === undefined ? '' : String(v).slice(0, max)

/**
 * Parse a planogram workbook buffer into a deduped list of planogram items.
 *
 * Scans every sheet: these files carry extra sheets ("Other Aggregates") and the
 * product sheet's name varies per site ("Aisle 1", "Back Wall"), so neither can
 * be hardcoded. Sheets without a recognizable header are skipped when at least
 * one sheet has one, which drops the aggregate sheets by design instead of by
 * luck.
 *
 * Rows that aren't products — shelf separators ("Shelf: Shelf 74 | Width: ..."),
 * blanks, and the trailing Breakdowns/Categories footer — all fail
 * normalizeGtin() and are dropped by the same rule.
 */
function parsePlanogramWorkbook(buffer) {
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellNF: false,
    cellText: false,
  })

  const sheets = wb.SheetNames.filter((n) => wb.Sheets[n]).map((n) => ({
    name: n,
    // raw:true is load-bearing. These files format GTIN cells as scientific
    // notation, so without it a number cell reads back as its DISPLAY text
    // ("8.10128E+11") and the real value is lost — silently, on most rows.
    rows: XLSX.utils
      .sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })
      .slice(0, MAX_ROWS_PER_SHEET),
  }))

  const withHeader = sheets
    .map((s) => ({ ...s, hdr: findGtinColumn(s.rows) }))
    .filter((s) => s.hdr)

  // Blind column-B scanning is the last resort, used only when no sheet in the
  // workbook has a header we recognize.
  const targets = withHeader.length
    ? withHeader
    : sheets.map((s) => ({ ...s, hdr: { col: FALLBACK_GTIN_COL, headerRow: -1 } }))

  const byGtin = new Map()
  const perSheet = []
  let rejectedCells = 0

  for (const s of targets) {
    let accepted = 0
    for (let r = s.hdr.headerRow + 1; r < s.rows.length; r++) {
      const row = s.rows[r]
      if (!Array.isArray(row)) continue

      const cell = row[s.hdr.col]
      const gtin = normalizeGtin(cell)

      if (!gtin) {
        // Separator and blank rows hold nothing in this column; only count a
        // rejection when there was actually a value we couldn't use.
        if (cell !== null && cell !== undefined && cell !== '') rejectedCells++
        continue
      }

      accepted++
      if (!byGtin.has(gtin)) {
        byGtin.set(gtin, {
          gtin,
          name: cellToString(row[s.hdr.col + 1], 200),
          fixture: cellToString(row[s.hdr.col + 2], 100),
          bay: cellToString(row[s.hdr.col + 3], 50),
          sheet: s.name,
        })
      }
    }
    perSheet.push({ sheet: s.name, accepted })
  }

  // Note: heavily zero-padded GTINs (e.g. "000000000338") are legitimate short
  // internal codes, not placeholders — they normalize and match like any other.
  // Don't add a "suspicious leading zeros" warning here; it only cries wolf.
  return {
    items: [...byGtin.values()],
    sheetNames: wb.SheetNames,
    perSheet,
    rejectedCells,
    headerDetected: withHeader.length > 0,
  }
}

/**
 * The identifier an order-rec item would be matched on if only one were
 * available: gtin when the item has a readable one, otherwise crtCode.
 *
 * The planogram's "Product ID" column is a MIXED identifier space, not one kind
 * of number. It lists whichever code identifies the form of the product that
 * actually occupies the shelf: a plain GTIN for anything sold as a pack, tin,
 * pouch or bag, and a carton code for the (site-dependent) subset that's
 * genuinely shelved by the carton — cigarettes at some sites. Which is which
 * is a per-site, sometimes per-category fact the CSV doesn't tell us, so this
 * is only ever a tiebreak: isOffPlanogram() below checks BOTH codes against
 * the planogram and only uses this one key for reporting which code an
 * unmatched item was closest to.
 *
 * gtin goes first because every order-rec item has one and it is the code
 * actually printed on the shelf-facing unit; crtCode exists only for items
 * with a CRT sub-row, and plenty of planograms (Osoyoos's Cigars category,
 * for one — Backwoods 5-packs are shelved as packs, not cases) never list the
 * carton code at all, so leading with crtCode there flagged every match crt
 * could have made instead of gtin.
 */
function planogramKey(item) {
  if (!item) return null
  const gtin = normalizeGtin(item.gtin)
  return gtin !== null ? gtin : normalizeGtin(item.crtCode)
}

/**
 * The single rule for whether an order-rec item counts as off-planogram.
 *
 * Both the order-rec create path and the recheck endpoint call this, so the
 * flag written at creation can never disagree with the flag written later.
 *
 * Checks gtin AND crtCode (when each is readable) against the planogram set
 * and clears the flag if either is present — the two codes are matched
 * independently rather than picking one key up front, because which one the
 * planogram actually lists varies by site and category (see planogramKey()).
 * A carton-sold item whose gtin is the pack barcode still needs crtCode to
 * find its match; a pack-sold item with a stray crtCode still needs gtin to.
 *
 * Fails open in every uncertain case: no planogram for the site, a station
 * supply, or an item with no readable code at all yield false rather than a
 * guess. An unreadable crtCode is not itself a failure — a CSV export that
 * mangled column B into "6.80085E+11" fails normalizeGtin, and the item is
 * judged on gtin alone rather than being flagged on a value we could not read.
 */
function isOffPlanogram(item, planogramGtins, isStationSupply) {
  if (!planogramGtins || isStationSupply) return false
  const gtin = normalizeGtin(item?.gtin)
  const crt = normalizeGtin(item?.crtCode)
  if (gtin === null && crt === null) return false
  if (gtin !== null && planogramGtins.has(gtin)) return false
  if (crt !== null && planogramGtins.has(crt)) return false
  return true
}

/**
 * The GTIN set for a site, or null when the site has no planogram on file.
 *
 * The null return is the "skip the check entirely" rule: callers branch on
 * truthiness, so a site without a planogram can never flag anything.
 *
 * Re-normalizes every stored gtin rather than trusting it's already padded.
 * parsePlanogramWorkbook() pads to 14 on upload, but planogramKey() also pads
 * whatever it's given, so a document written before that padding existed (or
 * edited by hand) would carry short, unpadded gtins that silently never match
 * a padded order-rec key. Running both sides through the same normalizeGtin()
 * at compare time is what keeps them from drifting apart again.
 */
async function loadPlanogramGtinSet(site) {
  const Planogram = require('../models/Planogram')
  const doc = await Planogram.findOne({ site }, { 'items.gtin': 1 }).lean()
  if (!doc || !Array.isArray(doc.items) || doc.items.length === 0) return null
  const set = new Set()
  for (const i of doc.items) {
    const gtin = normalizeGtin(i.gtin)
    if (gtin !== null) set.add(gtin)
  }
  return set
}

module.exports = {
  normalizeGtin,
  parsePlanogramWorkbook,
  planogramKey,
  isOffPlanogram,
  loadPlanogramGtinSet,
}
