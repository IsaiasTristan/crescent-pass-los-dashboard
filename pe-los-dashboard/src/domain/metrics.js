// ─── Core domain: accumulation and metric derivation ─────────────────────────
// All functions here are pure (no React, no DOM, no I/O).

export const GAS_BOE = 6  // 6 MCF = 1 BOE

// Safe division — returns 0 for divide-by-zero and non-finite results
export function sd(a, b) {
  if (!b || !isFinite(b)) return 0
  const r = a / b
  return isFinite(r) ? r : 0
}

// Actual days in the month containing `date`
export function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

// Empty month accumulator matching the full bucket set
export function emptyM(date, mk, md) {
  return {
    date, monthKey: mk, monthDisp: md,
    oil_vol: 0, gas_vol: 0, ngl_vol: 0,
    oil_rev: 0, gas_rev: 0, ngl_rev: 0,
    gross_oil: 0, gross_gas: 0, gross_ngl: 0,
    gross_var_oil: 0, gross_var_water: 0, gross_gpt: 0, gross_fixed: 0, gross_workover: 0,
    fixed: 0, var_oil: 0, var_water: 0,
    gpt: 0, midstream: 0, workover: 0,
    gross_fixed_jp: 0, gross_fixed_rp: 0,
    gross_workover_jp: 0, gross_workover_rp: 0,
    prod_tax_oil: 0, prod_tax_gas: 0, prod_tax_ngl: 0,
    ad_valorem_tax: 0,
    prod_taxes: 0, capex: 0,
  }
}

function taxComponentKey(row) {
  const cat = (row.cat || '').toString().trim().toLowerCase()
  const los = (row.los || '').toString().trim().toLowerCase()

  if (cat === 'pto' || los === 'production taxes-oil') return 'prod_tax_oil'
  if (cat === 'ptg' || los === 'production taxes-gas') return 'prod_tax_gas'
  if (cat === 'ptngl' || los === 'production taxes-ngl') return 'prod_tax_ngl'
  if (cat === 'at' || los === 'ad valorem taxes') return 'ad_valorem_tax'
  return null
}

// Accumulate one parsed row into a month accumulator.
// Revenue buckets: sign is stored negative in source → flip with Math.abs().
// Cost buckets: use raw signed amount so credits reduce totals correctly.
export function accum(m, row) {
  const { bucket: b, netAmount: na, netVolume: nv, grossAmount: ga, grossVolume: gv } = row
  if (b === 'oil')            { m.oil_vol   += Math.abs(nv); m.oil_rev   += Math.abs(na); m.gross_oil += Math.abs(gv) }
  else if (b === 'gas')       { m.gas_vol   += Math.abs(nv); m.gas_rev   += Math.abs(na); m.gross_gas += Math.abs(gv) }
  else if (b === 'ngl')       { m.ngl_vol   += Math.abs(nv) / 42; m.ngl_rev += Math.abs(na); m.gross_ngl += Math.abs(gv) / 42 }
  else if (b === 'fixed')          { m.fixed      += na; m.gross_fixed += ga }
  else if (b === 'variable_oil')   { m.var_oil    += na; m.gross_var_oil   += ga }
  else if (b === 'variable_water') { m.var_water  += na; m.gross_var_water += ga }
  else if (b === 'gpt')            { m.gpt        += na; m.gross_gpt       += ga }
  else if (b === 'midstream')      { m.midstream  += na }
  else if (b === 'workover')       { m.workover   += na; m.gross_workover  += ga }
  else if (b === 'prod_taxes')     {
    m.prod_taxes += na
    const taxKey = taxComponentKey(row)
    if (taxKey) m[taxKey] += na
  }
  else if (b === 'capex')          { m.capex      += na }
}

// Derive all downstream metrics from a raw month accumulator + well count.
export function metrics(m, wellCount, splitCounts = {}) {
  const jpWellCount = splitCounts.jpWellCount || 0
  const rpWellCount = splitCounts.rpWellCount || 0
  const days   = daysInMonth(m.date)
  const netBOE   = m.oil_vol  + m.ngl_vol  + sd(m.gas_vol,  GAS_BOE)
  const grossBOE = m.gross_oil + m.gross_ngl + sd(m.gross_gas, GAS_BOE)
  const rev    = m.oil_rev + m.gas_rev + m.ngl_rev
  const los    = m.fixed + m.var_oil + m.var_water + m.gpt + m.workover + m.prod_taxes
  const margin = rev - los
  const severanceTaxes = m.prod_tax_oil + m.prod_tax_gas + m.prod_tax_ngl
  const adValoremBase = rev - severanceTaxes
  return {
    ...m, wellCount, jpWellCount, rpWellCount, netBOE, grossBOE,
    netOild:          sd(m.oil_vol,          days),
    netGasd:          sd(m.gas_vol,          days),
    netNGLd:          sd(m.ngl_vol,          days),
    netBOEd:          sd(netBOE,             days),
    grossOild:        sd(m.gross_oil,        days),
    grossGasd:        sd(m.gross_gas,        days),
    grossNGLd:        sd(m.gross_ngl,        days),
    grossBOEd:        sd(grossBOE,           days),
    netGasBOEd:       sd(m.gas_vol / GAS_BOE, days),
    grossGasBOEd:     sd(m.gross_gas / GAS_BOE, days),
    netGasBOE:        m.gas_vol   / GAS_BOE,
    grossGasBOE:      m.gross_gas / GAS_BOE,
    midstream:        m.midstream,
    midstreamPerBOE:  sd(m.midstream, netBOE),
    midstreamPerMcf:  sd(m.midstream, m.gross_gas),
    totalRevenue:     rev,
    totalLOS:         los,
    opMargin:         margin,
    totalFixed:       m.fixed + m.workover,
    assetFCF:         margin - m.capex,
    varOilPerBOE:     sd(m.gross_var_oil, m.gross_oil),
    gptPerMcf:        sd(m.gross_gpt, m.gross_gas),
    varWaterPerMonth: m.var_water,
    varWaterPerBBL:   null,
    fixedPerWell:     sd(m.gross_fixed, wellCount),
    fixedOnlyPerWell: sd(m.gross_fixed, wellCount),
    workoverPerWell:  sd(m.gross_workover, wellCount),
    jpFixedOnlyPerWell: sd(m.gross_fixed_jp || 0, jpWellCount),
    rpFixedOnlyPerWell: sd(m.gross_fixed_rp || 0, rpWellCount),
    jpWorkoverPerWell:  sd(m.gross_workover_jp || 0, jpWellCount),
    rpWorkoverPerWell:  sd(m.gross_workover_rp || 0, rpWellCount),
    capexPerWell:     sd(m.capex, wellCount),
    prodTaxPct:       rev > 0 ? sd(m.prod_taxes, rev) * 100 : 0,
    adValoremBase,
    severanceTaxes,
    oilSevTaxPct:     m.oil_rev > 0 ? sd(m.prod_tax_oil, m.oil_rev) * 100 : 0,
    gasSevTaxPct:     m.gas_rev > 0 ? sd(m.prod_tax_gas, m.gas_rev) * 100 : 0,
    nglSevTaxPct:     m.ngl_rev > 0 ? sd(m.prod_tax_ngl, m.ngl_rev) * 100 : 0,
    adValTaxPct:      adValoremBase > 0 ? sd(m.ad_valorem_tax, adValoremBase) * 100 : 0,
    costPerBOE:       sd(los,    netBOE),
    revenuePerBOE:    sd(rev,    netBOE),
    marginPerBOE:     sd(margin, netBOE),
    realizedOil:      sd(m.oil_rev, m.oil_vol),
    realizedGas:      sd(m.gas_rev, m.gas_vol),
    realizedNGL:      sd(m.ngl_rev, m.ngl_vol),
  }
}
