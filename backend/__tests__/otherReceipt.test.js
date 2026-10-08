import { describe, it, expect } from 'vitest'
import sageService from '../services/sageService.js'
import linesModule from '../utils/otherReceiptLines.js'
import CashRecSageEntry from '../models/CashRecSageEntry.js'

const { sanitizeOtherReceiptLines } = linesModule
const { buildOtherReceiptPayload, OTHER_RECEIPT_GL_ACCOUNTS } = sageService
const allowedGlAccounts = OTHER_RECEIPT_GL_ACCOUNTS

const line = (glAccount, amount, extra = {}) => ({ glAccount, amount, memo: '', ...extra })

describe('sanitizeOtherReceiptLines', () => {
  const opts = { allowedGlAccounts, bankStmtAccess: true }

  it('keeps lines in order and rounds amounts to cents', () => {
    const { lines } = sanitizeOtherReceiptLines([line('40010', 5573.914, { memo: ' Fuel Sales ' }), line('10011', -2003.3)], opts)
    expect(lines).toEqual([
      { glAccount: '40010', amount: 5573.91, memo: 'Fuel Sales' },
      { glAccount: '10011', amount: -2003.3, memo: '' },
    ])
  })

  it('drops lines whose value is 0 (including ones that round to 0)', () => {
    const { lines } = sanitizeOtherReceiptLines([line('40010', 0), line('40200', 0.004), line('52250', -11.5)], opts)
    expect(lines.map((l) => l.glAccount)).toEqual(['52250'])
  })

  it('drops the Bank Rec line for a site without bank statement access', () => {
    const rows = [line('55050', 522.72, { key: 'bankRec' }), line('55050', -3.05, { key: 'tillOverShort' })]
    expect(sanitizeOtherReceiptLines(rows, { ...opts, bankStmtAccess: false }).lines).toEqual([
      { glAccount: '55050', amount: -3.05, memo: '' },
    ])
  })

  it('keeps the Bank Rec line when access is on or the field is unset', () => {
    const rows = [line('55050', 522.72, { key: 'bankRec' })]
    expect(sanitizeOtherReceiptLines(rows, opts).lines).toHaveLength(1)
    expect(sanitizeOtherReceiptLines(rows, { ...opts, bankStmtAccess: undefined }).lines).toHaveLength(1)
  })

  it('rejects GL accounts outside the cash-rec set, non-numeric amounts and empty input', () => {
    expect(sanitizeOtherReceiptLines([line('99999', 5)], opts).error).toMatch(/not allowed/)
    expect(sanitizeOtherReceiptLines([line('40010', '5')], opts).error).toMatch(/numeric/)
    expect(sanitizeOtherReceiptLines([], opts).error).toBeDefined()
    expect(sanitizeOtherReceiptLines(undefined, opts).error).toBeDefined()
  })
})

describe('buildOtherReceiptPayload', () => {
  const payload = buildOtherReceiptPayload({
    site: 'Charlies',
    date: '2026-10-04',
    entityId: 'G190',
    lines: [
      { glAccount: '40010', amount: 5573.91, memo: 'Fuel Sales' },
      { glAccount: '40200', amount: 2962.76, memo: '' },
      { glAccount: '10011', amount: -2003.3, memo: 'Cash deposit' },
    ],
  })

  it('matches the receipt header from the Intacct sample', () => {
    expect(payload).toMatchObject({
      payer: 'Daily Sales',
      txnDate: '2026-10-04',
      paymentMethod: 'eft',
      currency: 'CAD',
      undepositedGLAccount: { id: '10019' },
    })
    // Other Receipts have no draft state, so none is sent.
    expect(payload).not.toHaveProperty('state')
  })

  it('maps each line with its signed amount, memo and site location', () => {
    expect(payload.lines.map((l) => [l.lineNumber, l.glAccount.id, l.txnAmount, l.description])).toEqual([
      [1, '40010', '5573.91', 'Fuel Sales'],
      [2, '40200', '2962.76', undefined],
      [3, '10011', '-2003.30', 'Cash deposit'],
    ])
    expect(payload.lines.every((l) => l.dimensions.location.id === 'G190')).toBe(true)
  })
})

describe('CashRecSageEntry', () => {
  it('requires a site and a date', () => {
    const err = new CashRecSageEntry({}).validateSync()
    expect(err?.errors.site).toBeDefined()
    expect(err?.errors.date).toBeDefined()
  })

  it('has no key until the receipt exists', () => {
    const doc = new CashRecSageEntry({ site: 'Charlies', date: '2026-10-04', claimedAt: new Date() })
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.key).toBeUndefined()
  })
})

describe('hasEffectiveAccess', () => {
  const accessModule = require('../utils/permissionAccess.js')
  const { hasEffectiveAccess } = accessModule
  const roleWith = (permId, value) => ({ permissionsArray: [{ permId, value }] })

  it('grants access from the role when there is no override', () => {
    expect(hasEffectiveAccess({ role: roleWith(7, true) }, 7)).toBe(true)
    expect(hasEffectiveAccess({ role: roleWith(7, false) }, 7)).toBe(false)
  })

  it('lets a per-user override win over the role either way', () => {
    expect(hasEffectiveAccess({ role: roleWith(7, false), customPermissionsArray: [{ permId: 7, value: true }] }, 7)).toBe(true)
    expect(hasEffectiveAccess({ role: roleWith(7, true), customPermissionsArray: [{ permId: 7, value: false }] }, 7)).toBe(false)
  })

  it('denies when nothing grants it, the permission is unknown, or there is no user', () => {
    expect(hasEffectiveAccess({ role: roleWith(8, true) }, 7)).toBe(false)
    expect(hasEffectiveAccess({ role: {} }, 7)).toBe(false)
    expect(hasEffectiveAccess({ role: roleWith(7, true) }, undefined)).toBe(false)
    expect(hasEffectiveAccess(undefined, 7)).toBe(false)
  })
})
