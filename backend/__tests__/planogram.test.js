import { describe, it, expect } from 'vitest'
import XLSX from 'xlsx'
// Import the model directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import Planogram from '../models/Planogram.js'
import {
  normalizeGtin,
  parsePlanogramWorkbook,
  planogramKey,
  isOffPlanogram,
} from '../utils/planogram.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an .xlsx buffer in memory so no binary fixture has to be checked in. */
const workbook = (sheets) => {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

const HEADER = ['Location ID', 'Product ID', 'Name', 'Fixture', 'Bay']
const separator = () => ['Shelf: Shelf 74 | Width: 26.125in | Vertical Location: 23in', null, null, null, null]

/** Reproduces the real file's shape: header, separators, blanks, and a footer. */
const realisticSheet = () => [
  HEADER,
  separator(),
  [1, 810127980310, 'Zolt Wintergreen 15MG Tin', 'Shelf 74', 10],
  [2, 810127980198, 'Zolt Cool Mint 15MG Tin', 'Shelf 74', 10],
  separator(),
  [3, '073100001079', 'Copenhagen Snuff Tin', 'Shelf 69', 10],
  [null, null, null, null, null],
  [4, '052001234106', 'Cdn KO FF 20 CRT', 'Shelf 14', 16],
  [null, null, null, null, null],
  ['Breakdowns', null, null, null, null],
  ['Categories', null, null, null, null],
  ['', 'TotalProducts', null, null, null],
  ['Chew FN', '38.00 (26.76%)', null, null, null],
  ['Cigarettes FN', '104.00 (73.24%)', null, null, null],
]

// ─── normalizeGtin ────────────────────────────────────────────────────────────

describe('normalizeGtin', () => {
  it('pads a 12-digit UPC to canonical GTIN-14', () => {
    expect(normalizeGtin('810127980310')).toBe('00810127980310')
  })

  // The whole feature rests on this: Excel stores the same UPC as text when it
  // has a leading zero and as a number when it doesn't. Both must collapse to
  // the same key or every leading-zero product flags as missing.
  it('treats a text GTIN and the same value as a number as equal', () => {
    expect(normalizeGtin('073100001079')).toBe('00073100001079')
    expect(normalizeGtin(73100001079)).toBe('00073100001079')
    expect(normalizeGtin('073100001079')).toBe(normalizeGtin(73100001079))
  })

  // Regression: stripping non-digits BEFORE validating turns this footer cell
  // into "38002676" — a plausible 8 digits — and silently adds it as a GTIN.
  it('rejects report-footer percentages rather than stripping them into digits', () => {
    expect(normalizeGtin('38.00 (26.76%)')).toBeNull()
    expect(normalizeGtin('104.00 (73.24%)')).toBeNull()
    expect(normalizeGtin('TotalProducts')).toBeNull()
  })

  // Regression: this is what a numeric cell reads back as when the workbook is
  // parsed without raw:true. It must never be accepted as a GTIN.
  it('rejects scientific-notation display text', () => {
    expect(normalizeGtin('8.10128E+11')).toBeNull()
  })

  it('tolerates hyphens and surrounding whitespace', () => {
    expect(normalizeGtin('0-73100-00107-9')).toBe('00073100001079')
    expect(normalizeGtin('  810127980310  ')).toBe('00810127980310')
  })

  it('rejects values outside the 8-14 digit range', () => {
    expect(normalizeGtin('1234567')).toBeNull()
    expect(normalizeGtin('123456789012345')).toBeNull()
  })

  it('rejects non-GTIN inputs', () => {
    expect(normalizeGtin(null)).toBeNull()
    expect(normalizeGtin(undefined)).toBeNull()
    expect(normalizeGtin('')).toBeNull()
    expect(normalizeGtin('Product ID')).toBeNull()
    expect(normalizeGtin('$0.00')).toBeNull()
    expect(normalizeGtin(true)).toBeNull()
    expect(normalizeGtin(new Date())).toBeNull()
    expect(normalizeGtin(12345.678)).toBeNull()
    expect(normalizeGtin(-810127980310)).toBeNull()
  })
})

// ─── parsePlanogramWorkbook ───────────────────────────────────────────────────

describe('parsePlanogramWorkbook', () => {
  it('extracts only the product rows, skipping separators, blanks and the footer', () => {
    const res = parsePlanogramWorkbook(workbook({ 'Aisle 1': realisticSheet() }))

    expect(res.items).toHaveLength(4)
    expect(res.items.map((i) => i.gtin)).toEqual([
      '00810127980310',
      '00810127980198',
      '00073100001079',
      '00052001234106',
    ])
    expect(res.headerDetected).toBe(true)
  })

  it('captures the descriptive columns alongside the GTIN', () => {
    const res = parsePlanogramWorkbook(workbook({ 'Aisle 1': realisticSheet() }))
    expect(res.items[0]).toMatchObject({
      gtin: '00810127980310',
      name: 'Zolt Wintergreen 15MG Tin',
      fixture: 'Shelf 74',
      bay: '10',
      sheet: 'Aisle 1',
    })
  })

  it('counts unusable values but does not admit them as GTINs', () => {
    const res = parsePlanogramWorkbook(workbook({ 'Aisle 1': realisticSheet() }))
    // TotalProducts + the two percentage cells
    expect(res.rejectedCells).toBe(3)
  })

  // Sheet names vary per site ("Aisle 1", "Back Wall"), and these files ship an
  // aggregates sheet alongside the product sheet.
  it('ignores sheets with no GTIN header', () => {
    const res = parsePlanogramWorkbook(
      workbook({
        'Aisle 1': realisticSheet(),
        'Other Aggregates': [['Report Aggregates', null], ['Total Cost', null], ['', '$0.00']],
      }),
    )
    expect(res.items).toHaveLength(4)
    expect(res.perSheet.map((s) => s.sheet)).toEqual(['Aisle 1'])
    expect(res.sheetNames).toEqual(['Aisle 1', 'Other Aggregates'])
  })

  it('reads every product sheet when a workbook has more than one', () => {
    const res = parsePlanogramWorkbook(
      workbook({
        'Aisle 1': [HEADER, [1, 810127980310, 'A', 'S1', 1]],
        'Back Wall': [HEADER, [1, 810127980198, 'B', 'S2', 2]],
      }),
    )
    expect(res.items).toHaveLength(2)
    expect(res.perSheet).toEqual([
      { sheet: 'Aisle 1', accepted: 1 },
      { sheet: 'Back Wall', accepted: 1 },
    ])
  })

  it('dedupes a GTIN repeated across rows', () => {
    const res = parsePlanogramWorkbook(
      workbook({
        'Aisle 1': [
          HEADER,
          [1, 810127980310, 'First', 'S1', 1],
          [2, '810127980310', 'Same product, text-typed', 'S2', 2],
        ],
      }),
    )
    expect(res.items).toHaveLength(1)
    expect(res.items[0].name).toBe('First')
  })

  it('falls back to column B when no sheet has a recognizable header', () => {
    const res = parsePlanogramWorkbook(
      workbook({ Sheet1: [['x', 810127980310, 'No header here', 'S1', 1]] }),
    )
    expect(res.headerDetected).toBe(false)
    expect(res.items.map((i) => i.gtin)).toEqual(['00810127980310'])
  })

  it('finds the GTIN column under alternate header labels', () => {
    const res = parsePlanogramWorkbook(
      workbook({ Sheet1: [['Loc', 'UPC', 'Name'], [1, '073100001079', 'Copenhagen']] }),
    )
    expect(res.headerDetected).toBe(true)
    expect(res.items.map((i) => i.gtin)).toEqual(['00073100001079'])
  })

  // Heavily zero-padded GTINs are real short internal codes, not placeholders.
  // They must be kept and must match an order-rec item for the same product.
  it('keeps heavily zero-padded GTINs as ordinary products', () => {
    const res = parsePlanogramWorkbook(
      workbook({
        'Aisle 1': [
          HEADER,
          [1, '000000000338', 'CanClass KO ULTBLU 20 CRT', 'Shelf 32', 14],
          [2, 810127980310, 'Zolt Wintergreen 15MG Tin', 'Shelf 74', 10],
        ],
      }),
    )
    expect(res.items.map((i) => i.gtin)).toEqual(['00000000000338', '00810127980310'])
  })

  it('returns no items for a workbook with no usable GTINs', () => {
    const res = parsePlanogramWorkbook(
      workbook({ Sheet1: [['Report Aggregates', null], ['Total Cost', '$0.00']] }),
    )
    expect(res.items).toHaveLength(0)
  })
})

// ─── isOffPlanogram ───────────────────────────────────────────────────────────

describe('planogramKey', () => {
  it('prefers crtCode over gtin when the item has one', () => {
    expect(planogramKey({ gtin: '00001911605605', crtCode: '1966850289' })).toBe(
      '00001966850289',
    )
  })

  it('falls back to gtin when there is no crtCode', () => {
    for (const crtCode of ['', null, undefined]) {
      expect(planogramKey({ gtin: '00042100008715', crtCode })).toBe('00042100008715')
    }
  })

  // A CSV that has been through Excel renders column B as "6.80085E+11" — the
  // real digits are already gone. Falling back to the gtin is the only honest
  // move; matching on the mangled text would flag a real product.
  it('falls back to gtin when the crtCode is unreadable', () => {
    expect(planogramKey({ gtin: '00042100008715', crtCode: '6.80085E+11' })).toBe(
      '00042100008715',
    )
    expect(planogramKey({ gtin: '00042100008715', crtCode: '↑' })).toBe('00042100008715')
  })

  it('is null only when neither code is readable', () => {
    expect(planogramKey({ gtin: '', crtCode: '' })).toBeNull()
    expect(planogramKey({ gtin: 'not-a-gtin', crtCode: '↑' })).toBeNull()
    expect(planogramKey(null)).toBeNull()
  })
})

describe('isOffPlanogram', () => {
  // The planogram stores canonical GTIN-14 keys.
  const planogram = new Set(['00810127980310', '00073100001079'])

  it('flags a GTIN that is not in the planogram', () => {
    expect(isOffPlanogram({ gtin: '999999999999' }, planogram, false)).toBe(true)
  })

  it('does not flag a GTIN that is in the planogram', () => {
    expect(isOffPlanogram({ gtin: '810127980310' }, planogram, false)).toBe(false)
  })

  // The order rec stores '073100001079' while Excel may have given the
  // planogram 73100001079. Both must resolve to the same key.
  it('matches across the leading-zero/number-typing split', () => {
    expect(isOffPlanogram({ gtin: '073100001079' }, planogram, false)).toBe(false)
    expect(isOffPlanogram({ gtin: 73100001079 }, planogram, false)).toBe(false)
  })

  // Decision: a site with no planogram is skipped entirely rather than having
  // every item flagged.
  it('flags nothing when the site has no planogram', () => {
    expect(isOffPlanogram({ gtin: '999999999999' }, null, false)).toBe(false)
  })

  it('never flags station supplies', () => {
    expect(isOffPlanogram({ gtin: '999999999999' }, planogram, true)).toBe(false)
  })

  // Regression: '000000000338' is a real product, not a placeholder. Whatever
  // width the two sides store it at, it must resolve to one key and not flag.
  it('matches a heavily zero-padded GTIN that is a real product', () => {
    const withShortCode = new Set([normalizeGtin('000000000338')])
    expect([...withShortCode][0]).toBe('00000000000338')

    for (const variant of ['000000000338', '00000000000338', '0000000000338', 338]) {
      expect(isOffPlanogram({ gtin: variant }, withShortCode, false)).toBe(false)
    }
  })

  it('fails open on an item with no code it can read', () => {
    expect(isOffPlanogram({ gtin: '' }, planogram, false)).toBe(false)
    expect(isOffPlanogram({ gtin: null }, planogram, false)).toBe(false)
    expect(isOffPlanogram({ gtin: 'not-a-gtin' }, planogram, false)).toBe(false)
  })

  // The reason this feature was rebuilt. A cigarette item's gtin is the PACK
  // barcode; the planogram lists the carton code. Comparing the gtin flagged
  // every carton-sold product in the file.
  describe('carton-sold items', () => {
    // "Putters KO LT 20": pack barcode in column A, carton code in column B of
    // the CRT row. Only the carton code is on the planogram.
    const cartonPlanogram = new Set(['00001966850289'])

    it('does not flag an item whose crtCode is on the planogram', () => {
      expect(
        isOffPlanogram(
          { gtin: '00001911605605', crtCode: '1966850289' },
          cartonPlanogram,
          false,
        ),
      ).toBe(false)
    })

    it('flags an item whose crtCode is absent even though its gtin would miss too', () => {
      expect(
        isOffPlanogram(
          { gtin: '00002303085388', crtCode: '23030853859' },
          cartonPlanogram,
          false,
        ),
      ).toBe(true)
    })

    // The half of the file with no CRT row at all — every Chew item — is keyed
    // by gtin on the planogram and must keep matching that way.
    it('still matches an item with no crtCode by its gtin', () => {
      const mixed = new Set(['00001966850289', '00042100008715'])
      expect(isOffPlanogram({ gtin: '00042100008715', crtCode: '' }, mixed, false)).toBe(
        false,
      )
    })
  })

  // Regression for the station-supply exemption. In the create route the
  // category number arrives as the NUMBER 5001, copied off ProductCategory.Number
  // before Mongoose casts it to the schema's String — so `!== "5001"` is always
  // true and the exemption silently never fires. The call sites must coerce.
  it('exempts station supplies whether the category number is a string or a number', () => {
    const numericCategoryNumber = 5001
    const stringCategoryNumber = '5001'

    expect(String(numericCategoryNumber) === '5001').toBe(true)
    expect(String(stringCategoryNumber) === '5001').toBe(true)
    // The raw comparison the coercion protects against:
    expect(numericCategoryNumber !== '5001').toBe(true)

    expect(
      isOffPlanogram(
        { gtin: '999999999999' },
        planogram,
        String(numericCategoryNumber) === '5001',
      ),
    ).toBe(false)
  })
})

// ─── Planogram schema ─────────────────────────────────────────────────────────

describe('Planogram schema — field validation', () => {
  it('passes validation with a site', () => {
    expect(new Planogram({ site: 'Silver Grizzly' }).validateSync()).toBeUndefined()
  })

  it('rejects a missing site', () => {
    const err = new Planogram({}).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('defaults items to an empty array and gtinCount to 0', () => {
    const doc = new Planogram({ site: 'Silver Grizzly' })
    expect(doc.items).toEqual([])
    expect(doc.gtinCount).toBe(0)
  })

  it('requires a gtin on each item', () => {
    const err = new Planogram({
      site: 'Silver Grizzly',
      items: [{ name: 'No GTIN here' }],
    }).validateSync()
    expect(err?.errors['items.0.gtin']).toBeDefined()
  })

  it('keeps a site unique index so one site has one planogram', () => {
    const siteIndex = Planogram.schema
      .indexes()
      .find(([fields]) => fields.site === 1)
    expect(siteIndex?.[1]?.unique).toBe(true)
  })
})
