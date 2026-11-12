import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const { parseSftReport } = require('../utils/parseSftReport')

// Evaluate the Mongo expressions against isolated shift fixtures. Unknown
// operators fail the test rather than silently accepting a changed pipeline.
function evaluate(expression, document) {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    return document[expression.slice(1)]
  }
  if (expression == null || typeof expression !== 'object') return expression
  if ('$ifNull' in expression) {
    for (const value of expression.$ifNull) {
      const result = evaluate(value, document)
      if (result != null) return result
    }
    return null
  }
  if ('$cond' in expression) {
    const [condition, yes, no] = expression.$cond
    return evaluate(evaluate(condition, document) ? yes : no, document)
  }
  throw new Error(`Unsupported aggregation expression: ${JSON.stringify(expression)}`)
}

describe('cash-rec entries: cash including U.S. Cash', () => {
  let shifts, lottery, entries, aggregate, province

  beforeEach(() => {
    shifts = []
    lottery = null
    province = 'Ontario'
    const findNothing = () => ({ lean: async () => null })
    aggregate = vi.fn(async pipeline => {
      const group = pipeline.find(stage => stage.$group).$group
      if (!shifts.length) return []
      return [Object.fromEntries(Object.entries(group)
        .filter(([field]) => field !== '_id')
        .map(([field, accumulator]) => [field, shifts.reduce((total, shift) => {
          const value = evaluate(accumulator.$sum, shift)
          return total + (typeof value === 'number' ? value : 0)
        }, 0)]))]
    })
    const dependencies = {
      '../models/CashRec': {
        BankStatement: { findOne: findNothing },
        KardpollReport: { findOne: findNothing },
      },
      '../models/CashSummaryNew': {
        aggregate,
        CashSummaryReport: { findOne: findNothing },
      },
      '../models/Transactions': { aggregate: async () => [] },
      '../models/Lottery': { findOne: () => ({ lean: async () => lottery }) },
      '../models/Location': { findOne: () => ({ lean: async () => ({ sellsLottery: Boolean(lottery), province }) }) },
      '../models/CashRecTag': {},
      '../services/sageService': {},
      '../constants/sageBankAccounts': {},
      '../middleware/changeLogger': {},
    }
    // Isolate model/queue dependencies when loading the existing CommonJS
    // router; no database connection, external HTTP, or background jobs.
    const module = { exports: {} }
    runInNewContext(readFileSync(new URL('../routes/cashRecRoutes.js', import.meta.url), 'utf8'), {
      module,
      require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
      console,
    })
    entries = module.exports.stack.find(layer => layer.route?.path === '/entries').route.stack[0].handle
  })

  async function getEntries(site = 'Rankin', date = '2026-10-29') {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() }
    await entries({ query: { site, date } }, res)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledOnce()
    return res.json.mock.calls[0][0]
  }

  it('includes U.S. Cash in the displayed cash total and balance check', async () => {
    shifts = [{ report_canadian_cash: 100, canadianCash: 125, totalSales: 125 }]
    const result = await getEntries()
    expect(result.cashSummary.totals.report_canadian_cash).toBe(125)
    expect(result.balanceCheck).toBe(0)
    expect(aggregate.mock.calls[0][0][0].$match.site).toBe('Rankin')
  })

  it.each([
    ['Sioux Valley', 61, 0],
    ['Rankin', 26, -35],
  ])('uses parsed payouts in the balance check for %s', async (site, payouts, balanceCheck) => {
    shifts = [parseSftReport(
      'Canadian Cash 100.00\nTotal Sales 161.00\nPayouts 26.00\nLotto Payout 200.00\nLOTTO WIN 35.00\n',
      site,
    )]
    const result = await getEntries(site)
    expect(result.cashSummary.totals.payouts).toBe(payouts)
    expect(result.cashSummary.totals.lottoPayout).toBe(200)
    expect(result.balanceCheck).toBe(balanceCheck)
  })

  it('falls back per shift for older records mixed with combined cash records', async () => {
    shifts = [
      { report_canadian_cash: 100, canadianCash: 125 },
      { report_canadian_cash: 50 },
      { report_canadian_cash: 20, canadianCash: null },
    ]
    expect((await getEntries()).cashSummary.totals.report_canadian_cash).toBe(195)
  })

  it('preserves zero and negative combined cash amounts', async () => {
    shifts = [
      { report_canadian_cash: 100, canadianCash: 0 },
      { report_canadian_cash: -10, canadianCash: -15 },
    ]
    expect((await getEntries()).cashSummary.totals.report_canadian_cash).toBe(-15)
  })

  it('preserves adjusted Chicken Delight cash without adding U.S. Cash twice', async () => {
    shifts = [
      { isChickenDelight: true, report_canadian_cash: 80, canadianCash: 125 },
      { isChickenDelight: false, report_canadian_cash: 100, canadianCash: 125 },
    ]
    expect((await getEntries()).cashSummary.totals.report_canadian_cash).toBe(205)
  })

  it('uses combined cash in the lottery adjusted over/short', async () => {
    shifts = [{ report_canadian_cash: 100, canadianCash: 125, canadian_cash_collected: 125 }]
    lottery = { onlineLottoTotal: 0, instantLottTotal: 0 }
    expect((await getEntries()).adjustedOverShort).toBe(0)
  })

  it('returns zero cash for missing cash values or no shifts', async () => {
    expect((await getEntries()).cashSummary.totals.report_canadian_cash).toBe(0)
    shifts = [{}]
    expect((await getEntries()).cashSummary.totals.report_canadian_cash).toBe(0)
  })

  it.each(['Manitoba', ' manitoba '])('skips Zing adjustments for Sioux Valley in %s', async (value) => {
    province = value
    shifts = [{ canadianCash: 1000, canadian_cash_collected: 999, onlineLottoTotal: 100, instantLottTotal: 12 }]
    lottery = { onlineLottoTotal: 100, instantLottTotal: null }
    const result = await getEntries('Sioux Valley', '2026-11-03')
    expect(result.adjustedOverShort).toBe(-1)
    expect(result.cashSummary.totals.instantLottTotal).toBe(12)
  })

  it('still applies online lottery adjustments in Manitoba', async () => {
    province = 'Manitoba'
    shifts = [{ canadianCash: 1000, canadian_cash_collected: 999, onlineLottoTotal: 110, instantLottTotal: 12 }]
    lottery = { onlineLottoTotal: 100, onlineCancellations: 2, onlineDiscounts: 3 }
    expect((await getEntries('Sioux Valley', '2026-11-03')).adjustedOverShort).toBe(-16)
  })

  it('preserves scratch lottery adjustments outside Manitoba', async () => {
    shifts = [{ canadianCash: 1000, canadian_cash_collected: 999, onlineLottoTotal: 100, instantLottTotal: 30 }]
    lottery = { onlineLottoTotal: 100, instantLottTotal: 10, scratchFreeTickets: 5, oldScratchTickets: 3 }
    expect((await getEntries()).adjustedOverShort).toBe(-13)
  })
})
