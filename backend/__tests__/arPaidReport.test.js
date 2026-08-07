import { describe, it, expect } from 'vitest'
// Pure util — no DB connection required. Do NOT import config/db.js here.
import ArPaidReportModule from '../utils/arPaidReport.js'

const {
  buildArPaidReport,
  AR_PAID_REPORT_SITES,
  MIN_MONTH,
  UNNAMED_CUSTOMER,
  monthWindowUtc,
  formatMoney,
  formatDateLabel,
  formatDateList,
  formatShiftList,
  numberWord,
  docToYmd,
  compareShiftNumber,
} = ArPaidReportModule

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Mirrors the real write path: the cash-summary form sends browser-local
// midnight as ISO, so a Winnipeg-filed July 16 shift is stored at T05:00Z.
const shiftDate = (ymd) => new Date(`${ymd}T05:00:00.000Z`)

const shift = (ymd, shiftNumber, arCustomers = [], site = 'Wavers West') => ({
  site,
  shift_number: shiftNumber,
  date: shiftDate(ymd),
  arCustomers,
})

const WEST = AR_PAID_REPORT_SITES[0]
const EAST = AR_PAID_REPORT_SITES[1]

const build = (docs, month = '2026-07') =>
  buildArPaidReport({ month, siteConfigs: AR_PAID_REPORT_SITES, docs })

const westOf = (report) => report.sites.find((s) => s.site === 'Wavers West')
const eastOf = (report) => report.sites.find((s) => s.site === 'Wavers East')

// ─── monthWindowUtc ───────────────────────────────────────────────────────────

describe('monthWindowUtc', () => {
  it('builds a half-open UTC window for a normal month', () => {
    const { start, end } = monthWindowUtc('2026-07')
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('rolls December over into the next year', () => {
    const { start, end } = monthWindowUtc('2026-12')
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('handles a 28-day February', () => {
    expect(monthWindowUtc('2027-02').end.toISOString()).toBe('2027-03-01T00:00:00.000Z')
  })

  it('includes a shift filed on the last day of the month', () => {
    const { start, end } = monthWindowUtc('2026-07')
    const lastShift = shiftDate('2026-07-31')
    expect(lastShift >= start && lastShift < end).toBe(true)
  })

  it('excludes a shift filed on the first day of the next month', () => {
    const { end } = monthWindowUtc('2026-07')
    expect(shiftDate('2026-08-01') < end).toBe(false)
  })
})

describe('periodLabel', () => {
  it('spans the full month with a spaced en dash', () => {
    expect(build([]).periodLabel).toBe('July 1 – July 31, 2026')
  })

  it('reports 29 days for a leap-year February', () => {
    expect(build([], '2028-02').periodLabel).toBe('February 1 – February 29, 2028')
  })

  it('reports 28 days for a non-leap February', () => {
    expect(build([], '2027-02').periodLabel).toBe('February 1 – February 28, 2027')
  })
})

// ─── Formatters ───────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it.each([
    [2925.03, '$2,925.03'],
    [949.98, '$949.98'],
    [0, '$0.00'],
    [1234567.5, '$1,234,567.50'],
    [-949.98, '-$949.98'],
    [1000, '$1,000.00'],
    [999.999, '$1,000.00'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatMoney(input)).toBe(expected)
  })
})

describe('formatDateLabel / docToYmd', () => {
  it('formats a ymd string', () => {
    expect(formatDateLabel('2026-07-16')).toBe('July 16, 2026')
  })

  it('recovers the filed day from a local-midnight-in-UTC timestamp', () => {
    expect(docToYmd(new Date('2026-07-16T05:00:00Z'))).toBe('2026-07-16')
  })

  it('is stable late in the UTC day', () => {
    expect(docToYmd(new Date('2026-07-16T23:30:00Z'))).toBe('2026-07-16')
  })

  it('accepts an ISO string as well as a Date', () => {
    expect(docToYmd('2026-07-16T05:00:00Z')).toBe('2026-07-16')
  })

  it('returns null for an unparseable date', () => {
    expect(docToYmd('not-a-date')).toBeNull()
  })
})

describe('formatDateList', () => {
  it('states one date with its year', () => {
    expect(formatDateList(['2026-07-16'])).toBe('July 16, 2026')
  })

  it('joins two dates with "and" and one trailing year', () => {
    expect(formatDateList(['2026-07-16', '2026-07-17'])).toBe('July 16 and July 17, 2026')
  })

  it('uses an Oxford comma for three or more', () => {
    expect(formatDateList(['2026-07-16', '2026-07-17', '2026-07-18']))
      .toBe('July 16, July 17, and July 18, 2026')
  })
})

describe('formatShiftList', () => {
  it.each([
    [['10012'], '10012'],
    [['10012', '20014'], '10012 and 20014'],
    [['10012', '20014', '40009'], '10012, 20014, and 40009'],
  ])('joins %j', (input, expected) => {
    expect(formatShiftList(input)).toBe(expected)
  })
})

describe('numberWord', () => {
  it.each([[0, 'zero'], [1, 'one'], [2, 'two'], [20, 'twenty'], [21, '21']])(
    'renders %s as %s',
    (n, expected) => expect(numberWord(n)).toBe(expected),
  )
})

describe('compareShiftNumber', () => {
  it('sorts numerically, not lexicographically', () => {
    expect(['10012', '9001', '20014'].sort(compareShiftNumber))
      .toEqual(['9001', '10012', '20014'])
  })

  it('places non-numeric shift numbers after numeric ones', () => {
    expect(['SFT-2', '10012'].sort(compareShiftNumber)).toEqual(['10012', 'SFT-2'])
  })
})

// ─── Regression anchor: reproduces the hand-made June sample ──────────────────

describe('buildArPaidReport — sample document', () => {
  const docs = [
    shift('2026-07-16', '10012', [{ name: 'Sagkeeng', incurred: 400, paid: null }]),
    shift('2026-07-16', '20014', [{ name: 'SASco', incurred: 0, paid: 2925.03 }]),
    shift('2026-07-16', '40009', []),
    shift('2026-07-17', '10013', [{ name: 'Sagkeeng', incurred: 120.5, paid: 0 }]),
    shift('2026-07-17', '20016', [{ name: 'Hollow Water First Nation', incurred: 0, paid: 949.98 }]),
    shift('2026-07-17', '40012', []),
  ]

  const west = () => westOf(build(docs))

  it('lists every covered shift in date-then-numeric order', () => {
    expect(west().shiftNumbers).toEqual(['10012', '20014', '40009', '10013', '20016', '40012'])
    expect(west().shiftCount).toBe(6)
    expect(west().shiftDateYmds).toEqual(['2026-07-16', '2026-07-17'])
  })

  it('emits only the paying rows', () => {
    expect(west().rows).toEqual([
      {
        dateYmd: '2026-07-16',
        dateLabel: 'July 16, 2026',
        customer: 'SASco',
        shiftNumber: '20014',
        amount: 2925.03,
        amountLabel: '$2,925.03',
      },
      {
        dateYmd: '2026-07-17',
        dateLabel: 'July 17, 2026',
        customer: 'Hollow Water First Nation',
        shiftNumber: '20016',
        amount: 949.98,
        amountLabel: '$949.98',
      },
    ])
  })

  it('totals without float drift', () => {
    expect(west().totalPaid).toBe(3875.01)
    expect(west().totalPaidLabel).toBe('$3,875.01')
    expect(west().paymentCountLabel).toBe('2 payments')
  })

  it('composes the summary prose verbatim', () => {
    expect(west().summaryText).toBe(
      'This report covers all shift reports available for Wavers of Brokenhead dated '
      + 'July 16 and July 17, 2026 (shift numbers 10012, 20014, 40009, 10013, 20016, and 40012). '
      + 'Across these shifts, two accounts receivable (A/R) customers made a payment toward '
      + 'their outstanding balance. All other A/R customer entries during this period reflect '
      + 'charges incurred with no payment recorded.',
    )
  })

  it('collapses the payment dates into a cover-page range', () => {
    expect(west().coverageLabel).toBe('A/R payments recorded July 16–17, 2026')
  })

  it('uses the site name the EOD reports use', () => {
    expect(west().displayName).toBe('Wavers of Brokenhead')
    expect(eastOf(build(docs)).displayName).toBe('Brokenhead Community Store')
  })
})

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('paid filtering', () => {
  it.each([
    ['null', null],
    ['zero', 0],
    ['undefined', undefined],
    ['a numeric string', '100'],
    ['NaN', NaN],
  ])('excludes %s', (_label, paid) => {
    const report = build([shift('2026-07-16', '10012', [{ name: 'SASco', paid }])])
    expect(westOf(report).rows).toEqual([])
    expect(westOf(report).paymentCount).toBe(0)
  })

  it('includes a genuine payment', () => {
    const report = build([shift('2026-07-16', '10012', [{ name: 'SASco', paid: 2925.03 }])])
    expect(westOf(report).rows).toHaveLength(1)
  })

  it('still counts a shift whose customers only incurred charges', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: 'SASco', incurred: 500, paid: null }]),
    ])
    expect(westOf(report).rows).toEqual([])
    expect(westOf(report).shiftNumbers).toEqual(['10012'])
    expect(westOf(report).hasShifts).toBe(true)
  })

  it('tolerates a missing or non-array arCustomers', () => {
    const report = build([
      { site: 'Wavers West', shift_number: '10012', date: shiftDate('2026-07-16') },
      { site: 'Wavers West', shift_number: '10013', date: shiftDate('2026-07-16'), arCustomers: null },
    ])
    expect(westOf(report).rows).toEqual([])
    expect(westOf(report).shiftCount).toBe(2)
  })

  it('ignores docs for a site that is not in siteConfigs', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: 'SASco', paid: 500 }], 'Rankin'),
    ])
    expect(westOf(report).rows).toEqual([])
    expect(eastOf(report).rows).toEqual([])
    expect(report.grandTotalPaid).toBe(0)
  })
})

// ─── Aggregation ──────────────────────────────────────────────────────────────

describe('aggregation', () => {
  it('merges a duplicate customer name within one shift', () => {
    const report = build([
      shift('2026-07-16', '10012', [
        { name: 'SASco', paid: 100.5 },
        { name: 'SASco', paid: 200.25 },
      ]),
    ])
    expect(westOf(report).rows).toHaveLength(1)
    expect(westOf(report).rows[0].amount).toBe(300.75)
  })

  it('merges names differing only by surrounding whitespace, displaying the trimmed form', () => {
    const report = build([
      shift('2026-07-16', '10012', [
        { name: 'SASco', paid: 100 },
        { name: '  SASco  ', paid: 50 },
      ]),
    ])
    expect(westOf(report).rows).toHaveLength(1)
    expect(westOf(report).rows[0].customer).toBe('SASco')
    expect(westOf(report).rows[0].amount).toBe(150)
  })

  it('does not merge names differing by case (matches eodReportWavers)', () => {
    const report = build([
      shift('2026-07-16', '10012', [
        { name: 'SASco', paid: 100 },
        { name: 'sasco', paid: 50 },
      ]),
    ])
    expect(westOf(report).rows).toHaveLength(2)
  })

  it('drops a charge fully reversed within the same shift', () => {
    const report = build([
      shift('2026-07-16', '10012', [
        { name: 'SASco', paid: 100 },
        { name: 'SASco', paid: -100 },
      ]),
    ])
    expect(westOf(report).rows).toEqual([])
  })

  it('keeps one customer paying on two shifts as two rows', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: 'SASco', paid: 100 }]),
      shift('2026-07-17', '10013', [{ name: 'SASco', paid: 200 }]),
    ])
    const west = westOf(report)
    expect(west.paymentCount).toBe(2)
    expect(west.payingCustomerCount).toBe(1)
    expect(west.totalPaid).toBe(300)
    expect(west.summaryText).toContain('one accounts receivable (A/R) customer made a payment')
  })

  it('sorts rows by date, then numeric shift, then customer', () => {
    const report = build([
      shift('2026-07-17', '9001', [{ name: 'Zeta', paid: 10 }]),
      shift('2026-07-16', '10012', [{ name: 'Beta', paid: 10 }, { name: 'Alpha', paid: 10 }]),
      shift('2026-07-16', '9002', [{ name: 'Gamma', paid: 10 }]),
    ])
    expect(westOf(report).rows.map((r) => [r.dateYmd, r.shiftNumber, r.customer])).toEqual([
      ['2026-07-16', '9002', 'Gamma'],
      ['2026-07-16', '10012', 'Alpha'],
      ['2026-07-16', '10012', 'Beta'],
      ['2026-07-17', '9001', 'Zeta'],
    ])
  })

  it('sums integer cents so repeated decimals do not drift', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: 'A', paid: 0.1 }, { name: 'B', paid: 0.2 }]),
    ])
    expect(westOf(report).totalPaid).toBe(0.3)
    expect(westOf(report).totalPaidLabel).toBe('$0.30')
  })
})

// ─── Empty and degenerate months ──────────────────────────────────────────────

describe('empty months', () => {
  it('uses template B when a site has shifts but no payments', () => {
    const west = westOf(build([shift('2026-07-16', '10012', [{ name: 'SASco', paid: null }])]))
    expect(west.rows).toEqual([])
    expect(west.totalPaid).toBe(0)
    expect(west.coverageLabel).toBe('No A/R payments recorded')
    expect(west.paymentCountLabel).toBe('0 payments')
    expect(west.summaryText).toBe(
      'This report covers all shift reports available for Wavers of Brokenhead dated '
      + 'July 16, 2026 (shift number 10012). No accounts receivable (A/R) customers recorded '
      + 'a payment toward their outstanding balance during this period. All A/R customer '
      + 'entries during this period reflect charges incurred with no payment recorded.',
    )
  })

  it('uses template C when a site has no shift docs at all', () => {
    const east = eastOf(build([shift('2026-07-16', '10012', [{ name: 'SASco', paid: 100 }])]))
    expect(east.hasShifts).toBe(false)
    expect(east.shiftNumbers).toEqual([])
    expect(east.summaryText).toBe(
      'No shift reports are available for Brokenhead Community Store for July 2026. '
      + 'No accounts receivable (A/R) payments are recorded for this period.',
    )
  })

  it('still emits both sections when neither site has docs', () => {
    const report = build([])
    expect(report.sites.map((s) => s.site)).toEqual(['Wavers West', 'Wavers East'])
    expect(report.grandTotalPaid).toBe(0)
    expect(report.grandPaymentCount).toBe(0)
  })

  it('rolls one populated site up into the grand total', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: 'SASco', paid: 100 }]),
      shift('2026-07-16', '10021', [{ name: "Jordan's Principle", paid: 7816.94 }], 'Wavers East'),
    ])
    expect(report.grandTotalPaid).toBe(7916.94)
    expect(report.grandTotalPaidLabel).toBe('$7,916.94')
    expect(report.grandPaymentCount).toBe(2)
  })
})

// ─── Flags ────────────────────────────────────────────────────────────────────

describe('data-quality flags', () => {
  it('includes a negative payment and flags it', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: 'SASco', paid: 1000 }]),
      shift('2026-07-17', '10013', [{ name: 'SASco', paid: -949.98 }]),
    ])
    const west = westOf(report)
    expect(west.hasNegativeAmounts).toBe(true)
    expect(west.rows[1].amountLabel).toBe('-$949.98')
    expect(west.totalPaid).toBe(50.02)
  })

  it('emits a blank-named payer as (Unnamed) rather than dropping it', () => {
    const report = build([
      shift('2026-07-16', '10012', [{ name: '   ', paid: 50 }]),
    ])
    const west = westOf(report)
    expect(west.hasUnnamedCustomers).toBe(true)
    expect(west.rows[0].customer).toBe(UNNAMED_CUSTOMER)
    expect(west.totalPaid).toBe(50)
  })

  it('leaves both flags false on clean data', () => {
    const west = westOf(build([shift('2026-07-16', '10012', [{ name: 'SASco', paid: 100 }])]))
    expect(west.hasNegativeAmounts).toBe(false)
    expect(west.hasUnnamedCustomers).toBe(false)
  })
})

// ─── Prose scaling ────────────────────────────────────────────────────────────

describe('summary prose at full-month scale', () => {
  const manyShifts = Array.from({ length: 30 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return shift(`2026-07-${day}`, String(10000 + i), [])
  })

  it('stops enumerating shift numbers past the cap', () => {
    const west = westOf(build(manyShifts))
    expect(west.shiftCount).toBe(30)
    expect(west.summaryText).toContain('between July 1 and July 30, 2026 (30 shift reports)')
    expect(west.summaryText).not.toContain('10005,')
  })

  it('still enumerates at exactly the cap', () => {
    const west = westOf(build(manyShifts.slice(0, 12)))
    expect(west.summaryText).toContain('(shift numbers 10000, 10001,')
  })

  it('uses singular phrasing for a single shift and a single payer', () => {
    const west = westOf(build([shift('2026-07-16', '10012', [{ name: 'SASco', paid: 100 }])]))
    expect(west.summaryText).toContain('(shift number 10012)')
    expect(west.summaryText).toContain('Across this shift, one accounts receivable (A/R) customer made a payment')
  })
})

// ─── Purity ───────────────────────────────────────────────────────────────────

describe('purity', () => {
  const docs = [
    shift('2026-07-17', '20016', [{ name: 'Hollow Water First Nation', paid: 949.98 }]),
    shift('2026-07-16', '20014', [{ name: 'SASco', paid: 2925.03 }]),
  ]

  it('is deterministic across calls', () => {
    expect(build(docs)).toEqual(build(docs))
  })

  it('does not mutate the docs array or its members', () => {
    const before = JSON.parse(JSON.stringify(docs))
    build(docs)
    expect(JSON.parse(JSON.stringify(docs))).toEqual(before)
  })

  it('exposes the coverage floor the route enforces', () => {
    expect(MIN_MONTH).toBe('2026-07')
    expect(WEST.site).toBe('Wavers West')
    expect(EAST.site).toBe('Wavers East')
  })
})
