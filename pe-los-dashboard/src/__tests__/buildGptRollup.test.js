import { describe, it, expect } from 'vitest'
import { buildGptRollup } from '../selectors/buildGptRollup.js'

describe('buildGptRollup', () => {
  it('aggregates by meter and total rollup by month', () => {
    const rows = [
      {
        date: new Date(2025, 0, 1),
        monthKey: '2025-01',
        monthDisp: "Jan '25",
        meterName: 'Rangel Behrens',
        inletVolumeMcf: 100000,
        nglVolumeBbl: 2500,
        gasShrinkPct: 4.5,
        btuFactor: 1.07,
        residueGasSales: 220000,
        residueGasVolumeMcf: 95000,
        hhubPrice: 2.5,
        wtiPrice: 74,
        nglRealizedPrice: 29,
        totalMidstreamFee: 180000,
      },
      {
        date: new Date(2025, 0, 1),
        monthKey: '2025-01',
        monthDisp: "Jan '25",
        meterName: 'Birnbaum + Mitschke',
        inletVolumeMcf: 50000,
        nglVolumeBbl: 1100,
        gasShrinkPct: 5,
        btuFactor: 1.03,
        residueGasSales: 102500,
        residueGasVolumeMcf: 47000,
        benchmarkGasPrice: 2.4,
        wtiPrice: 74,
        nglRealizedPrice: 27,
        totalMidstreamFee: 85000,
      },
    ]

    const out = buildGptRollup(rows)
    expect(out.meters).toEqual(['Birnbaum + Mitschke', 'Rangel Behrens'])
    expect(out.byMeter['Rangel Behrens']).toHaveLength(1)
    expect(out.byMeter['Birnbaum + Mitschke']).toHaveLength(1)
    expect(out.totalRollup).toHaveLength(1)
    expect(out.totalRollup[0].gptCostPerMcf).toBeCloseTo((180000 + 85000) / 150000)
    expect(out.totalRollup[0].nglYield).toBeCloseTo(((2500 + 1100) / 150000) * 1000)
  })
})
