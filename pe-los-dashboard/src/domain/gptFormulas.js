import { sd } from './metrics.js'

function num(value) {
  if (value == null || !isFinite(value)) return null
  return Number(value)
}

// ─── GPT Analysis Output Formulas ─────────────────────────────────────────────
// Keep all GPT formulas in this file so assumptions are easy to audit/change.

export const GPT_FORMULAS = {
  // NGL Yield (BBL/MMcf) = (NGL volume / inlet gas volume) * 1000
  // (display convention requested by user: scaled by 1000)
  nglYield(input) {
    const directYield = num(input.nglYield)
    if (directYield != null) return directYield * 1000
    const nglVolumeBbl = num(input.nglVolumeBbl)
    const inletVolumeMcf = num(input.inletVolumeMcf)
    if (nglVolumeBbl == null || inletVolumeMcf == null || inletVolumeMcf <= 0) return null
    return sd(nglVolumeBbl, inletVolumeMcf) * 1000
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

  // Inlet BTU factor (MMBtu/Mcf) — includes heat content of the NGL stream (wet gas).
  // Prefer explicitly mapped column; fall back to deriving from the two inlet-volume
  // columns when both MCF and MMBtu readings are available.
  btuFactor(input) {
    const direct = num(input.btuFactor)
    if (direct != null) return direct
    const mmBtu = num(input.inletVolumeMmBtu)
    const mcf   = num(input.inletVolumeMcf)
    if (mmBtu != null && mcf != null && mcf > 0) return mmBtu / mcf
    return null
  },

  // Residue gas BTU factor (MMBtu/Mcf) — heat content of the DRY residue gas stream
  // after NGL extraction, distinct from the inlet (wet gas) BTU factor.
  // Formula: Post-POP Residue Gas (MMBtu) / Post-POP Residue Gas (Mcf)
  // i.e. settlementResWithContract / residueGasVolumeMcf
  residueBtuFactor(input) {
    const mmBtu = num(input.settlementResWithContract) // Post-POP residue MMBtu
    const mcf   = num(input.residueGasVolumeMcf)      // Post-POP residue MCF
    if (mmBtu != null && mcf != null && mcf > 0) return mmBtu / mcf
    return null
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

  // GP&T $/Mcf = (Gathering Fee + Treating Fee) / Post-POP Residue Gas Volume.
  // This is the contractual GP&T deduct per MCF of gas actually sold.
  gptPerMcfResidueGas(input) {
    const gathering = num(input.gatheringFee) ?? 0
    const treating  = num(input.treatingFee) ?? 0
    const totalGT   = gathering + treating
    const residue   = num(input.residueGasVolumeMcf)
    if (totalGT === 0 || residue == null || residue <= 0) return null
    return sd(totalGT, residue)
  },

  // NGL yield computed from component-level POP-adjusted volumes.
  // Preferred over the direct nglYield when component data is available.
  nglYieldFromComponents(input) {
    const nglTotalBbl    = num(input.nglTotalBbl)
    const inletVolumeMcf = num(input.inletVolumeMcf)
    if (nglTotalBbl == null || inletVolumeMcf == null || inletVolumeMcf <= 0) return null
    return sd(nglTotalBbl, inletVolumeMcf) * 1000
  },

  // ── Per-fee $/Mcf rates ───────────────────────────────────────────────────
  // Derived automatically: fee amount ($) / inlet gas volume (Mcf).
  // No separate column mapping needed — computed from what the user already mapped.
  gatheringFeePerMcf(input) {
    const fee = num(input.gatheringFee)
    const mcf = num(input.inletVolumeMcf)
    if (fee == null || mcf == null || mcf <= 0) return null
    return sd(fee, mcf)
  },
  processingFeePerMcf(input) {
    const fee = num(input.processingFee)
    const mcf = num(input.inletVolumeMcf)
    if (fee == null || mcf == null || mcf <= 0) return null
    return sd(fee, mcf)
  },
  compressionFeePerMcf(input) {
    const fee = num(input.compressionFee)
    const mcf = num(input.inletVolumeMcf)
    if (fee == null || mcf == null || mcf <= 0) return null
    return sd(fee, mcf)
  },
  treatingFeePerMcf(input) {
    const fee = num(input.treatingFee)
    const mcf = num(input.inletVolumeMcf)
    if (fee == null || mcf == null || mcf <= 0) return null
    return sd(fee, mcf)
  },
}

export function computeGptOutputs(input) {
  return {
    nglYield:               GPT_FORMULAS.nglYield(input),
    gasShrinkPct:           GPT_FORMULAS.gasShrinkPct(input),
    btuFactor:              GPT_FORMULAS.btuFactor(input),
    residueBtuFactor:       GPT_FORMULAS.residueBtuFactor(input),
    gasDiff:                GPT_FORMULAS.gasDiff(input),
    nglPricePctWti:         GPT_FORMULAS.nglPricePctWti(input),
    gptCostPerMcf:          GPT_FORMULAS.gptCostPerMcf(input),
    gptPerMcfResidueGas:    GPT_FORMULAS.gptPerMcfResidueGas(input),
    nglYieldFromComponents: GPT_FORMULAS.nglYieldFromComponents(input),
    gatheringFeePerMcf:     GPT_FORMULAS.gatheringFeePerMcf(input),
    processingFeePerMcf:    GPT_FORMULAS.processingFeePerMcf(input),
    compressionFeePerMcf:   GPT_FORMULAS.compressionFeePerMcf(input),
    treatingFeePerMcf:      GPT_FORMULAS.treatingFeePerMcf(input),
  }
}
