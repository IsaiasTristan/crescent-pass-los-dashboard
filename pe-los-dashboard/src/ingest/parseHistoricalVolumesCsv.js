import Papa from 'papaparse'
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
