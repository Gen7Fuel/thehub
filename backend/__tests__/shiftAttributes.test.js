import { describe, it, expect } from 'vitest'
// Import the model + util directly — no DB connection required.
// Do NOT import config/db.js or the route file (routes/cashSummaryNewRoutes.js
// pulls in mssql/redis/pdf dependencies that need real env config to load).
import CashSummaryModule from '../models/CashSummaryNew.js'
import {
  isValidAttributeName,
  buildReservedAttributeNames,
  castAttributeValue,
} from '../utils/shiftAttributes.js'

const { CashSummary } = CashSummaryModule

describe('isValidAttributeName', () => {
  it('accepts a simple camelCase name', () => {
    expect(isValidAttributeName('posTotal')).toBe(true)
  })

  it('rejects a name starting with a digit', () => {
    expect(isValidAttributeName('1posTotal')).toBe(false)
  })

  it('rejects a name with a dash', () => {
    expect(isValidAttributeName('pos-total')).toBe(false)
  })

  it('rejects a name with a dot (Mongo field-path separator)', () => {
    expect(isValidAttributeName('pos.total')).toBe(false)
  })

  it('rejects a name starting with $ (Mongo operator prefix)', () => {
    expect(isValidAttributeName('$set')).toBe(false)
  })

  it('rejects __proto__', () => {
    expect(isValidAttributeName('__proto__')).toBe(false)
  })

  it('rejects a non-string', () => {
    expect(isValidAttributeName(123)).toBe(false)
  })
})

describe('buildReservedAttributeNames', () => {
  const reserved = buildReservedAttributeNames(CashSummary)

  it('reserves every existing top-level schema field', () => {
    expect(reserved.has('site')).toBe(true)
    expect(reserved.has('shift_number')).toBe(true)
    expect(reserved.has('date')).toBe(true)
    expect(reserved.has('cash_back')).toBe(true)
    expect(reserved.has('canadian_cash_collected')).toBe(true)
  })

  it('reserves the top-level name of array/subdocument fields', () => {
    expect(reserved.has('tenders')).toBe(true)
    expect(reserved.has('fuelGrades')).toBe(true)
    expect(reserved.has('arCustomers')).toBe(true)
  })

  it('reserves Mongoose/JS-internal names', () => {
    expect(reserved.has('id')).toBe(true)
    expect(reserved.has('__proto__')).toBe(true)
    expect(reserved.has('constructor')).toBe(true)
  })

  it('does not reserve a genuinely new attribute name', () => {
    expect(reserved.has('posTotal')).toBe(false)
  })
})

describe('castAttributeValue', () => {
  it('casts String as-is', () => {
    const { value, error } = castAttributeValue('String', 'hello')
    expect(error).toBeUndefined()
    expect(value).toBe('hello')
  })

  it('casts a valid Int32', () => {
    const { value, error } = castAttributeValue('Int32', '42')
    expect(error).toBeUndefined()
    expect(value.valueOf()).toBe(42)
    expect(value.constructor.name).toBe('Int32')
  })

  it('rejects a non-integer Int32', () => {
    const { value, error } = castAttributeValue('Int32', '3.14')
    expect(value).toBeUndefined()
    expect(error).toMatch(/32-bit integer/)
  })

  it('rejects an out-of-range Int32', () => {
    const { error } = castAttributeValue('Int32', String(2 ** 32))
    expect(error).toMatch(/32-bit integer/)
  })

  it('casts a valid Double', () => {
    const { value, error } = castAttributeValue('Double', '3.14')
    expect(error).toBeUndefined()
    expect(value.valueOf()).toBeCloseTo(3.14)
    expect(value.constructor.name).toBe('Double')
  })

  it('rejects a non-numeric Double', () => {
    const { error } = castAttributeValue('Double', 'not a number')
    expect(error).toMatch(/valid number/)
  })

  it('casts Boolean from a real boolean', () => {
    expect(castAttributeValue('Boolean', true).value).toBe(true)
    expect(castAttributeValue('Boolean', false).value).toBe(false)
  })

  it('casts Boolean from the strings "true"/"false"', () => {
    expect(castAttributeValue('Boolean', 'true').value).toBe(true)
    expect(castAttributeValue('Boolean', 'false').value).toBe(false)
  })

  it('rejects an invalid Boolean value', () => {
    const { error } = castAttributeValue('Boolean', 'maybe')
    expect(error).toMatch(/valid boolean/)
  })

  it('rejects an unsupported type', () => {
    const { error } = castAttributeValue('Date', '2026-01-01')
    expect(error).toMatch(/Unsupported type/)
  })
})
