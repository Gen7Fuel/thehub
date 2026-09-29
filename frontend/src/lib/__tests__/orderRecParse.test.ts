import { describe, it, expect } from 'vitest'

import { parseOrderRecCSV, type OrderRecParseStats } from '../orderRecParse'

const newStats = (): OrderRecParseStats => ({ unreadableCartonCodes: 0, samples: [] })

// Rows lifted from a real Silver Grizzly order rec ("sg ste 1"). Column A is the
// GTIN, column B the code we want, column C the VIN, column D the form of the
// row (PK / CS / CRT).
const HEADER = [
  'Generated: 08/10/2026 03:29:15 PM EDT,,,,,,,,,,,,,,,',
  'GTIN,,VIN,Item Name,Size,On Hand Qty,Forecast *,Min Stock,Items to Order,Unit in Case,"Case Cost, $","Case Retail, $",Cases to Order,"Cost, $","Retail, $",',
].join('\n')

const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')

const CIGARETTES = '101 | Cigarettes FN,,,,,531,626,244,387,,,,,,,'

// Putters KO LT 20 — pack row, then its case and carton sub-rows.
const PUTTERS = [
  ' 00001911605605,,128Pk ,Putters KO LT 20 PK ,PK ,1063,1341,650,928,10,0,50,93,0,0,Remove',
  'Scan rate < 80%,,,,,,,,,,,,,,,',
  ',1966850203,128Cs,Putters KO LT 20 CS ,500 ,2,3,2,2,1,!,2500,2,0,0,←',
  ',1966850289,128,Putters KO LT 20 CRT ,10 ,106,135,65,93,50,!,2500,7,0,0,←',
]

describe('parseOrderRecCSV — crtCode', () => {
  it('takes crtCode from column B of the CRT row', () => {
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...PUTTERS))
    expect(cat.items).toHaveLength(1)
    expect(cat.items[0].gtin).toBe('00001911605605')
    expect(cat.items[0].crtCode).toBe('1966850289')
  })

  // The case row sits between the pack row and the carton row in this file, and
  // in others the order is reversed. Column D is what decides, not position.
  it('ignores the CS row even when it comes first', () => {
    const reordered = [PUTTERS[0], PUTTERS[1], PUTTERS[3], PUTTERS[2]]
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...reordered))
    expect(cat.items[0].crtCode).toBe('1966850289')
  })

  it('matches CRT case-insensitively', () => {
    for (const form of ['CRT', 'Crt', 'crt', 'cRt']) {
      const rows = [PUTTERS[0], `,1966850289,128,Putters KO LT 20 ${form} ,10 ,106,135,65,93,50,!,2500,7,0,0,←`]
      const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
      expect(cat.items[0].crtCode).toBe('1966850289')
    }
  })

  // Cigars carry CRT rows too. The old parser only looked at categories matching
  // /cigarette/i, so all 18 of them in the sample went without a code.
  it('extracts crtCode outside the cigarette categories', () => {
    const rows = [
      '102 | Cigars FN,,,,,10,12,4,8,,,,,,,',
      ' 00071610340169,,2901Pk ,Backwoods Black Russian 5PK ,PK ,20,10,5,5,1,0,6,1,0,0,Remove',
      ',71610340169,2901,Backwoods Black Russian CRT ,8 ,4,2,1,1,8,!,48,1,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(...rows))
    expect(cat.name).toBe('Cigars FN')
    expect(cat.items[0].crtCode).toBe('71610340169')
  })

  it('leaves crtCode empty for an item with no CRT row', () => {
    const rows = [
      '103 | Chew FN,,,,,10,12,4,8,,,,,,,',
      ' 00042100008715,,205Ti ,Grizzly Wintergreen Long Cut Tin ,TIN ,30,20,10,10,1,0,6,1,0,0,Remove',
      ',42100008722,205Sl,Grizzly Wintergreen Long Cut Sleeve ,5 ,6,4,2,2,5,!,30,1,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(...rows))
    expect(cat.items[0].gtin).toBe('00042100008715')
    expect(cat.items[0].crtCode).toBe('')
  })

  // These bags ARE the carton, so the CRT match lands on the item's own row —
  // where column B is empty. No crtCode, and the backend falls back to the GTIN,
  // which is what the planogram lists for them.
  it('yields no crtCode when the item row itself is the carton', () => {
    const rows = [
      ' 00100000050545,,102Bg ,FN Rollies MT 200 BAG CRT ,BAG ,12,8,4,4,1,0,30,1,0,0,Remove',
      ',100000903322,102Cs,FN Rollies MTH CS ,6 ,2,1,1,1,6,!,180,1,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items[0].gtin).toBe('00100000050545')
    expect(cat.items[0].crtCode).toBe('')
  })

  // Regression: the previous implementation scanned to the end of the file, so
  // an item with no carton row of its own silently adopted the next item's.
  it('does not borrow a later item\'s CRT row', () => {
    const rows = [
      ' 00300000701151,,330 ,Ceremonial Tobacco 100g ,100G ,5,3,1,2,1,0,20,1,0,0,Remove',
      ',322652,330,Ceremonial Leaf Tobacco ,1 ,5,3,1,2,1,!,20,1,0,0,←',
      ...PUTTERS,
    ]
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items).toHaveLength(2)
    expect(cat.items[0].itemName.trim()).toBe('Ceremonial Tobacco 100g')
    expect(cat.items[0].crtCode).toBe('')
    expect(cat.items[1].crtCode).toBe('1966850289')
  })

  // A CSV round-tripped through Excel writes column B as "6.80085E+11"; the real
  // digits are gone. Rejecting it here is what makes the backend fall back to the
  // GTIN instead of comparing the planogram against mangled text.
  it('rejects a column B that lost its digits to scientific notation', () => {
    const rows = [
      PUTTERS[0],
      ',6.80085E+11,128,Putters KO LT 20 CRT ,10 ,106,135,65,93,50,!,2500,7,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items[0].crtCode).toBe('')
  })

  // "↑" means "same as the row above" in these exports.
  it('rejects the repeat marker in column B', () => {
    const rows = [
      PUTTERS[0],
      ',↑,128,Putters KO LT 20 CRT ,10 ,106,135,65,93,50,!,2500,7,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items[0].crtCode).toBe('')
  })
})

describe('parseOrderRecCSV — unreadable carton code reporting', () => {
  it('reports a column B that lost its digits, with the offending value', () => {
    const stats = newStats()
    const rows = [
      PUTTERS[0],
      ',6.80085E+11,128,Putters KO LT 20 CRT ,10 ,106,135,65,93,50,!,2500,7,0,0,←',
    ]
    parseOrderRecCSV(csv(CIGARETTES, ...rows), stats)
    expect(stats.unreadableCartonCodes).toBe(1)
    expect(stats.samples).toEqual(['6.80085E+11'])
  })

  it('counts every mangled row but keeps at most three distinct samples', () => {
    const stats = newStats()
    const mangled = ['1.96685E+09', '2.34561E+10', '2.39099E+10', '3.00000E+11']
    const rows = mangled.flatMap((code, n) => [
      ` 0000191160560${n},,12${n}Pk ,Item ${n} PK ,PK ,10,10,5,5,10,0,50,1,0,0,Remove`,
      `,${code},12${n},Item ${n} CRT ,10 ,10,10,5,5,50,!,2500,1,0,0,←`,
    ])
    parseOrderRecCSV(csv(CIGARETTES, ...rows), stats)
    expect(stats.unreadableCartonCodes).toBe(4)
    expect(stats.samples).toHaveLength(3)
  })

  it('does not count a repeated value twice in the samples', () => {
    const stats = newStats()
    const rows = [0, 1].flatMap(n => [
      ` 0000191160560${n},,12${n}Pk ,Item ${n} PK ,PK ,10,10,5,5,10,0,50,1,0,0,Remove`,
      `,6.80085E+11,12${n},Item ${n} CRT ,10 ,10,10,5,5,50,!,2500,1,0,0,←`,
    ])
    parseOrderRecCSV(csv(CIGARETTES, ...rows), stats)
    expect(stats.unreadableCartonCodes).toBe(2)
    expect(stats.samples).toEqual(['6.80085E+11'])
  })

  it('reports the repeat marker as unreadable too', () => {
    const stats = newStats()
    const rows = [
      PUTTERS[0],
      ',↑,128,Putters KO LT 20 CRT ,10 ,106,135,65,93,50,!,2500,7,0,0,←',
    ]
    parseOrderRecCSV(csv(CIGARETTES, ...rows), stats)
    expect(stats.unreadableCartonCodes).toBe(1)
  })

  // An empty cell is the normal shape for a bag-style product that is its own
  // carton. Warning about those would fire on every clean file.
  it('does not report an empty column B as unreadable', () => {
    const stats = newStats()
    const rows = [
      ' 00100000050545,,102Bg ,FN Rollies MT 200 BAG CRT ,BAG ,12,8,4,4,1,0,30,1,0,0,Remove',
      ',100000903322,102Cs,FN Rollies MTH CS ,6 ,2,1,1,1,6,!,180,1,0,0,←',
    ]
    parseOrderRecCSV(csv(CIGARETTES, ...rows), stats)
    expect(stats.unreadableCartonCodes).toBe(0)
  })

  it('reports nothing for a clean file', () => {
    const stats = newStats()
    parseOrderRecCSV(csv(CIGARETTES, ...PUTTERS), stats)
    expect(stats).toEqual({ unreadableCartonCodes: 0, samples: [] })
  })

  it('parses the same either way when no stats object is passed', () => {
    const rows = [
      PUTTERS[0],
      ',6.80085E+11,128,Putters KO LT 20 CRT ,10 ,106,135,65,93,50,!,2500,7,0,0,←',
    ]
    expect(() => parseOrderRecCSV(csv(CIGARETTES, ...rows))).not.toThrow()
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items[0].crtCode).toBe('')
  })
})

describe('parseOrderRecCSV — item data source', () => {
  // Unchanged behaviour: cigarettes are ordered by the carton, so quantities
  // come off the CRT row while the GTIN stays the pack barcode.
  it('reads cigarette quantities from the CRT row', () => {
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...PUTTERS))
    const item = cat.items[0]
    expect(item.gtin).toBe('00001911605605')
    expect(item.onHandQty).toBe(106)
    expect(item.itemsToOrder).toBe(93)
    expect(item.unitInCase).toBe(50)
  })

  it('reads non-cigarette quantities from the item row', () => {
    const rows = [
      '103 | Chew FN,,,,,10,12,4,8,,,,,,,',
      ' 00042100008715,,205Ti ,Grizzly Wintergreen Long Cut Tin ,TIN ,30,20,10,10,1,0,6,4,0,0,Remove',
      ',42100008722,205Sl,Grizzly Wintergreen Long Cut Sleeve ,5 ,6,4,2,2,5,!,30,1,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(...rows))
    expect(cat.items[0].onHandQty).toBe(30)
    expect(cat.items[0].casesToOrder).toBe(4)
  })

  // Previously an item whose carton row could not be found was dropped from the
  // order rec entirely. Losing a line off an order is worse than any fallback.
  it('keeps a cigarette item that has no CRT row', () => {
    const rows = [
      ' 00300000701151,,330 ,Ceremonial Tobacco 100g ,100G ,5,3,1,2,1,0,20,1,0,0,Remove',
      ',322652,330,Ceremonial Leaf Tobacco ,1 ,5,3,1,2,1,!,20,1,0,0,←',
    ]
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items).toHaveLength(1)
    expect(cat.items[0].onHandQty).toBe(5)
  })

  it('stops at the TOTALS row', () => {
    const rows = [...PUTTERS, 'TOTALS:,,,,,1,2,3,4,,,,,,,', ' 00099999999999,,999,Should Not Appear ,PK ,1,1,1,1,1,0,1,1,0,0,Remove']
    const [cat] = parseOrderRecCSV(csv(CIGARETTES, ...rows))
    expect(cat.items).toHaveLength(1)
  })
})
