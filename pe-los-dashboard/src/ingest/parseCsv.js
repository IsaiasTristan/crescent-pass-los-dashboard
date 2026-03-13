import Papa from 'papaparse'
import { LOS_BUCKETS, COST_CAT_BUCKETS, LOS_IGNORE } from '../constants/losMapping.js'
import { applyUnitConversion } from './autoMapper.js'

// ─── Column index defaults (0-based) ─────────────────────────────────────────

const COL_DEFAULTS = {
  WELL_NAME: 0, COST_CATEGORY: 1, NRI: 3, WI: 4,
  GROSS_AMOUNT: 5, GROSS_VOLUME: 6, JP_RP: 8,
  SERVICE_END_DATE: 11, PROPERTY_NUM: 12, PROPERTY_NAME: 13,
  OP_OBO: 15, LOS_CATEGORY: 16, NET_VOLUME: 20, NET_AMOUNT: 21,
}

// Builds a column-index map from a detected header row.
// Falls back to COL_DEFAULTS for any column not found by name.
function buildColMap(headerRow) {
  const col = { ...COL_DEFAULTS }
  const h = headerRow.map(v => (v || '').toString().trim().toLowerCase())

  const exact = {
    'well name':        'WELL_NAME',
    'cost category':    'COST_CATEGORY',
    'nri':              'NRI',
    'wi':               'WI',
    'gross amount':     'GROSS_AMOUNT',
    'gross volume':     'GROSS_VOLUME',
    'service end date': 'SERVICE_END_DATE',
    'property #':       'PROPERTY_NUM',
    'property name':    'PROPERTY_NAME',
    'op/obo':           'OP_OBO',
    'los category':     'LOS_CATEGORY',
    'net volume':       'NET_VOLUME',
  }
  h.forEach((name, i) => {
    if (exact[name] !== undefined) col[exact[name]] = i
  })

  // JP/RP_USE column preferred over plain JP/RP for lift type classification
  const jpRpUseIdx = h.findIndex(v =>
    /jp.*rp.*use|rp.*jp.*use/i.test(v) || v === 'jp/rp_use' || v === 'jp_rp_use' || v === 'jp/rp use'
  )
  const jpIdx = h.indexOf('jp/rp')
  if (jpRpUseIdx !== -1) col.JP_RP = jpRpUseIdx
  else if (jpIdx !== -1) col.JP_RP = jpIdx

  // Take the last "net amount" column if the header appears multiple times
  let lastNA = -1
  h.forEach((name, i) => { if (name === 'net amount') lastNA = i })
  if (lastNA !== -1) col.NET_AMOUNT = lastNA

  return col
}

// ─── Date parsing ─────────────────────────────────────────────────────────────
// Accepts M/DD/YY only (2-digit year). Rejects 4-digit years and invalid
// month/day combinations by round-tripping the constructed Date.
// Returns a Date on success, or null on any format/value problem.

export function parseDate(raw) {
  if (!raw) return null
  const p = raw.toString().trim().split('/')
  if (p.length !== 3) return null
  const monthIdx = parseInt(p[0], 10) - 1  // 0-based
  const day      = parseInt(p[1], 10)
  const yearPart = parseInt(p[2], 10)

  if (isNaN(monthIdx) || isNaN(day) || isNaN(yearPart)) return null
  // Accept 2-digit years (00-99 → 2000-2099) or 4-digit years (100-9999)
  const year = yearPart <= 99 && yearPart >= 0
    ? 2000 + yearPart
    : yearPart >= 100 && yearPart <= 9999
      ? yearPart
      : -1
  if (year < 0) return null

  const d = new Date(year, monthIdx, day)

  // Round-trip check: JS rolls over invalid dates (e.g. Feb 31 → Mar 3).
  // Reject if the constructed Date doesn't match what we passed in.
  if (
    d.getFullYear() !== year ||
    d.getMonth()    !== monthIdx ||
    d.getDate()     !== day
  ) return null

  return d
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function monthDisp(date) {
  return `${MONTH_NAMES[date.getMonth()]} '${String(date.getFullYear()).slice(2)}`
}

// ─── Numeric parsing ──────────────────────────────────────────────────────────
// Blank / null → 0 (expected for empty volume/cost cells).
// Non-empty, non-numeric → NaN (caller can detect and flag data quality issues).

export function parseNum(raw) {
  if (raw == null || raw === '') return 0
  const n = parseFloat(raw.toString().replace(/,/g, '').trim())
  return n  // may be NaN — callers should guard critical financial fields
}

// Coerces parseNum result to 0 if NaN. Use for non-critical fields (NRI, WI,
// gross amounts) where a zero is safe and we don't need to flag the row.
function parseNumSafe(raw) {
  const n = parseNum(raw)
  return isNaN(n) ? 0 : n
}

// ─── Bucket resolution ────────────────────────────────────────────────────────

const _COST_CAT_LOWER = Object.fromEntries(
  Object.entries(COST_CAT_BUCKETS).map(([k, v]) => [k.toLowerCase(), v])
)
const _LOS_LOWER = Object.fromEntries(
  Object.entries(LOS_BUCKETS).map(([k, v]) => [k.toLowerCase(), v])
)

export function resolveBucket(los, cat) {
  const l = (los || '').trim().toLowerCase()
  const c = (cat || '').trim().toLowerCase()
  if (l && LOS_IGNORE.has(l)) return 'ignore'
  if (c) { const v = _COST_CAT_LOWER[c]; if (v !== undefined) return v }
  if (l) { const v = _LOS_LOWER[l];      if (v !== undefined) return v }
  return null
}

// ─── Main CSV parser ──────────────────────────────────────────────────────────
// Returns { rows, warnings, issues } where:
//   rows     - array of canonical parsed row objects
//   warnings - array of human-readable validation messages
//   issues   - row-level data quality issues for optional export/reporting
// Throws an Error with a descriptive message on structural parse failure.

function tryParseWithDelimiter(text, delimiter) {
  const result = Papa.parse(text, { delimiter, header: false, skipEmptyLines: true })
  if (!result.data || !result.data.length) return null
  const allRows = result.data
  let start = 0
  const fc = (allRows[0][0] || '').toString().toLowerCase().trim()
  const hasHeader = fc === 'well name' || fc === 'well' || fc === 'wellname'
  if (hasHeader) start = 1
  const col = hasHeader ? buildColMap(allRows[0]) : COL_DEFAULTS
  const minCols = Math.max(col.WELL_NAME, col.SERVICE_END_DATE, col.LOS_CATEGORY, col.NET_AMOUNT) + 1
  const sample = allRows[start]
  if (!sample || sample.length < minCols) return null
  return { result, allRows, start, col, hasHeader, delimiter, minCols }
}

function isBlankCell(value) {
  return value == null || value.toString().trim() === ''
}

function isZeroOrBlank(value) {
  if (isBlankCell(value)) return true
  const n = parseFloat(value.toString().replace(/,/g, '').trim())
  return !isNaN(n) && n === 0
}

function isTrailingPaddingRow(row, col) {
  if (!row || !row.length) return true

  const identityFields = [
    row[col.WELL_NAME],
    row[col.SERVICE_END_DATE],
    row[col.COST_CATEGORY],
    row[col.LOS_CATEGORY],
    row[col.OP_OBO],
    row[col.PROPERTY_NUM],
    row[col.PROPERTY_NAME],
    row[col.JP_RP],
  ]
  const hasIdentity = identityFields.some(v => !isBlankCell(v))
  if (hasIdentity) return false

  const numericFields = [
    row[col.NET_AMOUNT],
    row[col.NET_VOLUME],
    row[col.GROSS_AMOUNT],
    row[col.GROSS_VOLUME],
    row[col.NRI],
    row[col.WI],
  ]
  return numericFields.every(isZeroOrBlank)
}

export function parseCSVText(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

  // Try each delimiter; use the first that yields enough columns (tab, comma, semicolon)
  const delimitersToTry = ['\t', ',', ';']
  let attempt = null
  for (const d of delimitersToTry) {
    attempt = tryParseWithDelimiter(text, d)
    if (attempt) break
  }
  if (!attempt) {
    const firstLine = text.split('\n')[0] || ''
    const primary = (firstLine.match(/\t/g) || []).length >= (firstLine.match(/,/g) || []).length ? '\t' : ','
    const result = Papa.parse(text, { delimiter: primary, header: false, skipEmptyLines: true })
    const allRows = result.data || []
    const start = (() => {
      const fc = (allRows[0] && allRows[0][0] || '').toString().toLowerCase().trim()
      return fc === 'well name' || fc === 'well' || fc === 'wellname' ? 1 : 0
    })()
    const col = start === 1 ? buildColMap(allRows[0]) : COL_DEFAULTS
    const minCols = Math.max(col.WELL_NAME, col.SERVICE_END_DATE, col.LOS_CATEGORY, col.NET_AMOUNT) + 1
    const sample = allRows[start]
    throw new Error(
      `Expected ${minCols}+ columns; found ${sample ? sample.length : 0}. ` +
      `Try saving the file as tab- or comma-delimited. First row should be a header with "Well Name", "Service End Date", "LOS CATEGORY", "Net Amount".`
    )
  }

  const { result, allRows, start, col, delimiter, minCols } = attempt
  if (!result.data || !result.data.length) {
    throw new Error('CSV appears empty or could not be parsed.')
  }

  const parsed  = []
  const warnings = []
  const issues = []
  let skippedShort = 0, skippedNoName = 0, skippedBadDate = 0
  let badNetAmountCount = 0, badNetVolumeCount = 0

  for (let i = start; i < allRows.length; i++) {
    const r = allRows[i]
    const rowNumber = i + 1
    if (isTrailingPaddingRow(r, col)) continue

    if (!r || r.length < minCols) {
      skippedShort++
      issues.push({
        rowNumber,
        issueType: 'short_row',
        message: `Row has ${r ? r.length : 0} columns; expected at least ${minCols}.`,
        wellName: '',
        serviceEndDate: '',
        costCategory: '',
        losCategory: '',
        netVolumeRaw: '',
        netAmountRaw: '',
      })
      continue
    }

    const wellName = (r[col.WELL_NAME] || '').toString().trim()
    const serviceEndDateRaw = (r[col.SERVICE_END_DATE] || '').toString().trim()
    const los = (r[col.LOS_CATEGORY]  || '').toString().trim()
    const cat = (r[col.COST_CATEGORY] || '').toString().trim()
    const netAmountRaw  = r[col.NET_AMOUNT]
    const netVolumeRaw  = r[col.NET_VOLUME]

    if (!wellName) {
      skippedNoName++
      issues.push({
        rowNumber,
        issueType: 'missing_well_name',
        message: 'Well Name is blank.',
        wellName: '',
        serviceEndDate: serviceEndDateRaw,
        costCategory: cat,
        losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
      continue
    }

    const date = parseDate(serviceEndDateRaw)
    if (!date) {
      skippedBadDate++
      issues.push({
        rowNumber,
        issueType: 'invalid_service_end_date',
        message: `Invalid Service End Date "${serviceEndDateRaw}". Expected M/D/YY or M/D/YYYY.`,
        wellName,
        serviceEndDate: serviceEndDateRaw,
        costCategory: cat,
        losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
      continue
    }

    const netAmountParsed = parseNum(netAmountRaw)
    const netVolumeParsed = parseNum(netVolumeRaw)

    if (isNaN(netAmountParsed) && netAmountRaw != null && netAmountRaw !== '') {
      badNetAmountCount++
      issues.push({
        rowNumber,
        issueType: 'non_numeric_net_amount',
        message: `Non-numeric Net Amount "${String(netAmountRaw)}" was treated as 0.`,
        wellName,
        serviceEndDate: serviceEndDateRaw,
        costCategory: cat,
        losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: String(netAmountRaw),
      })
    }
    if (isNaN(netVolumeParsed) && netVolumeRaw != null && netVolumeRaw !== '') {
      badNetVolumeCount++
      issues.push({
        rowNumber,
        issueType: 'non_numeric_net_volume',
        message: `Non-numeric Net Volume "${String(netVolumeRaw)}" was treated as 0.`,
        wellName,
        serviceEndDate: serviceEndDateRaw,
        costCategory: cat,
        losCategory: los,
        netVolumeRaw: String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
    }

    const bucket = resolveBucket(los, cat)
    if (bucket === null && (los || cat)) {
      issues.push({
        rowNumber,
        issueType: 'unmapped_los_or_cost_category',
        message: `No bucket mapping found for LOS "${los}" / Cost Category "${cat}". Row is excluded from rollups.`,
        wellName,
        serviceEndDate: serviceEndDateRaw,
        costCategory: cat,
        losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
    }

    parsed.push({
      wellName, cat, los,
      nri:         parseNumSafe(r[col.NRI]),
      wi:          parseNumSafe(r[col.WI]),
      grossAmount: parseNumSafe(r[col.GROSS_AMOUNT]),
      grossVolume: parseNumSafe(r[col.GROSS_VOLUME]),
      jpRp:        (r[col.JP_RP]        || '').toString().trim(),
      date,
      monthKey:    monthKey(date),
      monthDisp:   monthDisp(date),
      propertyNum: (r[col.PROPERTY_NUM]  || '').toString().trim(),
      propertyName:(r[col.PROPERTY_NAME] || '').toString().trim(),
      opObo:       (r[col.OP_OBO]        || '').toString().trim(),
      bucket,
      netVolume:   isNaN(netVolumeParsed) ? 0 : netVolumeParsed,
      netAmount:   isNaN(netAmountParsed) ? 0 : netAmountParsed,
    })
  }

  if (!parsed.length) {
    const firstDataRow = allRows[start] || []
    const sampleName = (firstDataRow[col.WELL_NAME]        || '').toString().trim()
    const sampleDate = (firstDataRow[col.SERVICE_END_DATE] || '').toString().trim()
    throw new Error(
      `No valid rows found: ${skippedShort} short, ${skippedNoName} no well name, ${skippedBadDate} bad date. ` +
      `Use M/DD/YY or M/DD/YYYY for Service End Date. First row must be a header with "Well Name". ` +
      `Sample: well="${sampleName}" date="${sampleDate}" (${firstDataRow.length} cols, ${delimiter === '\t' ? 'tab' : delimiter === ';' ? 'semicolon' : 'comma'})`
    )
  }

  // Surface data-quality warnings
  if (skippedBadDate > 0) {
    warnings.push(
      `${skippedBadDate} row(s) skipped - invalid Service End Date. Expected M/D/YY or M/D/YYYY (example: 1/31/24 or 1/31/2024).`
    )
  }
  if (badNetAmountCount > 0) warnings.push(`${badNetAmountCount} row(s) had non-numeric Net Amount values - treated as 0.`)
  if (badNetVolumeCount > 0) warnings.push(`${badNetVolumeCount} row(s) had non-numeric Net Volume values - treated as 0.`)

  // Count unmapped categories and warn
  const unmappedCats = new Set(
    issues
      .filter(i => i.issueType === 'unmapped_los_or_cost_category')
      .map(i => i.losCategory || i.costCategory)
      .filter(Boolean)
  )
  if (unmappedCats.size > 0) {
    warnings.push(
      `${unmappedCats.size} LOS/cost category label(s) have no bucket mapping and will be excluded from rollups: ` +
      [...unmappedCats].slice(0, 5).map(c => `"${c}"`).join(', ') +
      (unmappedCats.size > 5 ? ` ... and ${unmappedCats.size - 5} more.` : '.')
    )
  }

  // Debug audit for midstream rows — helps trace MS/midstream category spelling
  const msRows = parsed.filter(r =>
    (r.cat || '').toUpperCase().startsWith('MS') ||
    (r.los || '').toLowerCase().includes('midstream') ||
    (r.los || '').toLowerCase().startsWith('ms')
  )
  if (msRows.length) {
    const catsSeen = [...new Set(msRows.map(r => `"${r.cat}"`))]
    const losSeen  = [...new Set(msRows.map(r => `"${r.los}"`))]
    console.group(`%c[MS Audit] ${msRows.length} midstream rows found`, 'color:#C55A11;font-weight:bold')
    console.log('Cost Category values seen:', catsSeen.join(', '))
    console.log('LOS Category values seen:',  losSeen.join(', '))
    const byMonth = {}
    for (const r of msRows) {
      if (!byMonth[r.monthKey]) byMonth[r.monthKey] = []
      byMonth[r.monthKey].push({ well: r.wellName, cat: r.cat, los: r.los, bucket: r.bucket, netAmt: r.netAmount })
    }
    for (const [mk, monthRows] of Object.entries(byMonth).sort()) {
      const total = monthRows.reduce((s, r) => s + r.netAmt, 0)
      console.group(`${mk}  →  net total = ${total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`)
      console.table(monthRows)
      console.groupEnd()
    }
    console.groupEnd()
  } else {
    console.warn('[MS Audit] No midstream rows matched. Check Cost Category column spelling in your CSV.')
  }

  return { rows: parsed, warnings, issues }
}

// ─── Mapping from canonical fieldRegistry IDs → internal col keys ─────────────
const CANONICAL_TO_COL_KEY = {
  wellName:     'WELL_NAME',
  serviceDate:  'SERVICE_END_DATE',
  costCategory: 'COST_CATEGORY',
  losCategory:  'LOS_CATEGORY',
  netAmount:    'NET_AMOUNT',
  netVolume:    'NET_VOLUME',
  grossAmount:  'GROSS_AMOUNT',
  grossVolume:  'GROSS_VOLUME',
  wi:           'WI',
  nri:          'NRI',
  propertyNum:  'PROPERTY_NUM',
  propertyName: 'PROPERTY_NAME',
  opObo:        'OP_OBO',
  jpRp:         'JP_RP',
}

// Converts a DataSourceMapper columnMap ({ canonicalFieldId: colIndex }) to
// the internal col object used by the parsing core.
function buildColFromCanonicalMap(columnMap) {
  const col = { ...COL_DEFAULTS }
  for (const [fieldId, colIdx] of Object.entries(columnMap || {})) {
    const colKey = CANONICAL_TO_COL_KEY[fieldId]
    if (colKey !== undefined && colIdx != null && colIdx >= 0) {
      col[colKey] = colIdx
    }
  }
  return col
}

// Detects delimiter and parses to raw rows; returns { allRows, delimiter } or throws.
function detectDelimiterAndParse(text) {
  for (const delimiter of ['\t', ',', ';']) {
    const result = Papa.parse(text, { delimiter, header: false, skipEmptyLines: true })
    if (result.data && result.data.length && result.data[0].length > 3) {
      return { allRows: result.data, delimiter }
    }
  }
  const result = Papa.parse(text, { header: false, skipEmptyLines: true })
  return { allRows: result.data || [], delimiter: ',' }
}

/**
 * Parse LOS CSV text using a pre-confirmed column mapping from DataSourceMapper.
 *
 * @param {string} text - Raw CSV text.
 * @param {{ [canonicalFieldId: string]: number }} columnMap - Field → column index.
 * @param {{ [canonicalFieldId: string]: string }} unitOverrides - Field → unit key.
 * @returns {{ rows: object[], warnings: string[], issues: object[] }}
 */
export function parseCSVWithMapping(text, columnMap, unitOverrides = {}) {
  text = (text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const { allRows, delimiter } = detectDelimiterAndParse(text)

  if (!allRows.length) throw new Error('CSV appears empty or could not be parsed.')

  // The confirmed mapping was built from headers, so row 0 is always the header.
  const col = buildColFromCanonicalMap(columnMap)
  const start = 1
  const minCols = Math.max(col.WELL_NAME, col.SERVICE_END_DATE, col.LOS_CATEGORY, col.NET_AMOUNT) + 1

  const parsed = []
  const warnings = []
  const issues = []
  let skippedShort = 0, skippedNoName = 0, skippedBadDate = 0
  let badNetAmountCount = 0, badNetVolumeCount = 0

  // Unit overrides for WI and NRI (percent → decimal)
  const wiUnit  = unitOverrides.wi  || null
  const nriUnit = unitOverrides.nri || null

  for (let i = start; i < allRows.length; i++) {
    const r = allRows[i]
    const rowNumber = i + 1
    if (isTrailingPaddingRow(r, col)) continue

    if (!r || r.length < minCols) {
      skippedShort++
      issues.push({
        rowNumber, issueType: 'short_row',
        message: `Row has ${r ? r.length : 0} columns; expected at least ${minCols}.`,
        wellName: '', serviceEndDate: '', costCategory: '', losCategory: '',
        netVolumeRaw: '', netAmountRaw: '',
      })
      continue
    }

    const wellName          = (r[col.WELL_NAME]       || '').toString().trim()
    const serviceEndDateRaw = (r[col.SERVICE_END_DATE] || '').toString().trim()
    const los               = (r[col.LOS_CATEGORY]    || '').toString().trim()
    const cat               = (r[col.COST_CATEGORY]   || '').toString().trim()
    const netAmountRaw      = r[col.NET_AMOUNT]
    const netVolumeRaw      = r[col.NET_VOLUME]

    if (!wellName) {
      skippedNoName++
      issues.push({
        rowNumber, issueType: 'missing_well_name',
        message: 'Well Name is blank.',
        wellName: '', serviceEndDate: serviceEndDateRaw, costCategory: cat, losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
      continue
    }

    const date = parseDate(serviceEndDateRaw)
    if (!date) {
      skippedBadDate++
      issues.push({
        rowNumber, issueType: 'invalid_service_end_date',
        message: `Invalid Service End Date "${serviceEndDateRaw}". Expected M/D/YY or M/D/YYYY.`,
        wellName, serviceEndDate: serviceEndDateRaw, costCategory: cat, losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
      continue
    }

    const netAmountParsed = parseNum(netAmountRaw)
    const netVolumeParsed = parseNum(netVolumeRaw)

    if (isNaN(netAmountParsed) && netAmountRaw != null && netAmountRaw !== '') {
      badNetAmountCount++
      issues.push({
        rowNumber, issueType: 'non_numeric_net_amount',
        message: `Non-numeric Net Amount "${String(netAmountRaw)}" was treated as 0.`,
        wellName, serviceEndDate: serviceEndDateRaw, costCategory: cat, losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: String(netAmountRaw),
      })
    }
    if (isNaN(netVolumeParsed) && netVolumeRaw != null && netVolumeRaw !== '') {
      badNetVolumeCount++
      issues.push({
        rowNumber, issueType: 'non_numeric_net_volume',
        message: `Non-numeric Net Volume "${String(netVolumeRaw)}" was treated as 0.`,
        wellName, serviceEndDate: serviceEndDateRaw, costCategory: cat, losCategory: los,
        netVolumeRaw: String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
    }

    const bucket = resolveBucket(los, cat)
    if (bucket === null && (los || cat)) {
      issues.push({
        rowNumber, issueType: 'unmapped_los_or_cost_category',
        message: `No bucket mapping found for LOS "${los}" / Cost Category "${cat}". Row is excluded from rollups.`,
        wellName, serviceEndDate: serviceEndDateRaw, costCategory: cat, losCategory: los,
        netVolumeRaw: netVolumeRaw == null ? '' : String(netVolumeRaw),
        netAmountRaw: netAmountRaw == null ? '' : String(netAmountRaw),
      })
    }

    let wiRaw  = parseNumSafe(r[col.WI])
    let nriRaw = parseNumSafe(r[col.NRI])
    if (wiUnit)  wiRaw  = applyUnitConversion(wiRaw,  'decimal', wiUnit)  ?? wiRaw
    if (nriUnit) nriRaw = applyUnitConversion(nriRaw, 'decimal', nriUnit) ?? nriRaw

    parsed.push({
      wellName, cat, los,
      nri:         nriRaw,
      wi:          wiRaw,
      grossAmount: parseNumSafe(r[col.GROSS_AMOUNT]),
      grossVolume: parseNumSafe(r[col.GROSS_VOLUME]),
      jpRp:        (r[col.JP_RP]        || '').toString().trim(),
      date,
      monthKey:    monthKey(date),
      monthDisp:   monthDisp(date),
      propertyNum: (r[col.PROPERTY_NUM]  || '').toString().trim(),
      propertyName:(r[col.PROPERTY_NAME] || '').toString().trim(),
      opObo:       (r[col.OP_OBO]        || '').toString().trim(),
      bucket,
      netVolume:   isNaN(netVolumeParsed) ? 0 : netVolumeParsed,
      netAmount:   isNaN(netAmountParsed) ? 0 : netAmountParsed,
    })
  }

  if (!parsed.length) {
    throw new Error(
      `No valid rows found after mapping: ${skippedShort} short, ${skippedNoName} no well name, ${skippedBadDate} bad date. ` +
      `Check that the correct columns were mapped in the field mapper.`
    )
  }

  if (skippedBadDate > 0) {
    warnings.push(`${skippedBadDate} row(s) skipped - invalid Service End Date.`)
  }
  if (badNetAmountCount > 0) warnings.push(`${badNetAmountCount} row(s) had non-numeric Net Amount values - treated as 0.`)
  if (badNetVolumeCount > 0) warnings.push(`${badNetVolumeCount} row(s) had non-numeric Net Volume values - treated as 0.`)

  const unmappedCats = new Set(
    issues
      .filter(i => i.issueType === 'unmapped_los_or_cost_category')
      .map(i => i.losCategory || i.costCategory)
      .filter(Boolean)
  )
  if (unmappedCats.size > 0) {
    warnings.push(
      `${unmappedCats.size} LOS/cost category label(s) have no bucket mapping and will be excluded from rollups: ` +
      [...unmappedCats].slice(0, 5).map(c => `"${c}"`).join(', ') +
      (unmappedCats.size > 5 ? ` ... and ${unmappedCats.size - 5} more.` : '.')
    )
  }

  return { rows: parsed, warnings, issues }
}
