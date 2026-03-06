const GAS_BOE = 6 // 6 MCFD = 1 BOE

function safeDiv(a, b) {
  if (!b || !isFinite(b) || b === 0) return 0
  const r = a / b
  return isFinite(r) ? r : 0
}

function getDays(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function emptyMonth(date, monthKey, monthDisplay) {
  return {
    date, monthKey, monthDisplay,
    oil_vol: 0, gas_vol: 0, ngl_vol: 0,
    oil_rev: 0, gas_rev: 0, ngl_rev: 0,
    gross_oil_vol: 0, gross_gas_vol: 0, gross_ngl_vol: 0,
    fixed: 0, var_oil: 0, var_water: 0, prod_taxes: 0,
  }
}

function accumulateRow(m, row) {
  const { bucket, netAmount, netVolume, grossVolume } = row
  if (bucket === 'oil') {
    m.oil_vol += netVolume
    m.oil_rev += Math.abs(netAmount)
    m.gross_oil_vol += grossVolume
  } else if (bucket === 'gas') {
    m.gas_vol += netVolume
    m.gas_rev += Math.abs(netAmount)
    m.gross_gas_vol += grossVolume
  } else if (bucket === 'ngl') {
    m.ngl_vol += netVolume
    m.ngl_rev += Math.abs(netAmount)
    m.gross_ngl_vol += grossVolume
  } else if (bucket === 'fixed') {
    m.fixed += netAmount
  } else if (bucket === 'variable_oil') {
    m.var_oil += netAmount
  } else if (bucket === 'variable_water') {
    m.var_water += netAmount
  } else if (bucket === 'prod_taxes') {
    m.prod_taxes += Math.abs(netAmount)
  }
}

function calcMetrics(m, wellCount) {
  const days = getDays(m.date)
  const netBOE = m.oil_vol + m.ngl_vol + safeDiv(m.gas_vol, GAS_BOE)
  const grossBOE = m.gross_oil_vol + m.gross_ngl_vol + safeDiv(m.gross_gas_vol, GAS_BOE)
  const totalRevenue = m.oil_rev + m.gas_rev + m.ngl_rev
  const totalLOS = m.fixed + m.var_oil + m.var_water + m.prod_taxes
  const opMargin = totalRevenue - totalLOS

  return {
    ...m,
    wellCount,
    netBOE,
    grossBOE,
    // Daily rates (divide monthly totals by days in month)
    netOild:    safeDiv(m.oil_vol, days),
    netGasd:    safeDiv(m.gas_vol, days),
    netNGLd:    safeDiv(m.ngl_vol, days),
    netBOEd:    safeDiv(netBOE, days),
    grossOild:  safeDiv(m.gross_oil_vol, days),
    grossGasd:  safeDiv(m.gross_gas_vol, days),
    grossNGLd:  safeDiv(m.gross_ngl_vol, days),
    grossBOEd:  safeDiv(grossBOE, days),
    // Financials
    totalRevenue,
    totalLOS,
    opMargin,
    // Per-unit metrics
    varOilPerBOE:   safeDiv(m.var_oil, m.oil_vol + m.ngl_vol),
    varWaterPerMonth: m.var_water,
    fixedPerWell:   safeDiv(m.fixed, wellCount),
    prodTaxPct:     totalRevenue > 0 ? safeDiv(m.prod_taxes, totalRevenue) * 100 : 0,
    costPerBOE:     safeDiv(totalLOS, netBOE),
    revenuePerBOE:  safeDiv(totalRevenue, netBOE),
    marginPerBOE:   safeDiv(opMargin, netBOE),
    // Realized prices
    realizedOil:    safeDiv(m.oil_rev, m.oil_vol),
    realizedGas:    safeDiv(m.gas_rev, m.gas_vol),
    realizedNGL:    safeDiv(m.ngl_rev, m.ngl_vol),
  }
}

export function buildMonthlyRollup(parsedRows) {
  const monthMap = {}
  const monthWells = {}

  for (const row of parsedRows) {
    if (!row.bucket || row.bucket === 'capex') continue

    const key = row.monthKey
    if (!monthMap[key]) {
      monthMap[key] = emptyMonth(row.date, row.monthKey, row.monthDisplay)
      monthWells[key] = new Set()
    }
    monthWells[key].add(row.wellName)
    accumulateRow(monthMap[key], row)
  }

  return Object.values(monthMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map(m => calcMetrics(m, monthWells[m.monthKey].size))
}

export function buildWellData(parsedRows) {
  const wellMap = {}

  for (const row of parsedRows) {
    if (!row.wellName) continue

    const wn = row.wellName
    if (!wellMap[wn]) {
      wellMap[wn] = {
        wellName: wn,
        jpRp:        row.jpRp,
        opObo:       row.opObo,
        nri:         row.nri,
        wi:          row.wi,
        propertyNum: row.propertyNum,
        months:      {},
      }
    }

    const well = wellMap[wn]
    // Update metadata from later rows (take latest non-empty)
    if (row.jpRp)   well.jpRp   = row.jpRp
    if (row.opObo)  well.opObo  = row.opObo
    if (row.nri)    well.nri    = row.nri
    if (row.wi)     well.wi     = row.wi

    if (!row.bucket || row.bucket === 'capex') continue

    const key = row.monthKey
    if (!well.months[key]) {
      well.months[key] = emptyMonth(row.date, row.monthKey, row.monthDisplay)
    }
    accumulateRow(well.months[key], row)
  }

  return Object.values(wellMap)
    .sort((a, b) => a.wellName.localeCompare(b.wellName))
    .map(well => {
      const monthlyData = Object.values(well.months)
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map(m => calcMetrics(m, 1))

      return { ...well, monthlyData }
    })
}
