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
    fixed: 0, var_oil: 0, var_water: 0,
    gpt: 0, midstream: 0, workover: 0,
    prod_taxes: 0, capex: 0,
  }
}

// Accumulate one parsed row into a month accumulator.
// Revenue buckets: sign is stored negative in source → flip with Math.abs().
// Cost buckets: use raw signed amount so credits reduce totals correctly.
export function accum(m, row) {
  const { bucket: b, netAmount: na, netVolume: nv, grossVolume: gv } = row
  if (b === 'oil')            { m.oil_vol   += Math.abs(nv); m.oil_rev   += Math.abs(na); m.gross_oil += Math.abs(gv) }
  else if (b === 'gas')       { m.gas_vol   += Math.abs(nv); m.gas_rev   += Math.abs(na); m.gross_gas += Math.abs(gv) }
  else if (b === 'ngl')       { m.ngl_vol   += Math.abs(nv) / 42; m.ngl_rev += Math.abs(na); m.gross_ngl += Math.abs(gv) / 42 }
  else if (b === 'fixed')          { m.fixed      += na }
  else if (b === 'variable_oil')   { m.var_oil    += na }
  else if (b === 'variable_water') { m.var_water  += na }
  else if (b === 'gpt')            { m.gpt        += na }
  else if (b === 'midstream')      { m.midstream  += na }
  else if (b === 'workover')       { m.workover   += na }
  else if (b === 'prod_taxes')     { m.prod_taxes += na }
  else if (b === 'capex')          { m.capex      += na }
}

// Derive all downstream metrics from a raw month accumulator + well count.
export function metrics(m, wellCount) {
  const days   = daysInMonth(m.date)
  const netBOE   = m.oil_vol  + m.ngl_vol  + sd(m.gas_vol,  GAS_BOE)
  const grossBOE = m.gross_oil + m.gross_ngl + sd(m.gross_gas, GAS_BOE)
  const rev    = m.oil_rev + m.gas_rev + m.ngl_rev
  const los    = m.fixed + m.var_oil + m.var_water + m.gpt + m.workover + m.prod_taxes
  const margin = rev - los
  return {
    ...m, wellCount, netBOE, grossBOE,
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
    totalRevenue:     rev,
    totalLOS:         los,
    opMargin:         margin,
    totalFixed:       m.fixed + m.workover,
    assetFCF:         margin - m.capex,
    varOilPerBOE:     sd(m.var_oil, m.oil_vol + m.ngl_vol),
    gptPerBOE:        sd(m.gpt, netBOE),
    varWaterPerMonth: m.var_water,
    fixedPerWell:     sd(m.fixed + m.workover, wellCount),
    capexPerWell:     sd(m.capex, wellCount),
    prodTaxPct:       rev > 0 ? sd(m.prod_taxes, rev) * 100 : 0,
    costPerBOE:       sd(los,    netBOE),
    revenuePerBOE:    sd(rev,    netBOE),
    marginPerBOE:     sd(margin, netBOE),
    realizedOil:      sd(m.oil_rev, m.oil_vol),
    realizedGas:      sd(m.gas_rev, m.gas_vol),
    realizedNGL:      sd(m.ngl_rev, m.ngl_vol),
  }
}
