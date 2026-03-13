// ─── Aggregation selectors ────────────────────────────────────────────────────
// All functions here are pure (no React, no DOM, no I/O).

import { emptyM, accum, metrics, daysInMonth, GAS_BOE } from '../domain/metrics.js'

// ─── Monthly portfolio rollup ─────────────────────────────────────────────────

export function buildMonthlyRollup(rows) {
  const mm = {}, mw = {}, mwJp = {}, mwRp = {}
  const liftByWellMonth = {}
  const liftCountsByWellMonth = {}
  for (const r of rows) {
    const wn = r?.wellName
    const mk = r?.monthKey
    if (!wn || !mk) continue
    const lift = (r.jpRp || '').toUpperCase().trim()
    const key = `${mk}::${wn}`
    if (!liftCountsByWellMonth[key]) liftCountsByWellMonth[key] = {}
    liftCountsByWellMonth[key][lift] = (liftCountsByWellMonth[key][lift] || 0) + 1
  }
  for (const [key, counts] of Object.entries(liftCountsByWellMonth)) {
    liftByWellMonth[key] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  for (const r of rows) {
    if (!r.bucket || r.bucket === 'ignore') continue
    const k = r.monthKey
    const wellMonthKey = `${k}::${r.wellName}`
    const monthLift = liftByWellMonth[wellMonthKey] || ''
    if (!mm[k]) {
      mm[k] = emptyM(r.date, r.monthKey, r.monthDisp)
      mw[k] = new Set()
      mwJp[k] = new Set()
      mwRp[k] = new Set()
    }
    if (r.bucket !== 'capex') {
      mw[k].add(r.wellName)
      if (monthLift === 'JP') mwJp[k].add(r.wellName)
      else if (monthLift === 'RP') mwRp[k].add(r.wellName)
    }
    accum(mm[k], r)
    if (r.bucket === 'fixed') {
      if (monthLift === 'JP') mm[k].gross_fixed_jp += r.grossAmount
      else if (monthLift === 'RP') mm[k].gross_fixed_rp += r.grossAmount
    } else if (r.bucket === 'workover') {
      if (monthLift === 'JP') mm[k].gross_workover_jp += r.grossAmount
      else if (monthLift === 'RP') mm[k].gross_workover_rp += r.grossAmount
    }
  }
  return Object.values(mm)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map(m => metrics(m, mw[m.monthKey].size, {
      jpWellCount: mwJp[m.monthKey].size,
      rpWellCount: mwRp[m.monthKey].size,
    }))
}

// ─── Per-well aggregation ─────────────────────────────────────────────────────

export function buildWellData(rows) {
  const wm = {}
  for (const r of rows) {
    if (!r.wellName) continue
    const wn = r.wellName
    if (!wm[wn]) {
      wm[wn] = {
        wellName: wn,
        propertyNum: r.propertyNum,
        propertyName: r.propertyName,
        jpRp: r.jpRp,
        opObo: r.opObo,
        nri: r.nri,
        wi: r.wi,
        months: {},
      }
    }
    const w = wm[wn]
    // Update well-level metadata from later rows (last non-empty wins)
    if (r.propertyNum) w.propertyNum = r.propertyNum
    if (r.propertyName) w.propertyName = r.propertyName
    if (r.jpRp)  w.jpRp  = r.jpRp
    if (r.opObo) w.opObo = r.opObo
    if (r.nri)   w.nri   = r.nri
    if (r.wi)    w.wi    = r.wi
    if (!r.bucket || r.bucket === 'ignore') continue
    const k = r.monthKey
    if (!w.months[k]) w.months[k] = emptyM(r.date, r.monthKey, r.monthDisp)
    accum(w.months[k], r)
  }
  return Object.values(wm)
    .sort((a, b) => a.wellName.localeCompare(b.wellName))
    .map(w => ({
      ...w,
      monthlyData: Object.values(w.months)
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map(m => metrics(m, 1)),
    }))
}

// ─── LOS table category aggregation ──────────────────────────────────────────
// Returns { months, catMap } for use by the LOS Table tab.
// catMap: { [losLabel]: { bucket, months: { [monthKey]: { amount, volume } } } }

export function buildLOSCatData(rawRows, isGross) {
  const mMap = {}, catMap = {}
  for (const r of rawRows) {
    if (r.bucket === 'ignore') continue
    const label = r.los || r.cat || null
    if (!label) continue
    if (!mMap[r.monthKey]) mMap[r.monthKey] = { key: r.monthKey, disp: r.monthDisp, date: r.date }
    if (!catMap[label]) catMap[label] = { bucket: r.bucket, months: {} }
    if (!catMap[label].months[r.monthKey]) catMap[label].months[r.monthKey] = { amount: 0, volume: 0 }
    const d      = catMap[label].months[r.monthKey]
    const rawAmt = isGross ? r.grossAmount : r.netAmount
    const rawVol = isGross ? r.grossVolume : r.netVolume
    const isRev  = r.bucket === 'oil' || r.bucket === 'gas' || r.bucket === 'ngl'
    // Revenue is stored negative in source — flip sign for display
    d.amount += isRev ? -rawAmt : rawAmt
    // NGL volume comes in as gallons — convert to BBL
    d.volume += r.bucket === 'ngl' ? Math.abs(rawVol) / 42 : Math.abs(rawVol)
  }
  return {
    months: Object.values(mMap).sort((a, b) => a.key.localeCompare(b.key)),
    catMap,
  }
}

// ─── Row filter selector ──────────────────────────────────────────────────────
// Computes the modal lift type per well (using all rows) so that a single
// stray JP/RP tag on an ALLOC well doesn't override its true classification.

export function filterRows(rows, opFilter, liftFilter) {
  if (!rows) return null

  let filtered = rows

  if (opFilter !== 'all') {
    filtered = filtered.filter(r => {
      const v = (r.opObo || '').toUpperCase().trim()
      const isOp  = v === 'OP'  || v === 'OPERATED'
      const isObo = v === 'OBO' || v === 'NON-OPERATED' || v === 'NON-OP' || v.startsWith('NON')
      if (opFilter === 'op'  && !isOp)  return false
      if (opFilter === 'obo' && !isObo) return false
      return true
    })
  }

  if (liftFilter.length > 0) {
    // Build modal lift type per well across all (unfiltered) rows
    const counts = {}
    for (const r of rows) {
      const j = (r.jpRp || '').toUpperCase().trim()
      if (!counts[r.wellName]) counts[r.wellName] = {}
      counts[r.wellName][j] = (counts[r.wellName][j] || 0) + 1
    }
    const wellJpRp = {}
    for (const [wn, c] of Object.entries(counts)) {
      wellJpRp[wn] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
    }

    filtered = filtered.filter(r => {
      const j   = wellJpRp[r.wellName] || ''
      const isJP = j === 'JP', isRP = j === 'RP'
      return (liftFilter.includes('jp')    && isJP)
          || (liftFilter.includes('rp')    && isRP)
          || (liftFilter.includes('other') && !isJP && !isRP)
    })
  }

  return filtered
}

// ─── ARIES active-inputs selector ─────────────────────────────────────────────
// Flattens the nested op/obo state to a single case pair for chart overlays.
// opFilter 'obo' → obo sub-case; anything else → op sub-case.

export function selectActiveInputs(ariesInputs, opFilter) {
  const sub = opFilter === 'obo' ? 'obo' : 'op'
  return {
    vdrCase: ariesInputs.vdrCase[sub],
    myCase:  ariesInputs.myCase[sub],
  }
}

// Attach benchmark "actual" prices and index-minus-realized differential metrics
// to monthly rollup and well-by-well series using month-key joins.
export function attachPricingDifferentials(monthlyRollup, wellData, pricingRows) {
  const byMonth = {}
  ;(pricingRows || []).forEach(p => {
    if (p?.monthKey) byMonth[p.monthKey] = p
  })

  const pick = (...vals) => {
    for (const v of vals) {
      if (v != null && isFinite(v)) return Number(v)
    }
    return null
  }

  const withPricing = m => {
    const p = byMonth[m.monthKey] || {}
    const actualOil = pick(p.meh, p.wti)
    const actualGas = pick(p.hsc, p.henryHub)
    const actualNGL = pick(p.wti)

    return {
      ...m,
      actualOilPrice: actualOil,
      actualGasPrice: actualGas,
      actualNGLPrice: actualNGL,
      oilDifferential: actualOil != null ? (m.realizedOil - actualOil) : null,
      gasDifferential: actualGas != null ? (m.realizedGas - actualGas) : null,
      // NGL differential is defined as realized NGL price divided by WTI.
      nglDifferential: (actualNGL != null && actualNGL !== 0) ? (m.realizedNGL / actualNGL) : null,
      gasDiff: actualGas != null ? (m.realizedGas - actualGas) : null,
      nglDiffPct: (actualNGL != null && actualNGL !== 0) ? (m.realizedNGL / actualNGL) * 100 : null,
    }
  }

  return {
    monthlyRollup: (monthlyRollup || []).map(withPricing),
    wellData: (wellData || []).map(w => ({
      ...w,
      monthlyData: (w.monthlyData || []).map(withPricing),
    })),
  }
}

// GPT statement metrics are currently view-only (GPT tab) and do not flow into
// LOS rollups. Keep this passthrough to preserve the existing call sites.
export function attachGptToRollup(monthlyRollup, _gptTotalRollup, _opFilter) {
  return monthlyRollup || []
}

function normalizeIdentifier(value) {
  return (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildIdentifierMap(wellData) {
  const exact = new Map()
  const ambiguous = new Set()

  const add = (identifier, wellName) => {
    const normalized = normalizeIdentifier(identifier)
    if (!normalized) return
    const existing = exact.get(normalized)
    if (existing && existing !== wellName) {
      exact.delete(normalized)
      ambiguous.add(normalized)
      return
    }
    if (!ambiguous.has(normalized)) exact.set(normalized, wellName)
  }

  ;(wellData || []).forEach(well => {
    add(well.wellName, well.wellName)
    add(well.propertyNum, well.wellName)
    add(well.propertyName, well.wellName)
  })

  return { exact, ambiguous }
}

function initHistoricalVolumeFields(target) {
  return {
    ...target,
    histGrossOilVolume: target.histGrossOilVolume ?? null,
    histGrossGasVolume: target.histGrossGasVolume ?? null,
    histGrossNGLVolume: target.histGrossNGLVolume ?? null,
    histGrossWaterVolume: target.histGrossWaterVolume ?? null,
    varWaterPerBBL: target.varWaterPerBBL ?? null,
  }
}

function filterVolumeRowsByOpStatus(volumeRows, opFilter) {
  if (!volumeRows || !volumeRows.length || opFilter === 'all') return volumeRows || []
  return volumeRows.filter(row => {
    if (!row?.opStatus) return true
    if (opFilter === 'op') return row.opStatus === 'op'
    if (opFilter === 'obo') return row.opStatus === 'obo'
    return true
  })
}

export function attachHistoricalVolumes(monthlyRollup, wellData, volumeRows, opFilter = 'all') {
  const rollupOut = (monthlyRollup || []).map(m => initHistoricalVolumeFields(m))
  const wellOut = (wellData || []).map(w => ({
    ...w,
    monthlyData: (w.monthlyData || []).map(m => initHistoricalVolumeFields(m)),
  }))
  const scopedVolumeRows = filterVolumeRowsByOpStatus(volumeRows, opFilter)
  if (!scopedVolumeRows.length || !wellOut.length) {
    return { monthlyRollup: rollupOut, wellData: wellOut, warnings: [], histGrossWaterByMonth: [] }
  }

  const { exact, ambiguous } = buildIdentifierMap(wellOut)
  const wellByName = Object.fromEntries(wellOut.map(w => [w.wellName, w]))
  const monthRollupByKey = Object.fromEntries(rollupOut.map(m => [m.monthKey, m]))
  let unmatchedCount = 0
  let unmatchedMonthCount = 0

  // Accumulates gross water for ALL matched-well rows regardless of whether the month
  // exists in the LOS data — enables a full historical gross water chart.
  const histGrossWaterMap = {}

  const addVolume = (obj, key, value) => {
    if (value == null || !isFinite(value)) return
    obj[key] = (obj[key] ?? 0) + value
  }

  for (const row of scopedVolumeRows) {
    const rollupMonth = monthRollupByKey[row.monthKey]
    const hasWater = row.grossWaterVolume != null && isFinite(row.grossWaterVolume)

    if (hasWater) {
      if (!histGrossWaterMap[row.monthKey]) {
        histGrossWaterMap[row.monthKey] = { monthKey: row.monthKey, monthDisp: row.monthDisp, grossWater: 0 }
      }
      histGrossWaterMap[row.monthKey].grossWater += row.grossWaterVolume || 0
      if (rollupMonth) addVolume(rollupMonth, 'histGrossWaterVolume', row.grossWaterVolume)
    }

    const candidates = [row.applicableTag, row.wellName, row.propertyName]
      .map(normalizeIdentifier)
      .filter(Boolean)

    let matchedWellName = null
    for (const candidate of candidates) {
      if (ambiguous.has(candidate)) continue
      matchedWellName = exact.get(candidate) || null
      if (matchedWellName) break
    }

    if (!matchedWellName) {
      unmatchedCount++
      continue
    }

    const well = wellByName[matchedWellName]

    // Attach to LOS months for varWaterPerBBL calculation.
    const wellMonth = (well?.monthlyData || []).find(m => m.monthKey === row.monthKey)
    if (!wellMonth || !rollupMonth) {
      unmatchedMonthCount++
      continue
    }

    addVolume(wellMonth, 'histGrossOilVolume', row.grossOilVolume)
    addVolume(wellMonth, 'histGrossGasVolume', row.grossGasVolume)
    addVolume(wellMonth, 'histGrossNGLVolume', row.grossNGLVolume)
    addVolume(wellMonth, 'histGrossWaterVolume', row.grossWaterVolume)
    for (const target of [rollupMonth]) {
      addVolume(target, 'histGrossOilVolume', row.grossOilVolume)
      addVolume(target, 'histGrossGasVolume', row.grossGasVolume)
      addVolume(target, 'histGrossNGLVolume', row.grossNGLVolume)
    }
  }

  for (const well of wellOut) {
    for (const month of well.monthlyData) {
      month.varWaterPerBBL = month.histGrossWaterVolume ? month.gross_var_water / month.histGrossWaterVolume : null
    }
  }
  for (const month of rollupOut) {
    month.varWaterPerBBL = month.histGrossWaterVolume ? month.gross_var_water / month.histGrossWaterVolume : null
  }

  const histGrossWaterByMonth = Object.values(histGrossWaterMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  const warnings = []
  if (unmatchedCount > 0) {
    warnings.push(`${unmatchedCount} historical gross-volume row(s) could not be matched to any LOS well and were excluded.`)
  }
  if (unmatchedMonthCount > 0) {
    warnings.push(
      `${unmatchedMonthCount} historical gross-volume row(s) matched a well but fall outside the LOS date range — ` +
      `these are included in the historical gross-water chart but cannot be used for cost-per-BBL (expected for multi-year production histories).`
    )
  }

  return { monthlyRollup: rollupOut, wellData: wellOut, warnings, histGrossWaterByMonth }
}

// ─── GPT statement raw overlay ───────────────────────────────────────────────
// attachGptData: joins raw GPT statement rows (from parseMidstreamGptCsv) to the
// monthly rollup by aggregating fee and inlet volume internally.
// This helper is currently not used by the main rollup pipeline.

export function attachGptData(monthlyRollup, gptRows) {
  if (!gptRows || !gptRows.length) {
    return (monthlyRollup || []).map(m => ({
      ...m,
      gptStatementFee: null,
      gptStatementFeePerMcf: null,
      gptStatementInletMcf: null,
    }))
  }

  const byMonth = {}
  for (const row of gptRows) {
    if (!row?.monthKey) continue
    if (!byMonth[row.monthKey]) byMonth[row.monthKey] = { fee: 0, inletMcf: 0 }
    if (row.totalMidstreamFee != null && isFinite(row.totalMidstreamFee)) {
      byMonth[row.monthKey].fee += row.totalMidstreamFee
    }
    if (row.inletVolumeMcf != null && isFinite(row.inletVolumeMcf)) {
      byMonth[row.monthKey].inletMcf += row.inletVolumeMcf
    }
  }

  return (monthlyRollup || []).map(m => {
    const gpt = byMonth[m.monthKey]
    if (!gpt) return { ...m, gptStatementFee: null, gptStatementFeePerMcf: null, gptStatementInletMcf: null }
    const fee    = gpt.fee > 0 ? gpt.fee : null
    const inlet  = gpt.inletMcf > 0 ? gpt.inletMcf : null
    const perMcf = fee != null && inlet != null ? fee / inlet : null
    return { ...m, gptStatementFee: fee, gptStatementFeePerMcf: perMcf, gptStatementInletMcf: inlet }
  })
}
