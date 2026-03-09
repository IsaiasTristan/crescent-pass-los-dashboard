// ─── Aggregation selectors ────────────────────────────────────────────────────
// All functions here are pure (no React, no DOM, no I/O).

import { emptyM, accum, metrics, daysInMonth, GAS_BOE } from '../domain/metrics.js'

// ─── Monthly portfolio rollup ─────────────────────────────────────────────────

export function buildMonthlyRollup(rows) {
  const mm = {}, mw = {}, mwJp = {}, mwRp = {}
  const liftByWell = {}
  const liftCountsByWell = {}
  for (const r of rows) {
    const wn = r?.wellName
    if (!wn) continue
    const lift = (r.jpRp || '').toUpperCase().trim()
    if (!liftCountsByWell[wn]) liftCountsByWell[wn] = {}
    liftCountsByWell[wn][lift] = (liftCountsByWell[wn][lift] || 0) + 1
  }
  for (const [wn, c] of Object.entries(liftCountsByWell)) {
    liftByWell[wn] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
  }

  for (const r of rows) {
    if (!r.bucket || r.bucket === 'ignore') continue
    const k = r.monthKey
    if (!mm[k]) {
      mm[k] = emptyM(r.date, r.monthKey, r.monthDisp)
      mw[k] = new Set()
      mwJp[k] = new Set()
      mwRp[k] = new Set()
    }
    if (r.bucket !== 'capex') {
      mw[k].add(r.wellName)
      const lift = liftByWell[r.wellName] || ''
      if (lift === 'JP') mwJp[k].add(r.wellName)
      else if (lift === 'RP') mwRp[k].add(r.wellName)
    }
    accum(mm[k], r)
    const lift = liftByWell[r.wellName] || ''
    if (r.bucket === 'fixed') {
      if (lift === 'JP') mm[k].fixed_jp += r.netAmount
      else if (lift === 'RP') mm[k].fixed_rp += r.netAmount
    } else if (r.bucket === 'workover') {
      if (lift === 'JP') mm[k].workover_jp += r.netAmount
      else if (lift === 'RP') mm[k].workover_rp += r.netAmount
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
    histNetWaterVolume: target.histNetWaterVolume ?? null,
    varWaterPerBBL: target.varWaterPerBBL ?? null,
  }
}

export function attachHistoricalVolumes(monthlyRollup, wellData, volumeRows) {
  const rollupOut = (monthlyRollup || []).map(m => initHistoricalVolumeFields(m))
  const wellOut = (wellData || []).map(w => ({
    ...w,
    monthlyData: (w.monthlyData || []).map(m => initHistoricalVolumeFields(m)),
  }))
  if (!volumeRows || !volumeRows.length || !wellOut.length) {
    return { monthlyRollup: rollupOut, wellData: wellOut, warnings: [], histNetWaterByMonth: [] }
  }

  const { exact, ambiguous } = buildIdentifierMap(wellOut)
  const wellByName = Object.fromEntries(wellOut.map(w => [w.wellName, w]))
  const monthRollupByKey = Object.fromEntries(rollupOut.map(m => [m.monthKey, m]))
  let unmatchedCount = 0
  let unmatchedMonthCount = 0
  let zeroWiCount = 0

  // Accumulates net water for ALL matched-well rows regardless of whether the month
  // exists in the LOS data — enables a full historical net water chart.
  const histNetWaterMap = {}

  const addVolume = (obj, key, value) => {
    if (value == null || !isFinite(value)) return
    obj[key] = (obj[key] ?? 0) + value
  }

  for (const row of volumeRows) {
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
    const wi = Number(well.wi)
    const hasWater = row.grossWaterVolume != null && isFinite(row.grossWaterVolume)
    const netWaterVolume = hasWater && wi > 0 ? row.grossWaterVolume / wi : null
    if (hasWater && !(wi > 0)) zeroWiCount++

    // Always accumulate in the full historical net water series.
    if (netWaterVolume != null) {
      if (!histNetWaterMap[row.monthKey]) {
        histNetWaterMap[row.monthKey] = { monthKey: row.monthKey, monthDisp: row.monthDisp, netWater: 0, grossWater: 0 }
      }
      histNetWaterMap[row.monthKey].netWater += netWaterVolume
      histNetWaterMap[row.monthKey].grossWater += row.grossWaterVolume || 0
    }

    // Attach to LOS months for varWaterPerBBL calculation.
    const wellMonth = (well?.monthlyData || []).find(m => m.monthKey === row.monthKey)
    const rollupMonth = monthRollupByKey[row.monthKey]
    if (!wellMonth || !rollupMonth) {
      unmatchedMonthCount++
      continue
    }

    for (const target of [wellMonth, rollupMonth]) {
      addVolume(target, 'histGrossOilVolume', row.grossOilVolume)
      addVolume(target, 'histGrossGasVolume', row.grossGasVolume)
      addVolume(target, 'histGrossNGLVolume', row.grossNGLVolume)
      addVolume(target, 'histGrossWaterVolume', row.grossWaterVolume)
      addVolume(target, 'histNetWaterVolume', netWaterVolume)
    }
  }

  for (const well of wellOut) {
    for (const month of well.monthlyData) {
      month.varWaterPerBBL = month.histNetWaterVolume ? month.var_water / month.histNetWaterVolume : null
    }
  }
  for (const month of rollupOut) {
    month.varWaterPerBBL = month.histNetWaterVolume ? month.var_water / month.histNetWaterVolume : null
  }

  const histNetWaterByMonth = Object.values(histNetWaterMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  const warnings = []
  if (unmatchedCount > 0) {
    warnings.push(`${unmatchedCount} historical gross-volume row(s) could not be matched to any LOS well and were excluded.`)
  }
  if (unmatchedMonthCount > 0) {
    warnings.push(
      `${unmatchedMonthCount} historical gross-volume row(s) matched a well but fall outside the LOS date range — ` +
      `these are included in the historical net water chart but cannot be used for cost-per-BBL (expected for multi-year production histories).`
    )
  }
  if (zeroWiCount > 0) {
    warnings.push(`${zeroWiCount} historical gross-water row(s) had a zero or missing WI, so net water volume could not be calculated.`)
  }

  return { monthlyRollup: rollupOut, wellData: wellOut, warnings, histNetWaterByMonth }
}
