import { describe, expect, it } from 'vitest'
import { buildOtherReceiptLines, otherReceiptTotal } from '../cashRecOtherReceipt'
import type { CashRecFigures } from '../cashRecOtherReceipt'

const zero: CashRecFigures = {
  gblMonerisFuelSales: 0,
  canadianCash: 0,
  kardpollSales: 0,
  storeSales: 0,
  lotterySales: 0,
  lotteryPayouts: 0,
  cashSafeDeposited: 0,
  tillOverShort: 0,
  gcRedemption: 0,
  loyalty: 0,
  unsettledPrepays: 0,
  bankRec: 0,
}

// Charlie's 2026-10-04 as entered by hand in Intacct (total 9,047.89).
const charlies: CashRecFigures = {
  ...zero,
  gblMonerisFuelSales: 5573.91,
  canadianCash: 2006.35,
  storeSales: 2962.76,
  cashSafeDeposited: 2003.3,
  tillOverShort: -3.05,
  gcRedemption: 11.5,
  bankRec: 522.72,
}

describe('buildOtherReceiptLines', () => {
  it('reproduces the hand-made Charlie’s entry, line for line', () => {
    const rows = buildOtherReceiptLines(charlies).map((l) => [l.glAccount, l.amount, l.memo])
    expect(rows).toEqual([
      ['40010', 5573.91, 'Fuel Sales'],
      ['40010', 2006.35, 'Cash Sales'],
      ['40200', 2962.76, ''],
      ['10011', -2003.3, 'Cash deposit'],
      ['55050', -3.05, 'Till short'],
      ['52250', -11.5, ''],
      ['55050', 522.72, 'Bank over'],
    ])
    expect(otherReceiptTotal(buildOtherReceiptLines(charlies))).toBe(9047.89)
  })

  it('leaves out zero-value rows, including ones that round to zero', () => {
    expect(buildOtherReceiptLines(zero)).toEqual([])
    expect(buildOtherReceiptLines({ ...zero, kardpollSales: 0.004 })).toEqual([])
  })

  it('negates safe deposit, gift card redemption and loyalty only', () => {
    const lines = buildOtherReceiptLines({
      ...zero,
      cashSafeDeposited: 100,
      gcRedemption: 20,
      loyalty: 5,
      lotteryPayouts: 40,
      storeSales: 10,
    })
    const byKey = Object.fromEntries(lines.map((l) => [l.key, l.amount]))
    expect(byKey).toEqual({ store: 10, lotteryPayouts: 40, cashSafe: -100, giftCard: -20, loyalty: -5 })
  })

  it('sends yellow rows with the sign the page shows, and labels till and bank by sign', () => {
    const lines = buildOtherReceiptLines({ ...zero, tillOverShort: 4.5, bankRec: -10, unsettledPrepays: -25 })
    expect(lines.map((l) => [l.key, l.amount, l.memo])).toEqual([
      ['tillOverShort', 4.5, 'Till over'],
      ['unsettledPrepays', -25, ''],
      ['bankRec', -10, 'Bank short'],
    ])
  })

  it('tags the Bank Rec line so the server can drop it', () => {
    expect(buildOtherReceiptLines({ ...zero, bankRec: 1 })[0].key).toBe('bankRec')
  })
})
