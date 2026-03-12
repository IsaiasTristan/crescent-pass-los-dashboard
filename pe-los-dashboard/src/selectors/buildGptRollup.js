import { computeGptOutputs } from '../domain/gptFormulas.js'

function normalizeMeterName(value) {
  return (value || '').toString().trim() || 'Unknown Meter'
}

function toNum(value) {
  return (value != null && isFinite(value)) ? Number(value) : null
}

function initAgg(date, monthKey, monthDisp, meterName = null) {
  return {
    date,
    monthKey,
    monthDisp,
    meterName,
    inletVolumeMcf: 0,
    nglVolumeBbl: 0,
    gasShrinkMcf: 0,
    residueGasVolumeMcf: 0,
    residueGasSales: 0,
    nglSales: 0,
    totalMidstreamFee: 0,
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
  }
}

function addWeighted(agg, value, weight, numKey, wtKey) {
  if (value == null || !isFinite(value) || weight == null || !isFinite(weight) || weight <= 0) return
  agg[numKey] += Number(value) * Number(weight)
  agg[wtKey] += Number(weight)
}

function addRaw(agg, row) {
  const inlet = toNum(row.inletVolumeMcf)
  const ngl = toNum(row.nglVolumeBbl)
  const shrinkMcf = toNum(row.gasShrinkMcf)
  const residueGas = toNum(row.residueGasVolumeMcf)
  const residueGasSales = toNum(row.residueGasSales)
  const nglSales = toNum(row.nglSales)
  const fee = toNum(row.totalMidstreamFee)
  const defaultWeight = inlet != null && inlet > 0 ? inlet : 0

  if (inlet != null) agg.inletVolumeMcf += inlet
  if (ngl != null) agg.nglVolumeBbl += ngl
  if (shrinkMcf != null) agg.gasShrinkMcf += shrinkMcf
  if (residueGas != null) agg.residueGasVolumeMcf += residueGas
  if (residueGasSales != null) agg.residueGasSales += residueGasSales
  if (nglSales != null) agg.nglSales += nglSales
  if (fee != null) agg.totalMidstreamFee += fee

  addWeighted(agg, toNum(row.gasShrinkPct), defaultWeight, 'gasShrinkPctWeightedNumerator', 'gasShrinkPctWeight')
  addWeighted(agg, toNum(row.nglYield), defaultWeight, 'nglYieldWeightedNumerator', 'nglYieldWeight')
  addWeighted(agg, toNum(row.btuFactor), defaultWeight, 'btuFactorWeightedNumerator', 'btuFactorWeight')
  addWeighted(agg, toNum(row.hhubPrice), defaultWeight, 'hhubPriceWeightedNumerator', 'hhubPriceWeight')
  addWeighted(agg, toNum(row.benchmarkGasPrice), defaultWeight, 'benchmarkGasPriceWeightedNumerator', 'benchmarkGasPriceWeight')
  addWeighted(agg, toNum(row.wtiPrice), defaultWeight, 'wtiPriceWeightedNumerator', 'wtiPriceWeight')
  addWeighted(agg, toNum(row.nglRealizedPrice), defaultWeight, 'nglRealizedPriceWeightedNumerator', 'nglRealizedPriceWeight')
  addWeighted(agg, toNum(row.gasDifferential), defaultWeight, 'gasDifferentialWeightedNumerator', 'gasDifferentialWeight')
  addWeighted(agg, toNum(row.nglDifferentialPct), defaultWeight, 'nglDifferentialPctWeightedNumerator', 'nglDifferentialPctWeight')
}

function finalizeAgg(agg) {
  const weighted = (num, den) => (den > 0 ? num / den : null)
  const formulaInput = {
    inletVolumeMcf: agg.inletVolumeMcf > 0 ? agg.inletVolumeMcf : null,
    nglVolumeBbl: agg.nglVolumeBbl > 0 ? agg.nglVolumeBbl : null,
    nglYield: weighted(agg.nglYieldWeightedNumerator, agg.nglYieldWeight),
    gasShrinkMcf: agg.gasShrinkMcf > 0 ? agg.gasShrinkMcf : null,
    gasShrinkPct: weighted(agg.gasShrinkPctWeightedNumerator, agg.gasShrinkPctWeight),
    btuFactor: weighted(agg.btuFactorWeightedNumerator, agg.btuFactorWeight),
    residueGasVolumeMcf: agg.residueGasVolumeMcf > 0 ? agg.residueGasVolumeMcf : null,
    residueGasSales: agg.residueGasSales !== 0 ? agg.residueGasSales : null,
    hhubPrice: weighted(agg.hhubPriceWeightedNumerator, agg.hhubPriceWeight),
    benchmarkGasPrice: weighted(agg.benchmarkGasPriceWeightedNumerator, agg.benchmarkGasPriceWeight),
    gasDifferential: weighted(agg.gasDifferentialWeightedNumerator, agg.gasDifferentialWeight),
    wtiPrice: weighted(agg.wtiPriceWeightedNumerator, agg.wtiPriceWeight),
    nglRealizedPrice: weighted(agg.nglRealizedPriceWeightedNumerator, agg.nglRealizedPriceWeight),
    nglSales: agg.nglSales !== 0 ? agg.nglSales : null,
    nglDifferentialPct: weighted(agg.nglDifferentialPctWeightedNumerator, agg.nglDifferentialPctWeight),
    totalMidstreamFee: agg.totalMidstreamFee !== 0 ? agg.totalMidstreamFee : null,
  }
  const outputs = computeGptOutputs(formulaInput)

  return {
    date: agg.date,
    monthKey: agg.monthKey,
    monthDisp: agg.monthDisp,
    meterName: agg.meterName,
    ...formulaInput,
    ...outputs,
  }
}

export function buildGptRollup(rows) {
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
    const result = finalizeAgg(agg)
    if (!byMeter[result.meterName]) byMeter[result.meterName] = []
    byMeter[result.meterName].push(result)
  })
  Object.values(byMeter).forEach(series => {
    series.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  })

  const meters = Object.keys(byMeter).sort((a, b) => a.localeCompare(b))
  const totalRollup = Object.values(totalByMonth)
    .map(finalizeAgg)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  return { byMeter, totalRollup, meters }
}
