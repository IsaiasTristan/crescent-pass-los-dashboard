import { computeGptOutputs } from '../domain/gptFormulas.js'
import { NGL_COMPONENTS } from '../constants/gptConfig.js'

function normalizeMeterName(value) {
  return (value || '').toString().trim() || 'Unknown Meter'
}

function normalizeMeterKey(value) {
  return (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function toNum(value) {
  return (value != null && isFinite(value)) ? Number(value) : null
}

function initAgg(date, monthKey, monthDisp, meterName = null) {
  const compAggs = {}
  for (const comp of NGL_COMPONENTS) {
    compAggs[comp.id] = { theoreticalGal: 0, allocatedGal: 0, popGal: 0, productValue: 0, hasData: false }
  }
  return {
    date,
    monthKey,
    monthDisp,
    meterName,
    inletVolumeMcf: 0,
    inletVolumeMmBtu: 0,
    nglVolumeBbl: 0,
    nglTotalGal: 0,
    gasShrinkMcf: 0,
    settlementResWithContractMmBtu: 0,  // Post-POP residue MMBtu — needed for residue BTU factor
    residueGasVolumeMcf: 0,
    residueGasSales: 0,
    nglSales: 0,
    totalMidstreamFee: 0,
    gatheringFee: 0,
    processingFee: 0,
    compressionFee: 0,
    treatingFee: 0,
    gasShrinkPctWeightedNumerator: 0,
    gasShrinkPctWeight: 0,
    nglYieldWeightedNumerator: 0,
    nglYieldWeight: 0,
    btuFactorWeightedNumerator: 0,
    btuFactorWeight: 0,
    hhubPriceWeightedNumerator: 0,
    hhubPriceWeight: 0,
    benchmarkGasPriceWeightedNumerator: 0,
    benchmarkGasPriceWeight: 0,
    wtiPriceWeightedNumerator: 0,
    wtiPriceWeight: 0,
    nglRealizedPriceWeightedNumerator: 0,
    nglRealizedPriceWeight: 0,
    gasDifferentialWeightedNumerator: 0,
    gasDifferentialWeight: 0,
    nglDifferentialPctWeightedNumerator: 0,
    nglDifferentialPctWeight: 0,
    nglComponents: compAggs,
  }
}

function addWeighted(agg, value, weight, numKey, wtKey) {
  if (value == null || !isFinite(value) || weight == null || !isFinite(weight) || weight <= 0) return
  agg[numKey] += Number(value) * Number(weight)
  agg[wtKey] += Number(weight)
}

function addRaw(agg, row) {
  const inlet = toNum(row.inletVolumeMcf)
  const inletMmBtu = toNum(row.inletVolumeMmBtu)
  const ngl = toNum(row.nglVolumeBbl)
  const shrinkMcf = toNum(row.gasShrinkMcf)
  const settlementResWithContractMmBtu = toNum(row.settlementResWithContract)
  const residueGas = toNum(row.residueGasVolumeMcf)
  const residueGasSales = toNum(row.residueGasSales)
  const nglSales = toNum(row.nglSales)
  const fee = toNum(row.totalMidstreamFee)
  const gathering = toNum(row.gatheringFee)
  const treating  = toNum(row.treatingFee)
  const nglTotalGal = toNum(row.nglTotalGal)
  const defaultWeight = inlet != null && inlet > 0 ? inlet : 0

  if (inlet != null)        agg.inletVolumeMcf     += inlet
  if (inletMmBtu != null)   agg.inletVolumeMmBtu   += inletMmBtu
  if (ngl != null)          agg.nglVolumeBbl        += ngl
  if (nglTotalGal != null)  agg.nglTotalGal         += nglTotalGal
  if (shrinkMcf != null)    agg.gasShrinkMcf        += shrinkMcf
  if (settlementResWithContractMmBtu != null) agg.settlementResWithContractMmBtu += settlementResWithContractMmBtu
  if (residueGas != null)   agg.residueGasVolumeMcf += residueGas
  if (residueGasSales != null) agg.residueGasSales  += residueGasSales
  if (nglSales != null)     agg.nglSales            += nglSales
  if (fee != null)                      agg.totalMidstreamFee += fee
  if (gathering != null)                agg.gatheringFee      += gathering
  if (toNum(row.processingFee) != null) agg.processingFee     += toNum(row.processingFee)
  if (toNum(row.compressionFee) != null) agg.compressionFee   += toNum(row.compressionFee)
  if (treating != null)                 agg.treatingFee       += treating

  addWeighted(agg, toNum(row.gasShrinkPct), defaultWeight, 'gasShrinkPctWeightedNumerator', 'gasShrinkPctWeight')
  addWeighted(agg, toNum(row.nglYield), defaultWeight, 'nglYieldWeightedNumerator', 'nglYieldWeight')
  addWeighted(agg, toNum(row.btuFactor), defaultWeight, 'btuFactorWeightedNumerator', 'btuFactorWeight')
  addWeighted(agg, toNum(row.hhubPrice), defaultWeight, 'hhubPriceWeightedNumerator', 'hhubPriceWeight')
  addWeighted(agg, toNum(row.benchmarkGasPrice), defaultWeight, 'benchmarkGasPriceWeightedNumerator', 'benchmarkGasPriceWeight')
  addWeighted(agg, toNum(row.wtiPrice), defaultWeight, 'wtiPriceWeightedNumerator', 'wtiPriceWeight')
  addWeighted(agg, toNum(row.nglRealizedPrice), defaultWeight, 'nglRealizedPriceWeightedNumerator', 'nglRealizedPriceWeight')
  addWeighted(agg, toNum(row.gasDifferential), defaultWeight, 'gasDifferentialWeightedNumerator', 'gasDifferentialWeight')
  addWeighted(agg, toNum(row.nglDifferentialPct), defaultWeight, 'nglDifferentialPctWeightedNumerator', 'nglDifferentialPctWeight')

  // Accumulate per-component NGL volumes
  if (row.nglComponents) {
    for (const comp of NGL_COMPONENTS) {
      const src = row.nglComponents[comp.id]
      if (!src) continue
      const ca = agg.nglComponents[comp.id]
      if (src.theoreticalGal != null) { ca.theoreticalGal += src.theoreticalGal; ca.hasData = true }
      if (src.allocatedGal   != null) { ca.allocatedGal   += src.allocatedGal;   ca.hasData = true }
      if (src.popGal         != null) { ca.popGal         += src.popGal;         ca.hasData = true }
      if (src.productValue   != null) { ca.productValue   += src.productValue;   ca.hasData = true }
    }
  }
}

function finalizeAgg(agg, options = {}) {
  const weighted = (num, den) => (den > 0 ? num / den : null)
  const meterKey = normalizeMeterKey(agg.meterName)
  const historicalWellheadGasMcf = agg.meterName === 'Total'
    ? (options.totalWellheadGasByMonth?.[agg.monthKey] ?? null)
    : (options.wellheadGasByMeterMonth?.[meterKey]?.[agg.monthKey] ?? null)

  // Compute NGL component totals and composition
  const totalNglGal = NGL_COMPONENTS.reduce((s, c) => s + (agg.nglComponents[c.id]?.popGal || 0), 0)
  const nglTotalBblFromComps = totalNglGal > 0 ? totalNglGal / 42 : null
  const inlet = agg.inletVolumeMcf > 0 ? agg.inletVolumeMcf : null

  const nglComponents = {}
  for (const comp of NGL_COMPONENTS) {
    const ca = agg.nglComponents[comp.id]
    if (!ca || !ca.hasData) { nglComponents[comp.id] = null; continue }
    const popGal = ca.popGal || 0
    nglComponents[comp.id] = {
      theoreticalGal: ca.theoreticalGal > 0 ? ca.theoreticalGal : null,
      allocatedGal:   ca.allocatedGal   > 0 ? ca.allocatedGal   : null,
      popGal:         popGal > 0 ? popGal : null,
      popBbl:         popGal > 0 ? popGal / 42 : null,
      productValue:   ca.productValue !== 0 ? ca.productValue : null,
      recoveryPct:    (ca.theoreticalGal > 0 && ca.allocatedGal > 0)
        ? (ca.allocatedGal / ca.theoreticalGal) * 100 : null,
      galPerMcf: (popGal > 0 && inlet != null) ? popGal / inlet : null,
      pctOfNgl:  (popGal > 0 && totalNglGal > 0) ? (popGal / totalNglGal) * 100 : null,
    }
  }

  // Prefer component-derived NGL vol when available; fall back to direct column sum
  const nglVolumeBbl = nglTotalBblFromComps ?? (agg.nglVolumeBbl > 0 ? agg.nglVolumeBbl : null)
  const nglTotalGalFinal = totalNglGal > 0 ? totalNglGal : (agg.nglTotalGal > 0 ? agg.nglTotalGal : null)

  const formulaInput = {
    inletVolumeMcf:      inlet,
    inletVolumeMmBtu:    agg.inletVolumeMmBtu > 0 ? agg.inletVolumeMmBtu : null,
    nglVolumeBbl,
    nglTotalBbl:         nglTotalBblFromComps,
    nglYield:            weighted(agg.nglYieldWeightedNumerator, agg.nglYieldWeight),
    gasShrinkMcf:        agg.gasShrinkMcf > 0 ? agg.gasShrinkMcf : null,
    gasShrinkPct:        weighted(agg.gasShrinkPctWeightedNumerator, agg.gasShrinkPctWeight),
    btuFactor:           weighted(agg.btuFactorWeightedNumerator, agg.btuFactorWeight),
    // For residue BTU factor: sum of Post-POP MMBtu / sum of residue MCF
    settlementResWithContract: agg.settlementResWithContractMmBtu > 0 ? agg.settlementResWithContractMmBtu : null,
    residueGasVolumeMcf: agg.residueGasVolumeMcf > 0 ? agg.residueGasVolumeMcf : null,
    residueGasSales:     agg.residueGasSales !== 0 ? agg.residueGasSales : null,
    hhubPrice:           weighted(agg.hhubPriceWeightedNumerator, agg.hhubPriceWeight),
    benchmarkGasPrice:   weighted(agg.benchmarkGasPriceWeightedNumerator, agg.benchmarkGasPriceWeight),
    gasDifferential:     weighted(agg.gasDifferentialWeightedNumerator, agg.gasDifferentialWeight),
    wtiPrice:            weighted(agg.wtiPriceWeightedNumerator, agg.wtiPriceWeight),
    nglRealizedPrice:    weighted(agg.nglRealizedPriceWeightedNumerator, agg.nglRealizedPriceWeight),
    nglSales:            agg.nglSales !== 0 ? agg.nglSales : null,
    nglDifferentialPct:  weighted(agg.nglDifferentialPctWeightedNumerator, agg.nglDifferentialPctWeight),
    historicalWellheadGasMcf,
    totalMidstreamFee:   agg.totalMidstreamFee  !== 0 ? agg.totalMidstreamFee  : null,
    gatheringFee:        agg.gatheringFee       !== 0 ? agg.gatheringFee       : null,
    processingFee:       agg.processingFee      !== 0 ? agg.processingFee      : null,
    compressionFee:      agg.compressionFee     !== 0 ? agg.compressionFee     : null,
    treatingFee:         agg.treatingFee        !== 0 ? agg.treatingFee        : null,
  }
  const outputs = computeGptOutputs(formulaInput)

  return {
    date:       agg.date,
    monthKey:   agg.monthKey,
    monthDisp:  agg.monthDisp,
    meterName:  agg.meterName,
    ...formulaInput,
    ...outputs,
    historicalWellheadGasMcf,
    nglTotalGal:       nglTotalGalFinal,
    nglComponents,
  }
}

export function buildGptRollup(rows, options = {}) {
  const byMeterMonth = {}
  const totalByMonth = {}

  for (const row of rows || []) {
    if (!row?.monthKey) continue
    const meterName = normalizeMeterName(row.meterName)
    const meterMonthKey = `${meterName}::${row.monthKey}`

    if (!byMeterMonth[meterMonthKey]) {
      byMeterMonth[meterMonthKey] = initAgg(row.date, row.monthKey, row.monthDisp, meterName)
    }
    if (!totalByMonth[row.monthKey]) {
      totalByMonth[row.monthKey] = initAgg(row.date, row.monthKey, row.monthDisp, 'Total')
    }

    addRaw(byMeterMonth[meterMonthKey], row)
    addRaw(totalByMonth[row.monthKey], row)
  }

  const byMeter = {}
  Object.values(byMeterMonth).forEach(agg => {
    const result = finalizeAgg(agg, options)
    if (!byMeter[result.meterName]) byMeter[result.meterName] = []
    byMeter[result.meterName].push(result)
  })
  Object.values(byMeter).forEach(series => {
    series.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  })

  const meters = Object.keys(byMeter).sort((a, b) => a.localeCompare(b))
  const totalRollup = Object.values(totalByMonth)
    .map(agg => finalizeAgg(agg, options))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  return { byMeter, totalRollup, meters }
}
