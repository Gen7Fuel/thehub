import { describe, expect, it } from 'vitest'
import parser from '../utils/parseSftReport.js'

const { parseSftReport } = parser

describe('SFT payout formulas by location', () => {
  const report = 'Payouts                 26.00\nLotto Payout           100.00\nLOTTO WIN               35.00\n'

  it.each(['Sioux Valley', ' sioux valley ', 'SIOUX VALLEY'])(
    'adds LOTTO WIN to general payouts for %s', site => {
      const parsed = parseSftReport(report, site)
      expect(parsed.lottoPayout).toBe(100)
      expect(parsed.payouts).toBe(61)
    },
  )

  it.each(['Rankin', 'Wavers West', 'Wavers East', 'Couchiching', 'New Location', undefined])(
    'excludes LOTTO WIN for %s', site => {
      const parsed = parseSftReport(report, site)
      expect(parsed.lottoPayout).toBe(100)
      expect(parsed.payouts).toBe(26)
      expect(parseSftReport('LOTTO WIN 35.00\n', site).payouts).toBeNull()
    },
  )

  it('uses the pictured Sioux Valley win when no Lotto Payout line exists', () => {
    const parsed = parseSftReport('Payouts 26.00\nLOTTO WIN 35.00\nCanadian Cash 1959.70\n', 'Sioux Valley')
    expect(parsed.lottoPayout).toBeNull()
    expect(parsed.payouts).toBe(61)
    expect(parsed.canadianCash).toBe(1959.70)
  })

  it.each(['Sioux Valley', 'Rankin'])(
    'preserves missing, zero and payout-only values for %s', site => {
      expect(parseSftReport('Payouts 26.00\n', site).lottoPayout).toBeNull()
      expect(parseSftReport('Lotto Payout 0.00\n', site).lottoPayout).toBe(0)
      expect(parseSftReport('Lotto Payout 100.00\n', site).lottoPayout).toBe(100)
      expect(parseSftReport('', site).payouts).toBeNull()
      expect(parseSftReport('Payouts 0.00\n', site).payouts).toBe(0)
      expect(parseSftReport('Payouts 26.00\n', site).payouts).toBe(26)
    },
  )

  it('handles signed amounts, comma separators and currency formatting', () => {
    const parsed = parseSftReport('Payouts 1,200.10\nLotto Payouts: $100.00\nLOTTO WIN -35.05\n', 'Sioux Valley')
    expect(parsed.payouts).toBe(1165.05)
    expect(parsed.lottoPayout).toBe(100)
    expect(parseSftReport('Payouts 0.10\nLOTTO WIN 0.20\n', 'Sioux Valley').payouts).toBe(0.3)
    expect(parseSftReport('LOTTO WIN 0.00\n', 'Sioux Valley').payouts).toBe(0)
    expect(parseSftReport('LOTTO WIN 35.00\n', 'Sioux Valley').payouts).toBe(35)
  })
})
