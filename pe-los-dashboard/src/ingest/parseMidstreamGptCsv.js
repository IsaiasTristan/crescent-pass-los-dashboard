import Papa from 'papaparse'
import { GPT_COLUMN_ALIASES } from '../constants/gptMapping.js'
import { monthKey, monthDisp, parseDate } from './parseCsv.js'

function normalizeHeader(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function buildHeaderIndex(headers) {
  const out = {}
  headers.forEach((header, idx) => {
    const key = normalizeHeader(header)
    if (key && out[key] === undefined) out[key] = idx
  })
  return out
}

function findIndex(index, aliases) {
  for (const alias of aliases || []) {
    const idx = index[normalizeHeader(alias)]
    if (idx !== undefined) return idx
  }
  return -1
}

function parseMidstreamDate(raw) {
  const text = (raw || '').toString().trim()
  if (!text) return null

  const losDate = parseDate(text)
  if (losDate) return new Date(losDate.getFullYear(), losDate.getMonth(), 1)

  const ym = text.match(/^(\d{4})-(\d{2})$/)
  if (ym) {
    const year = Number(ym[1])
    const month = Number(ym[2]) - 1
    if (month < 0 || month > 11) return null
    return new Date(year, month, 1)
  }

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2]) - 1
    const day = Number(ymd[3])
    const check = new Date(year, month, day)
    if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) return null
    return new Date(year, month, 1)
  }

  if (text.includes('/')) return null

  const parsed = new Date(text)
  if (isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
}

function parseNum(raw) {
  if (raw == null || raw === '') return null
  const cleaned = raw
    .toString()
    .trim()
    .replace(/[$,%]/g, '')
    .replace(/[()]/g, match => (match === '(' ? '-' : ''))
    .replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseText(raw) {
  return (raw || '').toString().trim()
}

function parseField(row, fieldIdx) {
  const idx = fieldIdx
  if (idx == null || idx < 0) return null
  return parseNum(row[idx])
}

function parseWithDelimiter(text, delimiter) {
  const parsed = Papa.parse(text, { delimiter, header: false, skipEmptyLines: true })
  const rows = parsed.data || []
  if (!rows.length) return null

  const headers = rows[0] || []
  const index = buildHeaderIndex(headers)
  const dateIdx = findIndex(index, GPT_COLUMN_ALIASES.date)
  if (dateIdx === -1) return null

  return { rows, headers, index }
}

function detectDelimiter(text) {
  for (const delimiter of ['\t', ',', ';']) {
    const attempt = parseWithDelimiter(text, delimiter)
    if (attempt) return { ...attempt, delimiter }
  }
  const fallback = Papa.parse(text, { header: false, skipEmptyLines: true })
  const rows = fallback.data || []
  if (!rows.length) throw new Error('Midstream GPT statement appears empty.')
  throw new Error('Missing required columns. Include at least Date and Meter columns.')
}

function hasAtLeastOneComputableInput(row) {
  const keys = [
    'inletVolumeMcf', 'nglVolumeBbl', 'gasShrinkPct', 'gasShrinkMcf',
    'nglYield',
    'btuFactor', 'gasDifferential', 'residueGasSales', 'residueGasVolumeMcf',
    'wtiPrice', 'nglRealizedPrice', 'nglSales', 'totalMidstreamFee',
  ]
  return keys.some(k => row[k] != null)
}

export function parseMidstreamGptCSVText(text) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const { rows, index, headers } = detectDelimiter(cleaned)

  const fieldIdx = {}
  Object.entries(GPT_COLUMN_ALIASES).forEach(([key, aliases]) => {
    fieldIdx[key] = findIndex(index, aliases)
  })

  const warnings = []
  const out = []
  let badDateRows = 0
  let blankMeterRows = 0
  let noSignalRows = 0
  let missingInletRows = 0
  const meterIdx = fieldIdx.meterName

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.length) continue

    const date = parseMidstreamDate(row[fieldIdx.date])
    if (!date) {
      badDateRows++
      continue
    }

    const meterName = parseText(row[meterIdx]) || 'Statement Meter'
    if (!parseText(row[meterIdx])) blankMeterRows++

    const parsed = {
      rowNumber: i + 1,
      date,
      monthKey: monthKey(date),
      monthDisp: monthDisp(date),
      meterName,
      inletVolumeMcf: parseField(row, fieldIdx.inletVolumeMcf),
      nglVolumeBbl: parseField(row, fieldIdx.nglVolumeBbl),
      nglYield: parseField(row, fieldIdx.nglYield),
      gasShrinkPct: parseField(row, fieldIdx.gasShrinkPct),
      gasShrinkMcf: parseField(row, fieldIdx.gasShrinkMcf),
      btuFactor: parseField(row, fieldIdx.btuFactor),
      residueGasVolumeMcf: parseField(row, fieldIdx.residueGasVolumeMcf),
      residueGasSales: parseField(row, fieldIdx.residueGasSales),
      gasDifferential: parseField(row, fieldIdx.gasDifferential),
      hhubPrice: parseField(row, fieldIdx.hhubPrice),
      benchmarkGasPrice: parseField(row, fieldIdx.benchmarkGasPrice),
      wtiPrice: parseField(row, fieldIdx.wtiPrice),
      nglRealizedPrice: parseField(row, fieldIdx.nglRealizedPrice),
      nglSales: parseField(row, fieldIdx.nglSales),
      nglDifferentialPct: parseField(row, fieldIdx.nglDifferentialPct),
      totalMidstreamFee: parseField(row, fieldIdx.totalMidstreamFee),
      gatheringFee: parseField(row, fieldIdx.gatheringFee),
      processingFee: parseField(row, fieldIdx.processingFee),
      compressionFee: parseField(row, fieldIdx.compressionFee),
      treatingFee: parseField(row, fieldIdx.treatingFee),
      otherMidstreamFee: parseField(row, fieldIdx.otherMidstreamFee),
    }

    if (parsed.totalMidstreamFee == null) {
      const feeParts = [
        parsed.gatheringFee,
        parsed.processingFee,
        parsed.compressionFee,
        parsed.treatingFee,
        parsed.otherMidstreamFee,
      ].filter(v => v != null)
      if (feeParts.length > 0) {
        parsed.totalMidstreamFee = feeParts.reduce((sum, val) => sum + val, 0)
      }
    }

    const nglHeader = (headers[fieldIdx.nglVolumeBbl] || '').toString().toLowerCase()
    if (parsed.nglVolumeBbl != null && nglHeader.includes('gallon')) {
      parsed.nglVolumeBbl = parsed.nglVolumeBbl / 42
    }

    if (!hasAtLeastOneComputableInput(parsed)) {
      noSignalRows++
      continue
    }
    if (parsed.inletVolumeMcf == null || parsed.inletVolumeMcf <= 0) {
      missingInletRows++
    }

    out.push(parsed)
  }

  out.sort((a, b) => a.date - b.date || a.meterName.localeCompare(b.meterName))

  if (badDateRows > 0) warnings.push(`${badDateRows} row(s) skipped - invalid date in midstream GPT file.`)
  if (blankMeterRows > 0) warnings.push(`${blankMeterRows} row(s) had no meter column/value; defaulted to "Statement Meter".`)
  if (noSignalRows > 0) warnings.push(`${noSignalRows} row(s) skipped - no recognizable GPT metrics were found.`)
  if (missingInletRows > 0) warnings.push(`${missingInletRows} row(s) are missing inlet volume; GPT $/Mcf cannot be computed for those rows.`)

  if (!out.length) {
    throw new Error('No valid midstream GPT rows found after parsing.')
  }

  return { rows: out, warnings }
}
