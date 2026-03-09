import Papa from 'papaparse'
import { EMPTY_CASE, ARIES_IMPORT_KEY_MAP, ARIES_INPUT_FIELDS } from '../constants/losMapping.js'

// ─── CSV download helper ──────────────────────────────────────────────────────

function dlCSV(filename, rows) {
  if (!rows || !rows.length) return
  const hdr = Object.keys(rows[0])
  const esc = v => {
    const s = v == null ? '' : String(v)
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    hdr.map(esc).join(','),
    ...rows.map(r => hdr.map(h => esc(r[h])).join(',')),
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ─── ARIES inputs export ──────────────────────────────────────────────────────

export function buildAriesExportRows(ariesInputs, histAverages = {}) {
  const { vdrCase: v, myCase: m } = ariesInputs
  const diff = (a, b) => {
    const an = parseFloat(a), bn = parseFloat(b)
    return (isNaN(an) || isNaN(bn)) ? '' : (bn - an).toFixed(4)
  }
  const pct = (a, b) => {
    const an = parseFloat(a), bn = parseFloat(b)
    return (isNaN(an) || isNaN(bn) || an === 0) ? '' : `${(((bn - an) / Math.abs(an)) * 100).toFixed(1)}%`
  }
  const row = field => ({
    Input:                   field.label,
    'State Key':             field.key,
    Unit:                    field.unit,
    'VDR Case (Operated)':   v.op[field.key],
    'VDR Case (Non-Op)':     v.obo[field.key],
    'My Case (Operated)':    m.op[field.key],
    'My Case (Non-Op)':      m.obo[field.key],
    'Variance (Op)':         diff(v.op[field.key],  m.op[field.key]),
    'Var% (Op)':             pct(v.op[field.key],   m.op[field.key]),
    'Variance (OBO)':        diff(v.obo[field.key], m.obo[field.key]),
    'Var% (OBO)':            pct(v.obo[field.key],  m.obo[field.key]),
    'Hist Avg':              Number.isFinite(histAverages[field.key]) ? String(histAverages[field.key]) : '',
  })
  return ARIES_INPUT_FIELDS.map(field => row(field))
}

export function exportInputs(ariesInputs, histAverages = {}) {
  dlCSV('aries_inputs_export.csv', buildAriesExportRows(ariesInputs, histAverages))
}

// ─── Historical data export ───────────────────────────────────────────────────
// Includes all metric buckets present in the live metrics pipeline.

export function exportHistorical(wellData) {
  const rows = []
  for (const w of wellData) {
    for (const m of w.monthlyData) {
      rows.push({
        Well:                   w.wellName,
        Date:                   m.monthKey,
        NRI:                    w.nri,
        WI:                     w.wi,
        'Net Oil (BBL)':        m.oil_vol.toFixed(0),
        'Net Gas (MCF)':        m.gas_vol.toFixed(0),
        'Net NGL (BBL)':        m.ngl_vol.toFixed(0),
        'Net BOE':              m.netBOE.toFixed(0),
        'Fixed ($)':            m.fixed.toFixed(0),
        'Workover ($)':         m.workover.toFixed(0),
        'Var Oil ($)':          m.var_oil.toFixed(0),
        'Var Water ($)':        m.var_water.toFixed(0),
        'Historical Gross Oil Volume': m.histGrossOilVolume != null ? m.histGrossOilVolume.toFixed(2) : '',
        'Historical Gross Gas Volume': m.histGrossGasVolume != null ? m.histGrossGasVolume.toFixed(2) : '',
        'Historical Gross NGL Volume': m.histGrossNGLVolume != null ? m.histGrossNGLVolume.toFixed(2) : '',
        'Historical Gross Water Volume': m.histGrossWaterVolume != null ? m.histGrossWaterVolume.toFixed(2) : '',
        'Historical Net Water Volume': m.histNetWaterVolume != null ? m.histNetWaterVolume.toFixed(2) : '',
        'Var Water ($/BBL water)': m.varWaterPerBBL != null ? m.varWaterPerBBL.toFixed(4) : '',
        'GPT ($)':              m.gpt.toFixed(0),
        'Midstream ($)':        m.midstream.toFixed(0),
        'Prod Taxes ($)':       m.prod_taxes.toFixed(0),
        'Oil Severance Tax ($)': m.prod_tax_oil.toFixed(0),
        'Gas Severance Tax ($)': m.prod_tax_gas.toFixed(0),
        'NGL Severance Tax ($)': m.prod_tax_ngl.toFixed(0),
        'Ad Valorem Tax ($)':    m.ad_valorem_tax.toFixed(0),
        'Severance Taxes ($)':   m.severanceTaxes.toFixed(0),
        'CAPEX ($)':            m.capex.toFixed(0),
        'Total LOS ($)':        m.totalLOS.toFixed(0),
        'Revenue ($)':          m.totalRevenue.toFixed(0),
        'Op Margin ($)':        m.opMargin.toFixed(0),
        'Asset FCF ($)':        m.assetFCF.toFixed(0),
        'LOS/BOE':              m.costPerBOE.toFixed(2),
        'GP&T/BOE':             m.gptPerBOE.toFixed(2),
        'Revenue/BOE':          m.revenuePerBOE.toFixed(2),
        'Margin/BOE':           m.marginPerBOE.toFixed(2),
        'Realized Oil ($/BBL)': m.realizedOil.toFixed(2),
        'Realized Gas ($/MCF)': m.realizedGas.toFixed(2),
        'Realized NGL ($/BBL)': m.realizedNGL.toFixed(2),
        'Actual Oil ($/BBL)':   m.actualOilPrice != null ? m.actualOilPrice.toFixed(2) : '',
        'Actual Gas ($/MCF)':   m.actualGasPrice != null ? m.actualGasPrice.toFixed(2) : '',
        'Actual NGL ($/BBL)':   m.actualNGLPrice != null ? m.actualNGLPrice.toFixed(2) : '',
        'Oil Diff ($/BBL)':     m.oilDifferential != null ? m.oilDifferential.toFixed(2) : '',
        'Gas Diff ($/MCF)':     m.gasDifferential != null ? m.gasDifferential.toFixed(2) : '',
        'NGL Diff (% of WTI)':  m.nglDifferential != null ? (m.nglDifferential * 100).toFixed(2) : '',
        'Oil Severance Tax (% Rev)': m.oilSevTaxPct.toFixed(2),
        'Gas Severance Tax (% Rev)': m.gasSevTaxPct.toFixed(2),
        'NGL Severance Tax (% Rev)': m.nglSevTaxPct.toFixed(2),
        'Ad Valorem Tax (% Rev net of severance)': m.adValTaxPct.toFixed(2),
      })
    }
  }
  dlCSV('los_historical_export.csv', rows)
}

// ─── ARIES inputs import ──────────────────────────────────────────────────────
// Parses an aries_inputs_export.csv back into the nested ARIES state shape.
// Throws on empty/unrecognizable files. Preserves EMPTY_CASE defaults for
// any fields not found in the import file.

export function exportDataQualityReport(issues, sourceFilename = 'los_data.csv') {
  if (!issues || !issues.length) return
  const base = (sourceFilename || 'los_data.csv').replace(/\.[^.]+$/, '')
  const rows = issues.map(i => ({
    'Source File': sourceFilename || 'los_data.csv',
    'Row Number': i.rowNumber ?? '',
    'Issue Type': i.issueType ?? '',
    Message: i.message ?? '',
    'Well Name': i.wellName ?? '',
    'Service End Date (Raw)': i.serviceEndDate ?? '',
    'Cost Category': i.costCategory ?? '',
    'LOS Category': i.losCategory ?? '',
    'Net Volume (Raw)': i.netVolumeRaw ?? '',
    'Net Amount (Raw)': i.netAmountRaw ?? '',
  }))
  dlCSV(`${base}_data_quality_report.csv`, rows)
}

export function parseAriesImport(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const result = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (!result.data || !result.data.length) {
    throw new Error('File appears empty or could not be parsed.')
  }

  const out = {
    vdrCase: { op: { ...EMPTY_CASE }, obo: { ...EMPTY_CASE } },
    myCase:  { op: { ...EMPTY_CASE }, obo: { ...EMPTY_CASE } },
  }

  let matched = 0
  for (const row of result.data) {
    const stateKey = (row['State Key'] || '').trim() || ARIES_IMPORT_KEY_MAP[(row['Input'] || '').trim()]
    if (!stateKey) continue
    matched++
    const vop  = (row['VDR Case (Operated)'] || '').trim()
    const vobo = (row['VDR Case (Non-Op)']   || '').trim()
    const mop  = (row['My Case (Operated)']  || '').trim()
    const mobo = (row['My Case (Non-Op)']    || '').trim()
    if (vop !== '')  out.vdrCase.op[stateKey]  = vop
    if (vobo !== '') out.vdrCase.obo[stateKey] = vobo
    if (mop !== '')  out.myCase.op[stateKey]   = mop
    if (mobo !== '') out.myCase.obo[stateKey]  = mobo
  }

  if (matched === 0) {
    throw new Error(
      'No recognizable input rows found. Make sure this is an aries_inputs_export.csv file.'
    )
  }
  return out
}
