import { describe, it, expect } from 'vitest'
import { buildMonthlyRollup, buildWellData, buildLOSCatData, filterRows, selectActiveInputs, attachPricingDifferentials } from '../selectors/buildRollups.js'

// ─── Shared test data factory ─────────────────────────────────────────────────

function row(overrides) {
  return {
    wellName: 'Well A',
    bucket: 'oil',
    netAmount: -10000,
    netVolume: -200,
    grossVolume: -220,
    monthKey: '2024-01',
    monthDisp: "Jan '24",
    date: new Date(2024, 0, 31),
    jpRp: 'JP',
    opObo: 'OP',
    nri: 0.8,
    wi: 1.0,
    cat: 'RevO',
    los: 'Oil',
    ...overrides,
  }
}

// ─── buildMonthlyRollup ───────────────────────────────────────────────────────

describe('buildMonthlyRollup', () => {
  it('returns empty array for empty input', () => {
    expect(buildMonthlyRollup([])).toEqual([])
  })

  it('skips ignored and null-bucket rows', () => {
    const rows = [
      row({ bucket: 'ignore' }),
      row({ bucket: null }),
      row({ bucket: 'oil' }),
    ]
    const rollup = buildMonthlyRollup(rows)
    expect(rollup).toHaveLength(1)
    expect(rollup[0].oil_vol).toBeCloseTo(200)
  })

  it('excludes capex rows from well count', () => {
    const rows = [
      row({ wellName: 'Well A', bucket: 'oil',   netAmount: -5000, netVolume: -100 }),
      row({ wellName: 'Well A', bucket: 'capex',  netAmount:  8000, netVolume: 0 }),
      row({ wellName: 'Well B', bucket: 'oil',   netAmount: -5000, netVolume: -100 }),
    ]
    const rollup = buildMonthlyRollup(rows)
    expect(rollup[0].wellCount).toBe(2)
  })

  it('aggregates across multiple wells for the same month', () => {
    const rows = [
      row({ wellName: 'Well A', bucket: 'oil', netAmount: -10000, netVolume: -200 }),
      row({ wellName: 'Well B', bucket: 'oil', netAmount: -20000, netVolume: -400 }),
    ]
    const rollup = buildMonthlyRollup(rows)
    expect(rollup[0].oil_vol).toBeCloseTo(600)
    expect(rollup[0].oil_rev).toBeCloseTo(30000)
  })

  it('sorts months chronologically', () => {
    const rows = [
      row({ monthKey: '2024-03', monthDisp: "Mar '24", date: new Date(2024, 2, 31) }),
      row({ monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31) }),
      row({ monthKey: '2024-02', monthDisp: "Feb '24", date: new Date(2024, 1, 29) }),
    ]
    const rollup = buildMonthlyRollup(rows)
    expect(rollup.map(r => r.monthKey)).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('derives totalLOS = fixed + var_oil + var_water + gpt + workover + prod_taxes', () => {
    const rows = [
      row({ bucket: 'fixed',        netAmount: 10000, netVolume: 0 }),
      row({ bucket: 'variable_oil', netAmount:  5000, netVolume: 0 }),
      row({ bucket: 'gpt',          netAmount:  3000, netVolume: 0 }),
      row({ bucket: 'workover',     netAmount:  2000, netVolume: 0 }),
      row({ bucket: 'prod_taxes',   netAmount:  1000, netVolume: 0 }),
      row({ bucket: 'capex',        netAmount: 50000, netVolume: 0 }),  // excluded
    ]
    const rollup = buildMonthlyRollup(rows)
    expect(rollup[0].totalLOS).toBeCloseTo(21000)
  })

  it('splits fixed/workover per-well metrics by JP vs RP using lift-type-specific well counts', () => {
    const rows = [
      row({ wellName: 'JP 1', jpRp: 'JP', bucket: 'fixed', netAmount: 1000, netVolume: 0 }),
      row({ wellName: 'JP 1', jpRp: 'JP', bucket: 'workover', netAmount: 300, netVolume: 0 }),
      row({ wellName: 'JP 2', jpRp: 'JP', bucket: 'oil', netAmount: -10, netVolume: -1 }),
      row({ wellName: 'RP 1', jpRp: 'RP', bucket: 'fixed', netAmount: 900, netVolume: 0 }),
      row({ wellName: 'RP 1', jpRp: 'RP', bucket: 'workover', netAmount: 150, netVolume: 0 }),
      row({ wellName: 'RP 1', jpRp: 'RP', bucket: 'oil', netAmount: -10, netVolume: -1 }),
    ]
    const rollup = buildMonthlyRollup(rows)
    expect(rollup[0].jpFixedOnlyPerWell).toBeCloseTo(500)   // 1000 / 2 JP wells
    expect(rollup[0].rpFixedOnlyPerWell).toBeCloseTo(900)   // 900 / 1 RP well
    expect(rollup[0].jpWorkoverPerWell).toBeCloseTo(150)    // 300 / 2 JP wells
    expect(rollup[0].rpWorkoverPerWell).toBeCloseTo(150)    // 150 / 1 RP well
  })
})

// ─── buildWellData ────────────────────────────────────────────────────────────

describe('buildWellData', () => {
  it('returns empty array for empty input', () => {
    expect(buildWellData([])).toEqual([])
  })

  it('creates one well entry per unique well name', () => {
    const rows = [
      row({ wellName: 'Well A' }),
      row({ wellName: 'Well B' }),
      row({ wellName: 'Well A' }),
    ]
    const wells = buildWellData(rows)
    expect(wells).toHaveLength(2)
  })

  it('sorts wells alphabetically', () => {
    const rows = [
      row({ wellName: 'Well C' }),
      row({ wellName: 'Well A' }),
      row({ wellName: 'Well B' }),
    ]
    const wells = buildWellData(rows)
    expect(wells.map(w => w.wellName)).toEqual(['Well A', 'Well B', 'Well C'])
  })

  it('includes monthly metrics on each well', () => {
    const rows = [
      row({ wellName: 'Well A', bucket: 'oil', netAmount: -30000, netVolume: -300 }),
    ]
    const wells = buildWellData(rows)
    expect(wells[0].monthlyData).toHaveLength(1)
    expect(wells[0].monthlyData[0].oil_vol).toBeCloseTo(300)
  })
})

// ─── filterRows ───────────────────────────────────────────────────────────────

describe('filterRows', () => {
  const rows = [
    row({ wellName: 'Op Well',    opObo: 'OP',  jpRp: 'JP' }),
    row({ wellName: 'NonOp Well', opObo: 'OBO', jpRp: 'RP' }),
    row({ wellName: 'Other Well', opObo: 'OP',  jpRp: 'Other' }),
  ]

  it('returns null for null input', () => {
    expect(filterRows(null, 'all', [])).toBeNull()
  })

  it('returns all rows when opFilter is all and liftFilter is empty', () => {
    expect(filterRows(rows, 'all', [])).toHaveLength(3)
  })

  it('filters to operated wells', () => {
    const result = filterRows(rows, 'op', [])
    expect(result).toHaveLength(2)
    expect(result.every(r => r.opObo === 'OP')).toBe(true)
  })

  it('filters to non-operated wells', () => {
    const result = filterRows(rows, 'obo', [])
    expect(result).toHaveLength(1)
    expect(result[0].wellName).toBe('NonOp Well')
  })

  it('filters by lift type JP', () => {
    const result = filterRows(rows, 'all', ['jp'])
    expect(result).toHaveLength(1)
    expect(result[0].wellName).toBe('Op Well')
  })

  it('filters by lift type RP', () => {
    const result = filterRows(rows, 'all', ['rp'])
    expect(result).toHaveLength(1)
    expect(result[0].wellName).toBe('NonOp Well')
  })

  it('filters by lift type other', () => {
    const result = filterRows(rows, 'all', ['other'])
    expect(result).toHaveLength(1)
    expect(result[0].wellName).toBe('Other Well')
  })

  it('composes op filter AND lift filter', () => {
    const result = filterRows(rows, 'op', ['jp'])
    expect(result).toHaveLength(1)
    expect(result[0].wellName).toBe('Op Well')
  })
})

// ─── selectActiveInputs ───────────────────────────────────────────────────────

describe('selectActiveInputs', () => {
  const inputs = {
    vdrCase: { op: { fixedPerWellMonth: '5000' }, obo: { fixedPerWellMonth: '3000' } },
    myCase:  { op: { fixedPerWellMonth: '4500' }, obo: { fixedPerWellMonth: '2800' } },
  }

  it('returns op sub-case when filter is all', () => {
    const ai = selectActiveInputs(inputs, 'all')
    expect(ai.vdrCase.fixedPerWellMonth).toBe('5000')
    expect(ai.myCase.fixedPerWellMonth).toBe('4500')
  })

  it('returns op sub-case when filter is op', () => {
    const ai = selectActiveInputs(inputs, 'op')
    expect(ai.vdrCase.fixedPerWellMonth).toBe('5000')
  })

  it('returns obo sub-case when filter is obo', () => {
    const ai = selectActiveInputs(inputs, 'obo')
    expect(ai.vdrCase.fixedPerWellMonth).toBe('3000')
    expect(ai.myCase.fixedPerWellMonth).toBe('2800')
  })
})

// ─── buildLOSCatData ─────────────────────────────────────────────────────────

describe('buildLOSCatData', () => {
  it('returns empty months and catMap for empty input', () => {
    const out = buildLOSCatData([], false)
    expect(out.months).toEqual([])
    expect(out.catMap).toEqual({})
  })

  it('skips rows with bucket ignore', () => {
    const rows = [
      row({ bucket: 'ignore', los: 'X', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31) }),
      row({ bucket: 'oil', los: 'Oil', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -5000, netVolume: -100 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.months).toHaveLength(1)
    expect(out.catMap['Oil']).toBeDefined()
    expect(out.catMap['Oil'].months['2024-01'].amount).toBeCloseTo(5000)
    expect(out.catMap['Oil'].months['2024-01'].volume).toBe(100)
  })

  it('skips rows with no los and no cat label', () => {
    const rows = [
      row({ bucket: 'oil', los: '', cat: '', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31) }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.months).toHaveLength(0)
    expect(Object.keys(out.catMap)).toHaveLength(0)
  })

  it('uses los as label when present, else cat', () => {
    const rows = [
      row({ bucket: 'oil', los: 'Oil', cat: 'RevO', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -1000, netVolume: -10 }),
      row({ bucket: 'fixed', los: '', cat: 'Fixed', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: 500, netVolume: 0 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.catMap['Oil']).toBeDefined()
    expect(out.catMap['Oil'].bucket).toBe('oil')
    expect(out.catMap['Fixed']).toBeDefined()
    expect(out.catMap['Fixed'].bucket).toBe('fixed')
  })

  it('flips sign for revenue buckets (oil, gas, ngl)', () => {
    const rows = [
      row({ bucket: 'oil', los: 'Oil', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -10000, netVolume: -200 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.catMap['Oil'].months['2024-01'].amount).toBeCloseTo(10000)
  })

  it('uses raw signed amount for cost buckets', () => {
    const rows = [
      row({ bucket: 'fixed', los: 'Fixed', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: 5000, netVolume: 0 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.catMap['Fixed'].months['2024-01'].amount).toBeCloseTo(5000)
  })

  it('converts NGL volume from gallons to BBL (divide by 42)', () => {
    const rows = [
      row({ bucket: 'ngl', los: 'NGL', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -2000, netVolume: -420 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.catMap['NGL'].months['2024-01'].volume).toBeCloseTo(420 / 42)
  })

  it('isGross uses grossAmount and grossVolume', () => {
    const rows = [
      row({
        bucket: 'oil', los: 'Oil', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31),
        netAmount: -1000, netVolume: -10, grossAmount: -1200, grossVolume: -12,
      }),
    ]
    const netOut = buildLOSCatData(rows, false)
    const grossOut = buildLOSCatData(rows, true)
    expect(netOut.catMap['Oil'].months['2024-01'].amount).toBeCloseTo(1000)
    expect(netOut.catMap['Oil'].months['2024-01'].volume).toBe(10)
    expect(grossOut.catMap['Oil'].months['2024-01'].amount).toBeCloseTo(1200)
    expect(grossOut.catMap['Oil'].months['2024-01'].volume).toBe(12)
  })

  it('sorts months chronologically', () => {
    const rows = [
      row({ los: 'Oil', monthKey: '2024-03', monthDisp: "Mar '24", date: new Date(2024, 2, 31), netAmount: -1, netVolume: 0 }),
      row({ los: 'Oil', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -1, netVolume: 0 }),
      row({ los: 'Oil', monthKey: '2024-02', monthDisp: "Feb '24", date: new Date(2024, 1, 29), netAmount: -1, netVolume: 0 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.months.map(m => m.key)).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('aggregates same category across multiple rows for same month', () => {
    const rows = [
      row({ wellName: 'A', los: 'Oil', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -1000, netVolume: -10 }),
      row({ wellName: 'B', los: 'Oil', monthKey: '2024-01', monthDisp: "Jan '24", date: new Date(2024, 0, 31), netAmount: -2000, netVolume: -20 }),
    ]
    const out = buildLOSCatData(rows, false)
    expect(out.catMap['Oil'].months['2024-01'].amount).toBeCloseTo(3000)
    expect(out.catMap['Oil'].months['2024-01'].volume).toBe(30)
  })
})

// ─── attachPricingDifferentials ────────────────────────────────────────────────

describe('attachPricingDifferentials', () => {
  it('computes NGL differential as realized NGL divided by WTI', () => {
    const monthlyRollup = [{
      monthKey: '2024-01',
      realizedOil: 70,
      realizedGas: 2.2,
      realizedNGL: 24.5,
    }]
    const wellData = [{
      wellName: 'Well A',
      monthlyData: [{ monthKey: '2024-01', realizedOil: 70, realizedGas: 2.2, realizedNGL: 24.5 }],
    }]
    const pricingRows = [{ monthKey: '2024-01', meh: 72, hsc: 2.0, wti: 70 }]

    const out = attachPricingDifferentials(monthlyRollup, wellData, pricingRows)
    expect(out.monthlyRollup[0].nglDifferential).toBeCloseTo(0.35)
    expect(out.wellData[0].monthlyData[0].nglDifferential).toBeCloseTo(0.35)
  })
})
