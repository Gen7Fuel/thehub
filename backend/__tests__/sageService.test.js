import { describe, it, expect, vi, afterEach } from 'vitest'
import sageService from '../services/sageService.js'
import bankAccounts from '../constants/sageBankAccounts.js'
import CashRecModule from '../models/CashRec.js'

const { buildInvoiceNumber, buildBillPayload, buildPaymentPayload } = sageService
const { SITE_BANK_ACCOUNTS } = bankAccounts
const { BankStatement } = CashRecModule

describe('buildInvoiceNumber', () => {
  it('matches the format used in the Intacct UI, with the full site name', () => {
    expect(buildInvoiceNumber('Couchiching', '2026-10-02')).toBe('Merch Fees Oct 02/2026 - Couchiching')
    expect(buildInvoiceNumber('Jocko Point', '2026-12-31')).toBe('Merch Fees Dec 31/2026 - Jocko Point')
  })

  it('rejects a malformed date', () => {
    expect(() => buildInvoiceNumber('Rankin', '10/02/2026')).toThrow(/Invalid date/)
  })
})

describe('buildBillPayload', () => {
  const bill = buildBillPayload({ site: 'Couchiching', date: '2026-10-02', amount: 531.58, entityId: 'G160' })

  it('is a submitted (posted) bill to Global Payments', () => {
    expect(bill).toMatchObject({
      billNumber: 'Merch Fees Oct 02/2026 - Couchiching',
      vendor: { id: 'V00041' },
      postingDate: '2026-10-02',
      state: 'submitted',
      isTaxInclusive: false,
      taxSolution: { key: '3' },
    })
  })

  it('has one zero-rated line on the merchant fees account at the site location', () => {
    expect(bill.lines).toEqual([
      {
        glAccount: { id: '52500' },
        txnAmount: '531.58',
        memo: 'Merch Fees Ded. by GBL',
        dimensions: { location: { id: 'G160' } },
        taxEntries: [
          { baseTaxAmount: '0', txnTaxAmount: '0', taxRate: 0, purchasingTaxDetail: { key: '69' } },
        ],
      },
    ])
  })
})

describe('buildPaymentPayload', () => {
  const payment = buildPaymentPayload({
    site: 'Couchiching',
    date: '2026-10-02',
    amount: 531.58,
    bankAccountId: SITE_BANK_ACCOUNTS.Couchiching,
    billKey: '4242',
  })

  it('is a draft EFT (record transfer) payment from the site bank account', () => {
    expect(payment).toMatchObject({
      financialEntity: { id: 'CouchichingGen7LP SB' },
      vendor: { id: 'V00041' },
      paymentMethod: 'EFT',
      description: 'Merch Fees Ded. by GBL',
      paymentDate: '2026-10-02',
      action: 'draft',
    })
  })

  it('applies the full amount to the bill', () => {
    expect(payment.details).toEqual([{ bill: { key: '4242' }, txnCurrency: { paymentAmount: '531.58' } }])
  })
})

describe('SITE_BANK_ACCOUNTS', () => {
  it('has no entry for Silver Grizzly yet (its Intacct entry is skipped)', () => {
    expect(SITE_BANK_ACCOUNTS['Silver Grizzly']).toBeUndefined()
  })
})

describe('BankStatement.sageMerchantFee', () => {
  it('starts empty so the first fee edit is allowed to create the Intacct entry', () => {
    const doc = new BankStatement({ site: 'Rankin', date: '2026-03-15' })
    expect(doc.sageMerchantFee?.paymentKey).toBeUndefined()
    expect(doc.sageMerchantFee?.billKey).toBeUndefined()
  })
})

describe('submitPayment', () => {
  const { submitPayment } = sageService

  afterEach(() => vi.unstubAllGlobals())

  it('posts the payment key to the submit workflow under the site entity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ key: '135614', state: 'submitted' }) })
    vi.stubGlobal('fetch', fetchMock)

    await submitPayment('tok', 'G160', 135614)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.intacct.com/ia/api/v1/workflows/accounts-payable/payment/submit')
    expect(init.method).toBe('POST')
    expect(init.headers['X-IA-API-Param-Entity']).toBe('G160')
    expect(JSON.parse(init.body)).toEqual({ key: '135614' })
  })

  it('throws with Sage’s message when the submit is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ 'ia::result': { 'ia::error': { message: 'Payload contains errors' } } }),
      }),
    )
    await expect(submitPayment('tok', 'G160', '1')).rejects.toThrow(/Sage 400: Payload contains errors/)
  })
})

describe('merchant fee posting date', () => {
  it('posts the bill the day after and names it for the posting date', () => {
    const bill = buildBillPayload({ site: 'Couchiching', date: '2026-10-02', postDate: '2026-10-03', amount: 10, entityId: 'G160' })
    expect(bill).toMatchObject({
      billNumber: 'Merch Fees Oct 03/2026 - Couchiching',
      description: 'Merch Fees Oct 03/2026 - Couchiching',
      createdDate: '2026-10-03',
      postingDate: '2026-10-03',
      dueDate: '2026-10-03',
    })
  })

  it('dates the payment on the posting day', () => {
    const payment = buildPaymentPayload({
      site: 'Couchiching',
      date: '2026-10-02',
      postDate: '2026-10-03',
      amount: 10,
      bankAccountId: SITE_BANK_ACCOUNTS.Couchiching,
      billKey: '1',
    })
    expect(payment.paymentDate).toBe('2026-10-03')
  })
})
