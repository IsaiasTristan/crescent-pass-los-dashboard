import Papa from 'papaparse'
import { monthKey, monthDisp, parseDate } from './parseCsv.js'
import { applyUnitConversion } from './autoMapper.js'

function normalizeHeader(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function buildHeaderIndex(headers) {
  const out = {}
  headers.forEach((header, index) => {
    const key = normalizeHeader(header)
    if (key && out[key] === undefined) out[key] = index
  })
  return out
}

function findIndex(index, aliases) {
  for (const alias of aliases) {
    const idx = index[normalizeHeader(alias)]
    if (idx !== undefined) return idx
  }
  return -1
}

function parseVolumeDate(raw) {
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
  const n = parseFloat(raw.toString().replace(/,/g, '').trim())
  return isNaN(n) ? null : n
}

function normalizeOpStatus(raw) {
  const text = (raw || '').toString().trim().toUpperCase()
  if (!text) return ''
  if (text === 'OP' || text === 'OPERATED') return 'op'
  if (text === 'OBO' || text === 'NON-OPERATED' || text === 'NON-OP' || text.startsWith('NON')) return 'obo'
  return ''
}

function tryParseWithDelimiter(text, delimiter) {
  const parsed = Papa.parse(text, { delimiter, header: false, skipEmptyLines: true })
  const rows = parsed.data || []
  if (!rows.length) return null

  const headers = rows[0] || []
  const headerIndex = buildHeaderIndex(headers)
  const dateIdx = findIndex(headerIndex, ['date', 'month', 'service end date'])
  const wellNameIdx = findIndex(headerIndex, ['well name', 'well', 'wellname'])
  const applicableTagIdx = findIndex(headerIndex, [
    'applicable tag', 'applicable_tag', 'well tag', 'tag', 'property #', 'property number', 'property num',
    'pt prop num', 'pt prop #', 'pt property num', 'pt property #',
  ])
  const propertyNameIdx = findIndex(headerIndex, ['property name', 'property', 'lease'])
  const opStatusIdx = findIndex(headerIndex, ['op status', 'opstatus', 'op/obo', 'status'])
  const grossOilIdx = findIndex(headerIndex, ['gross oil', 'gross oil volume', 'oil gross', 'oil volume'])
  const grossGasIdx = findIndex(headerIndex, ['gross gas', 'gross gas volume', 'gas gross', 'gas volume'])
  const grossNglIdx = findIndex(headerIndex, ['gross ngl', 'gross ngl volume', 'ngl gross', 'ngl volume'])
  const grossWaterIdx = findIndex(headerIndex, ['gross water', 'gross water volume', 'water gross', 'water volume', 'water'])

  if (dateIdx === -1) return null
  if (wellNameIdx === -1 && applicableTagIdx === -1 && propertyNameIdx === -1) return null
  if (grossOilIdx === -1 && grossGasIdx === -1 && grossNglIdx === -1 && grossWaterIdx === -1) return null

  return {
    rows,
    indices: {
      dateIdx,
      wellNameIdx,
      applicableTagIdx,
      propertyNameIdx,
      opStatusIdx,
      grossOilIdx,
      grossGasIdx,
      grossNglIdx,
      grossWaterIdx,
    },
  }
}

export function parseHistoricalVolumesCSVText(text) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const delimitersToTry = ['\t', ',', ';']
  let attempt = null
  for (const delimiter of delimitersToTry) {
    attempt = tryParseWithDelimiter(cleaned, delimiter)
    if (attempt) break
  }

  if (!attempt) {
    const fallback = Papa.parse(cleaned, { header: false, skipEmptyLines: true })
    const rows = fallback.data || []
    if (!rows.length) throw new Error('Historical gross-volume CSV appears empty.')
    throw new Error('Missing required columns. Add Date/Month, Well Name or Applicable Tag, and at least one gross volume column.')
  }

  const { rows, indices } = attempt
  const out = []
  const warnings = []
  let skippedBadDate = 0
  let skippedNoIdentifier = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.length) continue

    const date = parseVolumeDate(row[indices.dateIdx])
    if (!date) {
      skippedBadDate++
      continue
    }

    const wellName = indices.wellNameIdx >= 0 ? (row[indices.wellNameIdx] || '').toString().trim() : ''
    const applicableTag = indices.applicableTagIdx >= 0 ? (row[indices.applicableTagIdx] || '').toString().trim() : ''
    const propertyName = indices.propertyNameIdx >= 0 ? (row[indices.propertyNameIdx] || '').toString().trim() : ''
    const opStatus = indices.opStatusIdx >= 0 ? normalizeOpStatus(row[indices.opStatusIdx]) : ''
    if (!wellName && !applicableTag && !propertyName) {
      skippedNoIdentifier++
      continue
    }

    const grossOilVolume = indices.grossOilIdx >= 0 ? parseNum(row[indices.grossOilIdx]) : null
    const grossGasVolume = indices.grossGasIdx >= 0 ? parseNum(row[indices.grossGasIdx]) : null
    const grossNGLVolume = indices.grossNglIdx >= 0 ? parseNum(row[indices.grossNglIdx]) : null
    const grossWaterVolume = indices.grossWaterIdx >= 0 ? parseNum(row[indices.grossWaterIdx]) : null
    const hasData = [grossOilVolume, grossGasVolume, grossNGLVolume, grossWaterVolume].some(v => v != null)
    if (!hasData) continue

    out.push({
      rowNumber: i + 1,
      date,
      monthKey: monthKey(date),
      monthDisp: monthDisp(date),
      wellName,
      applicableTag,
      propertyName,
      opStatus,
      grossOilVolume,
      grossGasVolume,
      grossNGLVolume,
      grossWaterVolume,
    })
  }

  out.sort((a, b) => a.date - b.date || a.rowNumber - b.rowNumber)
  if (skippedBadDate > 0) warnings.push(`${skippedBadDate} row(s) skipped - invalid date in historical gross-volume file.`)
  if (skippedNoIdentifier > 0) warnings.push(`${skippedNoIdentifier} row(s) skipped - missing Well Name / Applicable Tag.`)
  if (!out.length) throw new Error('No valid historical gross-volume rows found after parsing.')

  return { rows: out, warnings }
}

/**
 * Parse historical gross-volume CSV using a pre-confirmed column mapping from DataSourceMapper.
 *
 * @param {string} text - Raw CSV text.
 * @param {{ [canonicalFieldId: string]: number }} columnMap
 * @param {{ [canonicalFieldId: string]: string }} unitOverrides
 * @returns {{ rows: object[], warnings: string[] }}
 */
export function parseHistoricalVolumesCSVWithMapping(text, columnMap, unitOverrides = {}) {
  const cleaned = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  let allRows = null
  for (const delimiter of ['\t', ',', ';']) {
    const result = Papa.parse(cleaned, { delimiter, header: false, skipEmptyLines: true })
    if (result.data && result.data.length > 1 && result.data[0].length > 2) {
      allRows = result.data
      break
    }
  }
  if (!allRows) {
    const result = Papa.parse(cleaned, { header: false, skipEmptyLines: true })
    allRows = result.data || []
  }
  if (!allRows.length) throw new Error('Historical gross-volume CSV appears empty.')

  const cm = columnMap || {}
  const indices = {
    dateIdx:          cm.serviceDate       ?? -1,
    wellNameIdx:      cm.wellName          ?? -1,
    applicableTagIdx: cm.propertyNum       ?? -1,
    propertyNameIdx:  cm.propertyName      ?? -1,
    opStatusIdx:      cm.opStatus          ?? -1,
    grossOilIdx:      cm.grossOilVolume    ?? -1,
    grossGasIdx:      cm.grossGasVolume    ?? -1,
    grossNglIdx:      cm.grossNGLVolume    ?? -1,
    grossWaterIdx:    cm.grossWaterVolume  ?? -1,
  }

  const oilUnit   = unitOverrides.grossOilVolume   || null
  const gasUnit   = unitOverrides.grossGasVolume   || null
  const nglUnit   = unitOverrides.grossNGLVolume   || null
  const waterUnit = unitOverrides.grossWaterVolume || null

  const out = []
  const warnings = []
  let skippedBadDate = 0
  let skippedNoIdentifier = 0

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i] || []
    if (!row.length) continue

    if (indices.dateIdx < 0) { skippedBadDate++; continue }
    const date = parseVolumeDate(row[indices.dateIdx])
    if (!date) { skippedBadDate++; continue }

    const wellName      = indices.wellNameIdx      >= 0 ? (row[indices.wellNameIdx]      || '').toString().trim() : ''
    const applicableTag = indices.applicableTagIdx >= 0 ? (row[indices.applicableTagIdx] || '').toString().trim() : ''
    const propertyName  = indices.propertyNameIdx  >= 0 ? (row[indices.propertyNameIdx]  || '').toString().trim() : ''
    const opStatus      = indices.opStatusIdx      >= 0 ? normalizeOpStatus(row[indices.opStatusIdx]) : ''

    if (!wellName && !applicableTag && !propertyName) { skippedNoIdentifier++; continue }

    let grossOilVolume   = indices.grossOilIdx   >= 0 ? parseNum(row[indices.grossOilIdx])   : null
    let grossGasVolume   = indices.grossGasIdx   >= 0 ? parseNum(row[indices.grossGasIdx])   : null
    let grossNGLVolume   = indices.grossNglIdx   >= 0 ? parseNum(row[indices.grossNglIdx])   : null
    let grossWaterVolume = indices.grossWaterIdx >= 0 ? parseNum(row[indices.grossWaterIdx]) : null

    grossOilVolume   = applyUnitConversion(grossOilVolume,   'BBL', oilUnit)   ?? grossOilVolume
    grossGasVolume   = applyUnitConversion(grossGasVolume,   'MCF', gasUnit)   ?? grossGasVolume
    grossNGLVolume   = applyUnitConversion(grossNGLVolume,   'BBL', nglUnit)   ?? grossNGLVolume
    grossWaterVolume = applyUnitConversion(grossWaterVolume, 'BBL', waterUnit) ?? grossWaterVolume

    const hasData = [grossOilVolume, grossGasVolume, grossNGLVolume, grossWaterVolume].some(v => v != null)
    if (!hasData) continue

    out.push({
      rowNumber: i + 1,
      date,
      monthKey: monthKey(date),
      monthDisp: monthDisp(date),
      wellName,
      applicableTag,
      propertyName,
      opStatus,
      grossOilVolume,
      grossGasVolume,
      grossNGLVolume,
      grossWaterVolume,
    })
  }

  out.sort((a, b) => a.date - b.date || a.rowNumber - b.rowNumber)
  if (skippedBadDate > 0) warnings.push(`${skippedBadDate} row(s) skipped - invalid date in historical gross-volume file.`)
  if (skippedNoIdentifier > 0) warnings.push(`${skippedNoIdentifier} row(s) skipped - missing Well Name / Applicable Tag.`)
  if (!out.length) throw new Error('No valid historical gross-volume rows found. Check that Date and identifier columns are correctly mapped.')

  return { rows: out, warnings }
}
