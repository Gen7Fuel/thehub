// Turns the figures shown on the cash-rec page into the lines of the Intacct
// Other Receipt. The page's Sales and Deduction summary rows map to GL accounts
// as printed beside them; rows with no GL (sales tax, HH debit, balance check,
// totals) are not entered.

export interface OtherReceiptLine {
  /** Lets the server drop a line by rule (Bank Rec for sites without bank statement access). */
  key: string
  glAccount: string
  /** Signed, exactly as it should post. */
  amount: number
  memo: string
}

/** The numbers as the page displays them. */
export interface CashRecFigures {
  gblMonerisFuelSales: number
  canadianCash: number
  kardpollSales: number
  storeSales: number
  lotterySales: number
  lotteryPayouts: number
  /** Positive on the page; posts as a credit to the store safe. */
  cashSafeDeposited: number
  /** Signed: negative is short. */
  tillOverShort: number
  /** Positive on the page; posts negative. */
  gcRedemption: number
  /** Positive on the page; posts negative. */
  loyalty: number
  /** The value the Unsettled Prepays row displays (already negated by the page). */
  unsettledPrepays: number
  /** Signed: negative is short. */
  bankRec: number
}

const cents = (n: number) => Math.round(n * 100)

/** Lines in the order they appear on the entry; zero-value rows are left out. */
export function buildOtherReceiptLines(f: CashRecFigures): Array<OtherReceiptLine> {
  const lines: Array<OtherReceiptLine> = [
    { key: 'gbl', glAccount: '40010', amount: f.gblMonerisFuelSales, memo: 'Fuel Sales' },
    { key: 'canadianCash', glAccount: '40010', amount: f.canadianCash, memo: 'Cash Sales' },
    { key: 'kardpoll', glAccount: '40010', amount: f.kardpollSales, memo: '' },
    { key: 'store', glAccount: '40200', amount: f.storeSales, memo: '' },
    { key: 'lotterySales', glAccount: '20440', amount: f.lotterySales, memo: '' },
    { key: 'lotteryPayouts', glAccount: '20440', amount: f.lotteryPayouts, memo: '' },
    { key: 'cashSafe', glAccount: '10011', amount: -f.cashSafeDeposited, memo: 'Cash deposit' },
    {
      key: 'tillOverShort',
      glAccount: '55050',
      amount: f.tillOverShort,
      memo: f.tillOverShort < 0 ? 'Till short' : 'Till over',
    },
    { key: 'giftCard', glAccount: '52250', amount: -f.gcRedemption, memo: '' },
    { key: 'loyalty', glAccount: '52175', amount: -f.loyalty, memo: '' },
    { key: 'unsettledPrepays', glAccount: '40010', amount: f.unsettledPrepays, memo: '' },
    {
      key: 'bankRec',
      glAccount: '55050',
      amount: f.bankRec,
      memo: f.bankRec < 0 ? 'Bank short' : 'Bank over',
    },
  ]
  return lines.filter((l) => Number.isFinite(l.amount) && cents(l.amount) !== 0)
}

export function otherReceiptTotal(lines: Array<OtherReceiptLine>): number {
  return lines.reduce((sum, l) => sum + cents(l.amount), 0) / 100
}
