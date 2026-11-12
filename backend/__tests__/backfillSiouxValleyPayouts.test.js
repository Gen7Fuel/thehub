import { describe, expect, it } from 'vitest'
import backfill from '../manual/backfillSiouxValleyPayouts'

describe('Sioux Valley payout backfill source validation', () => {
  it('moves wins out of lottery payouts and includes them in general payouts', () => {
    const result = backfill.correction('Payouts 120.00\r\nLOTTO WIN 2.00\r\nLotto Payout 120.00\r\n')
    expect(result.values).toEqual({ payouts: 122, parsedPayouts: 122, lottoPayout: 120 })
    expect(result.lottoWin).toBe(2)
  })
  it('accepts zero payouts without erasing a valid zero', () => {
    expect(backfill.correction('Payouts 0.00\n').values).toEqual({ payouts: 0, parsedPayouts: 0, lottoPayout: 0 })
  })
  it.each(['', 'Report not found', 'LOTTO WIN: $35.00', 'Payouts 12.00\nLOTTO WIN $35.00'])('rejects an unusable report: %s', content => {
    expect(() => backfill.correction(content)).toThrow()
  })
  it('preserves payouts when no LOTTO WIN line exists', () => {
    expect(backfill.correction('Payouts 32.01\nLotto Payout 32.01\n').values).toEqual({ payouts: 32.01, parsedPayouts: 32.01, lottoPayout: 32.01 })
  })
})
