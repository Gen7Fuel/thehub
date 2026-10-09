/**
 * Sage Intacct (REST v1) helpers for recording merchant fees.
 *
 * Intacct's REST API has no "manual payment" object, so a merchant fee is
 * recorded as the two documents the UI's Manual Payment creates behind the
 * scenes: a submitted (posted) AP bill (supplier Global Payments, GL 52500) and a paid
 * AP payment (Record transfer / EFT from the site's bank account) applied to it.
 */
const SAGE_BASE = 'https://api.intacct.com/ia/api/v1/'

const MERCHANT_FEE_VENDOR_ID = 'V00041' // Global Payments
const MERCHANT_FEE_GL_ACCOUNT = '52500' // COGS - Merchant fees
const MERCHANT_FEE_MEMO = 'Merch Fees Ded. by GBL'
// The UI's "Record transfer" is stored as 'EFT' in the REST API (existing paid
// merch-fee bills were paid with it); 'recordTransfer' is rejected as invalid.
const PAYMENT_METHOD = 'EFT'
// Canadian Sales Tax - SYS, with the "Zero Rate Services Purchase - CA" detail
// the UI's Manual Payment applies to these lines. Intacct rejects the bill if
// the tax solution or a line's tax detail is missing.
const TAX_SOLUTION_KEY = '3'
const TAX_DETAIL_KEY = '69'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Merch Fees Oct 02/2026 - Couchiching" from a YYYY-MM-DD date. */
function buildInvoiceNumber(site, ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error(`Invalid date: ${ymd}`)
  return `Merch Fees ${MONTHS[Number(m[2]) - 1]} ${m[3]}/${m[1]} - ${site}`
}

function buildBillPayload({ site, date, amount, entityId }) {
  const invoiceNumber = buildInvoiceNumber(site, date)
  return {
    billNumber: invoiceNumber,
    vendor: { id: MERCHANT_FEE_VENDOR_ID },
    description: invoiceNumber,
    createdDate: date,
    postingDate: date,
    dueDate: date,
    // Bills default to draft, and Intacct rejects 'posted' on create. 'submitted'
    // is the API's equivalent of the UI's Submit, which posts the bill (a
    // payment can only be applied to a posted bill).
    state: 'submitted',
    isTaxInclusive: false,
    taxSolution: { key: TAX_SOLUTION_KEY },
    lines: [
      {
        glAccount: { id: MERCHANT_FEE_GL_ACCOUNT },
        txnAmount: amount.toFixed(2),
        memo: MERCHANT_FEE_MEMO,
        dimensions: { location: { id: entityId } },
        taxEntries: [
          {
            baseTaxAmount: '0',
            txnTaxAmount: '0',
            taxRate: 0,
            purchasingTaxDetail: { key: TAX_DETAIL_KEY },
          },
        ],
      },
    ],
  }
}

function buildPaymentPayload({ site, date, amount, bankAccountId, billKey }) {
  return {
    financialEntity: { id: bankAccountId },
    vendor: { id: MERCHANT_FEE_VENDOR_ID },
    paymentMethod: PAYMENT_METHOD,
    paymentDate: date,
    description: MERCHANT_FEE_MEMO,
    // Created as a draft, then submitted (see submitPayment) so it posts at once.
    action: 'draft',
    details: [
      {
        bill: { key: billKey },
        txnCurrency: { paymentAmount: amount.toFixed(2) },
      },
    ],
  }
}

async function getSageToken() {
  const clientId = process.env.SAGE_CLIENT_ID
  const clientSecret = process.env.SAGE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Sage is not configured on the server (SAGE_CLIENT_ID / SAGE_CLIENT_SECRET).')
  }
  const res = await fetch(SAGE_BASE + 'oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      username: process.env.SAGE_USERNAME || 'skimWS@GPMC Management Services',
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    throw new Error(`Failed to obtain a Sage access token (${res.status}).`)
  }
  return data.access_token
}

function sageErrorMessage(data, status) {
  const err = data?.['ia::result']?.['ia::error'] ?? data?.['ia::error']
  const details = (err?.details || []).map((d) => d.message).filter(Boolean)
  const parts = [err?.message, ...details].filter(Boolean)
  return `Sage ${status}: ${parts.join(' — ') || JSON.stringify(data) || 'request failed'}`
}

async function sageRequest(token, method, path, { entityId, body } = {}) {
  const res = await fetch(SAGE_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(entityId ? { 'X-IA-API-Param-Entity': entityId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(sageErrorMessage(data, res.status))
  return data
}

/** Resolves a location's Sage entity key (e.g. "55") to its entity ID (e.g. "G160"). */
async function resolveEntityId(token, entityKey) {
  const data = await sageRequest(token, 'GET', `objects/company-config/entity/${encodeURIComponent(entityKey)}`)
  const id = data?.['ia::result']?.id
  if (!id) throw new Error('Could not resolve the Sage entity ID.')
  return id
}

async function createBill(token, entityId, args) {
  const data = await sageRequest(token, 'POST', 'objects/accounts-payable/bill', {
    entityId,
    body: buildBillPayload({ ...args, entityId }),
  })
  const key = data?.['ia::result']?.key
  if (!key) throw new Error('Sage did not return a bill key.')
  return String(key)
}

async function createPayment(token, entityId, args) {
  const data = await sageRequest(token, 'POST', 'objects/accounts-payable/payment', {
    entityId,
    body: buildPaymentPayload(args),
  })
  const key = data?.['ia::result']?.key
  if (!key) throw new Error('Sage did not return a payment key.')
  return String(key)
}

// ── Cash-rec Other Receipt ───────────────────────────────────────────────────

// GL accounts a cash-rec line may post to (Hub's sales and deduction summaries).
const OTHER_RECEIPT_GL_ACCOUNTS = ['40010', '40200', '20440', '10011', '52250', '52175', '55050']
const UNDEPOSITED_FUNDS_GL_ACCOUNT = '10019'

/**
 * The Other Receipt for one cash-rec day. Same shape Desk's Cash Management
 * sends. Other Receipts have no draft state: Intacct creates them as approved,
 * which posts them. `lines` are { glAccount, amount, memo? }, amounts signed.
 */
function buildOtherReceiptPayload({ site, date, entityId, lines }) {
  return {
    payer: 'Daily Sales',
    txnDate: date,
    txnPaidDate: date,
    description: `Cash Management - ${site} - ${date}`,
    baseCurrency: 'CAD',
    currency: 'CAD',
    txnCurrency: 'CAD',
    reconciliationState: 'uncleared',
    isInclusiveTax: false,
    undepositedGLAccount: { id: UNDEPOSITED_FUNDS_GL_ACCOUNT },
    paymentMethod: 'eft', // the UI's "Record transfer"
    depositDate: date,
    exchangeRate: { date, typeId: null, rate: 1 },
    lines: lines.map((l, i) => ({
      status: 'active',
      amount: l.amount.toFixed(2),
      txnAmount: l.amount.toFixed(2),
      ...(l.memo ? { description: l.memo } : {}),
      lineNumber: i + 1,
      isTax: false,
      glAccount: { id: l.glAccount },
      dimensions: { location: { id: entityId } },
    })),
  }
}

async function createOtherReceipt(token, entityId, args) {
  const data = await sageRequest(token, 'POST', 'objects/cash-management/other-receipt', {
    entityId,
    body: buildOtherReceiptPayload({ ...args, entityId }),
  })
  const key = data?.['ia::result']?.key
  if (!key) throw new Error('Sage did not return an other receipt key.')
  return String(key)
}

/**
 * Submits a draft payment so it posts: the payment becomes confirmed and its
 * bill paid. Intacct won't change a payment's state by PATCH (or by an action
 * field), so state changes go through the submit workflow.
 */
async function submitPayment(token, entityId, paymentKey) {
  await sageRequest(token, 'POST', 'workflows/accounts-payable/payment/submit', {
    entityId,
    body: { key: String(paymentKey) },
  })
}

module.exports = {
  buildInvoiceNumber,
  buildBillPayload,
  buildPaymentPayload,
  getSageToken,
  resolveEntityId,
  createBill,
  createPayment,
  submitPayment,
  OTHER_RECEIPT_GL_ACCOUNTS,
  buildOtherReceiptPayload,
  createOtherReceipt,
}
