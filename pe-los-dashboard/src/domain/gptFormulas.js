import { sd } from './metrics.js'

function num(value) {
  if (value == null || !isFinite(value)) return null
  return Number(value)
}

// ─── GPT Analysis Output Formulas ─────────────────────────────────────────────
// Keep all GPT formulas in this file so assumptions are easy to audit/change.

export const GPT_FORMULAS = {
  // NGL Yield (BBL/Mcf) = NGL volume / inlet gas volume
  nglYield(input) {
    const directYield = num(input.nglYield)
    if (directYield != null) return directYield
    const nglVolumeBbl = num(input.nglVolumeBbl)
    const inletVolumeMcf = num(input.inletVolumeMcf)
    if (nglVolumeBbl == null || inletVolumeMcf == null || inletVolumeMcf <= 0) return null
    return sd(nglVolumeBbl, inletVolumeMcf)
  },

  // Gas Shrink (%) — use provided % or derive from shrink volume / inlet.
  gasShrinkPct(input) {
    const shrinkPct = num(input.gasShrinkPct)
    if (shrinkPct != null) {
      // If a fraction is provided (0-1), normalize to percent.
      return shrinkPct <= 1 ? shrinkPct * 100 : shrinkPct
    }
    const gasShrinkMcf = num(input.gasShrinkMcf)
    const inletVolumeMcf = num(input.inletVolumeMcf)
    if (gasShrinkMcf == null || inletVolumeMcf == null || inletVolumeMcf <= 0) return null
    return sd(gasShrinkMcf, inletVolumeMcf) * 100
  },

  // BTU factor is a direct pass-through from source statements.
  btuFactor(input) {
    return num(input.btuFactor)
  },

  // Gas differential ($/Mcf):
  // 1) Prefer explicit differential column if provided.
  // 2) Else derive: realized residue gas price - benchmark gas price.
  //    Benchmark precedence: HHub, then generic benchmark gas price.
  gasDiff(input) {
    const explicitDiff = num(input.gasDifferential)
    if (explicitDiff != null) return explicitDiff

    const benchmark = num(input.hhubPrice) ?? num(input.benchmarkGasPrice)
    const residueGasSales = num(input.residueGasSales)
    const residueGasVolumeMcf = num(input.residueGasVolumeMcf)
    if (benchmark == null || residueGasSales == null || residueGasVolumeMcf == null || residueGasVolumeMcf <= 0) return null

    const realized = sd(residueGasSales, residueGasVolumeMcf)
    return realized - benchmark
  },

  // NGL price as % of WTI:
  // 1) Prefer direct differential % if provided.
  // 2) Else derive from realized NGL price and WTI.
  nglPricePctWti(input) {
    const directPct = num(input.nglDifferentialPct)
    if (directPct != null) return directPct <= 1 ? directPct * 100 : directPct

    const wtiPrice = num(input.wtiPrice)
    if (wtiPrice == null || wtiPrice <= 0) return null

    const explicitRealized = num(input.nglRealizedPrice)
    const nglSales = num(input.nglSales)
    const nglVolumeBbl = num(input.nglVolumeBbl)
    const realizedNgl = explicitRealized != null
      ? explicitRealized
      : (nglSales != null && nglVolumeBbl != null && nglVolumeBbl > 0 ? sd(nglSales, nglVolumeBbl) : null)
    if (realizedNgl == null) return null

    return sd(realizedNgl, wtiPrice) * 100
  },

  // GPT cost per Mcf ($/Mcf) = total midstream fee / inlet volume
  gptCostPerMcf(input) {
    const totalMidstreamFee = num(input.totalMidstreamFee)
    const inletVolumeMcf = num(input.inletVolumeMcf)
    if (totalMidstreamFee == null || inletVolumeMcf == null || inletVolumeMcf <= 0) return null
    return sd(totalMidstreamFee, inletVolumeMcf)
  },
}

export function computeGptOutputs(input) {
  return {
    nglYield: GPT_FORMULAS.nglYield(input),
    gasShrinkPct: GPT_FORMULAS.gasShrinkPct(input),
    btuFactor: GPT_FORMULAS.btuFactor(input),
    gasDiff: GPT_FORMULAS.gasDiff(input),
    nglPricePctWti: GPT_FORMULAS.nglPricePctWti(input),
    gptCostPerMcf: GPT_FORMULAS.gptCostPerMcf(input),
  }
}
