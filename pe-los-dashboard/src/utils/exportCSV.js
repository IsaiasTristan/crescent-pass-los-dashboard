function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAriesInputs(ariesInputs) {
  const { vdrCase, myCase } = ariesInputs

  const diff = (vdr, my) => {
    const v = parseFloat(vdr)
    const m = parseFloat(my)
    if (isNaN(v) || isNaN(m)) return ''
    return (m - v).toFixed(4)
  }

  const diffPct = (vdr, my) => {
    const v = parseFloat(vdr)
    const m = parseFloat(my)
    if (isNaN(v) || isNaN(m) || v === 0) return ''
    return `${(((m - v) / Math.abs(v)) * 100).toFixed(1)}%`
  }

  const rows = [
    { Input: 'Fixed Costs ($/well/month)',    'VDR Case': vdrCase.fixedPerWellMonth, 'My Case': myCase.fixedPerWellMonth, Variance: diff(vdrCase.fixedPerWellMonth, myCase.fixedPerWellMonth),    'Variance %': diffPct(vdrCase.fixedPerWellMonth, myCase.fixedPerWellMonth) },
    { Input: 'Variable Oil ($/BOE)',           'VDR Case': vdrCase.varOilPerBOE,       'My Case': myCase.varOilPerBOE,       Variance: diff(vdrCase.varOilPerBOE, myCase.varOilPerBOE),               'Variance %': diffPct(vdrCase.varOilPerBOE, myCase.varOilPerBOE) },
    { Input: 'Variable Water ($/BBL water)',   'VDR Case': vdrCase.varWaterPerBBL,     'My Case': myCase.varWaterPerBBL,     Variance: diff(vdrCase.varWaterPerBBL, myCase.varWaterPerBBL),           'Variance %': diffPct(vdrCase.varWaterPerBBL, myCase.varWaterPerBBL) },
    { Input: 'Production Taxes (% revenue)',   'VDR Case': vdrCase.prodTaxPct,         'My Case': myCase.prodTaxPct,         Variance: diff(vdrCase.prodTaxPct, myCase.prodTaxPct),                   'Variance %': diffPct(vdrCase.prodTaxPct, myCase.prodTaxPct) },
    { Input: 'Oil Differential ($/BBL)',       'VDR Case': vdrCase.oilDiff,            'My Case': myCase.oilDiff,            Variance: diff(vdrCase.oilDiff, myCase.oilDiff),                         'Variance %': diffPct(vdrCase.oilDiff, myCase.oilDiff) },
    { Input: 'Gas Differential ($/MMBTU)',     'VDR Case': vdrCase.gasDiff,            'My Case': myCase.gasDiff,            Variance: diff(vdrCase.gasDiff, myCase.gasDiff),                         'Variance %': diffPct(vdrCase.gasDiff, myCase.gasDiff) },
    { Input: 'NGL Differential (% of WTI)',   'VDR Case': vdrCase.nglDiffPct,         'My Case': myCase.nglDiffPct,         Variance: diff(vdrCase.nglDiffPct, myCase.nglDiffPct),                   'Variance %': diffPct(vdrCase.nglDiffPct, myCase.nglDiffPct) },
  ]

  downloadCSV('aries_inputs_export.csv', rows)
}

export function exportHistoricalData(wellData) {
  const rows = []
  for (const well of wellData) {
    for (const m of well.monthlyData) {
      rows.push({
        Well:                   well.wellName,
        Date:                   m.monthKey,
        NRI:                    well.nri,
        WI:                     well.wi,
        'Net Oil (BBL)':        m.oil_vol.toFixed(0),
        'Net Gas (MCF)':        m.gas_vol.toFixed(0),
        'Net NGL (BBL)':        m.ngl_vol.toFixed(0),
        'Net BOE':              m.netBOE.toFixed(0),
        'Fixed ($)':            m.fixed.toFixed(0),
        'Var Oil ($)':          m.var_oil.toFixed(0),
        'Var Water ($)':        m.var_water.toFixed(0),
        'Prod Taxes ($)':       m.prod_taxes.toFixed(0),
        'Total LOS ($)':        m.totalLOS.toFixed(0),
        'Revenue ($)':          m.totalRevenue.toFixed(0),
        'Op Margin ($)':        m.opMargin.toFixed(0),
        'LOS/BOE ($/BOE)':      m.costPerBOE.toFixed(2),
        'Revenue/BOE ($/BOE)':  m.revenuePerBOE.toFixed(2),
        'Margin/BOE ($/BOE)':   m.marginPerBOE.toFixed(2),
        'Realized Oil ($/BBL)': m.realizedOil.toFixed(2),
        'Realized Gas ($/MCF)': m.realizedGas.toFixed(3),
        'Realized NGL ($/BBL)': m.realizedNGL.toFixed(2),
      })
    }
  }
  downloadCSV('los_historical_export.csv', rows)
}
