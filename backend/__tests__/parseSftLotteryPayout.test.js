import { describe, expect, it } from 'vitest'
import parser from '../utils/parseSftReport.js'

const { parseSftReport } = parser

describe('SFT lottery payout formulas by location', () => {
  const report = 'Payouts                 26.00\nLotto Payout           100.00\nLOTTO WIN               35.00\n'

  it.each(['Sioux Valley', ' sioux valley ', 'SIOUX VALLEY'])(
    'adds LOTTO WIN to Lotto Payout for %s', site => {
      const parsed = parseSftReport(report, site)
      expect(parsed.lottoPayout).toBe(135)
      // General payouts are separate from lottery payouts.
      expect(parsed.payouts).toBe(26)
    },
  )

  it.each(['Rankin', 'Wavers West', 'Wavers East', 'Couchiching', 'New Location', undefined])(
    'excludes LOTTO WIN for %s', site => {
      expect(parseSftReport(report, site).lottoPayout).toBe(100)
      expect(parseSftReport('LOTTO WIN 35.00\n', site).lottoPayout).toBeNull()
    },
  )

  it('uses the pictured Sioux Valley win when no Lotto Payout line exists', () => {
    const parsed = parseSftReport('Payouts 26.00\nLOTTO WIN 35.00\nCanadian Cash 1959.70\n', 'Sioux Valley')
    expect(parsed.lottoPayout).toBe(35)
    expect(parsed.payouts).toBe(26)
    expect(parsed.canadianCash).toBe(1959.70)
  })

  it.each(['Sioux Valley', 'Rankin'])(
    'preserves missing, zero and payout-only values for %s', site => {
      expect(parseSftReport('Payouts 26.00\n', site).lottoPayout).toBeNull()
      expect(parseSftReport('Lotto Payout 0.00\n', site).lottoPayout).toBe(0)
      expect(parseSftReport('Lotto Payout 100.00\n', site).lottoPayout).toBe(100)
    },
  )

  it('handles signed amounts, comma separators and currency formatting', () => {
    expect(parseSftReport('Lotto Payouts: $1,200.10\nLOTTO WIN -35.05\n', 'Sioux Valley').lottoPayout).toBe(1165.05)
    expect(parseSftReport('Lotto Payout 0.10\nLOTTO WIN 0.20\n', 'Sioux Valley').lottoPayout).toBe(0.3)
    expect(parseSftReport('LOTTO WIN 0.00\n', 'Sioux Valley').lottoPayout).toBe(0)
  })
})
