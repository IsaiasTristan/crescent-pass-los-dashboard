import { describe, it, expect } from 'vitest'
import { sd, daysInMonth, emptyM, accum, metrics, GAS_BOE } from '../domain/metrics.js'

// ─── sd (safe division) ───────────────────────────────────────────────────────

describe('sd', () => {
  it('divides normally', () => {
    expect(sd(10, 4)).toBeCloseTo(2.5)
  })
  it('returns 0 for zero divisor', () => {
    expect(sd(10, 0)).toBe(0)
  })
  it('returns 0 for non-finite divisor', () => {
    expect(sd(10, Infinity)).toBe(0)
    expect(sd(10, NaN)).toBe(0)
  })
})

// ─── daysInMonth ──────────────────────────────────────────────────────────────

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInMonth(new Date(2024, 0, 1))).toBe(31)
  })
  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(new Date(2024, 1, 1))).toBe(29)
  })
  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(new Date(2023, 1, 1))).toBe(28)
  })
  it('returns 30 for April', () => {
    expect(daysInMonth(new Date(2024, 3, 1))).toBe(30)
  })
})

// ─── accum + metrics ──────────────────────────────────────────────────────────

function makeRow(bucket, netAmount, netVolume, grossVolume = 0) {
  return { bucket, netAmount, netVolume, grossVolume }
}

describe('accum and metrics', () => {
  const date = new Date(2024, 0, 31) // Jan 2024
  const days = 31

  it('accumulates oil revenue and flips sign', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    // Oil stored negative in source; accum uses Math.abs
    accum(m, makeRow('oil', -10000, -500, -550))
    expect(m.oil_rev).toBeCloseTo(10000)
    expect(m.oil_vol).toBeCloseTo(500)
    expect(m.gross_oil).toBeCloseTo(550)
  })

  it('accumulates NGL volume in BBL (divides gallons by 42)', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('ngl', -4200, -420000, -420000))  // 420,000 gallons = 10,000 BBL
    expect(m.ngl_vol).toBeCloseTo(10000)
    expect(m.ngl_rev).toBeCloseTo(4200)
  })

  it('accumulates cost rows with raw signed amount (credits reduce totals)', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('fixed', 5000, 0))    // normal cost
    accum(m, makeRow('fixed', -1000, 0))   // credit/reversal
    expect(m.fixed).toBeCloseTo(4000)
  })

  it('derives totalLOS excluding capex and midstream', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('oil',           -100000, -2000))
    accum(m, makeRow('fixed',           20000,     0))
    accum(m, makeRow('variable_oil',    10000,     0))
    accum(m, makeRow('capex',           50000,     0))   // excluded from LOS
    accum(m, makeRow('midstream',       -5000,     0))   // included as cost item
    const r = metrics(m, 5)
    expect(r.totalLOS).toBeCloseTo(20000 + 10000)  // fixed + var_oil only
    expect(r.capex).toBeCloseTo(50000)
    expect(r.midstream).toBeCloseTo(-5000)
  })

  it('derives opMargin = totalRevenue - totalLOS', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('oil',          -120000, -2000))
    accum(m, makeRow('fixed',          30000,     0))
    accum(m, makeRow('variable_oil',   15000,     0))
    const r = metrics(m, 3)
    expect(r.totalRevenue).toBeCloseTo(120000)
    expect(r.totalLOS).toBeCloseTo(45000)
    expect(r.opMargin).toBeCloseTo(75000)
  })

  it('derives assetFCF = opMargin - capex', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('oil',   -100000, -1000))
    accum(m, makeRow('fixed',   20000,     0))
    accum(m, makeRow('capex',   15000,     0))
    const r = metrics(m, 2)
    expect(r.opMargin).toBeCloseTo(80000)
    expect(r.assetFCF).toBeCloseTo(65000)
  })

  it('converts gas to BOE correctly (6 MCF = 1 BOE)', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('gas', -6000, -600, -600))  // 600 MCF = 100 BOE
    const r = metrics(m, 1)
    expect(r.netGasBOE).toBeCloseTo(100)          // 600 / 6
    expect(r.netGasBOEd).toBeCloseTo(100 / days)
  })

  it('computes daily rates using actual days in month', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('oil', -31000, -310))  // 310 BBL / 31 days = 10 Bpd
    const r = metrics(m, 1)
    expect(r.netOild).toBeCloseTo(10)
  })

  it('computes fixedPerWell using fixed + workover', () => {
    const m = emptyM(date, '2024-01', "Jan '24")
    accum(m, makeRow('fixed',    60000, 0))
    accum(m, makeRow('workover', 30000, 0))
    const r = metrics(m, 3)
    expect(r.totalFixed).toBeCloseTo(90000)
    expect(r.fixedPerWell).toBeCloseTo(30000)  // 90000 / 3 wells
  })
})
