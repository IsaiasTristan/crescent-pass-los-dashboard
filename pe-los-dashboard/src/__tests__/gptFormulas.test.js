import { describe, it, expect } from 'vitest'
import { computeGptOutputs } from '../domain/gptFormulas.js'

describe('computeGptOutputs', () => {
  it('computes all outputs when inputs are present', () => {
    const out = computeGptOutputs({
      inletVolumeMcf: 100000,
      nglVolumeBbl: 2500,
      residueGasVolumeMcf: 84200,
      historicalWellheadGasMcf: 100000,
      btuFactor: 1.08,
      gasDifferential: -0.35,
      wtiPrice: 75,
      nglRealizedPrice: 30,
      totalMidstreamFee: 180000,
    })
    expect(out.nglYield).toBeCloseTo(25)
    expect(out.gasShrinkPct).toBeCloseTo(84.2)
    expect(out.btuFactor).toBeCloseTo(1.08)
    expect(out.gasDiff).toBeCloseTo(-0.35)
    expect(out.nglPricePctWti).toBeCloseTo(40)
    expect(out.gptCostPerMcf).toBeCloseTo(1.8)
  })

  it('derives shrink bridge percent from residue vs historical wellhead', () => {
    const out = computeGptOutputs({
      residueGasVolumeMcf: 76000,
      historicalWellheadGasMcf: 100000,
    })
    expect(out.gasShrinkPct).toBeCloseTo(76)
  })

  it('falls back to shrink volume / inlet when historical wellhead is missing', () => {
    const out = computeGptOutputs({
      inletVolumeMcf: 20000,
      gasShrinkMcf: 1200,
    })
    expect(out.gasShrinkPct).toBeCloseTo(6)
  })

  it('derives gas differential from realized less HHub', () => {
    const out = computeGptOutputs({
      residueGasSales: 45000,
      residueGasVolumeMcf: 20000,
      hhubPrice: 2.5,
    })
    expect(out.gasDiff).toBeCloseTo(-0.25)
  })

  it('falls back to benchmark gas price when HHub missing', () => {
    const out = computeGptOutputs({
      residueGasSales: 90000,
      residueGasVolumeMcf: 30000,
      benchmarkGasPrice: 2.7,
    })
    expect(out.gasDiff).toBeCloseTo(0.3)
  })

  it('returns nulls for non-computable outputs', () => {
    const out = computeGptOutputs({})
    expect(out.nglYield).toBeNull()
    expect(out.gasShrinkPct).toBeNull()
    expect(out.gasDiff).toBeNull()
    expect(out.nglPricePctWti).toBeNull()
    expect(out.gptCostPerMcf).toBeNull()
  })
})
